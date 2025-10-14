const express = require('express');
const path = require('path');
const fs = require('fs');

// Импорт наших классов
const repositoryFactory = require('./src/infrastructure/RepositoryFactory');
const GameService = require('./src/infrastructure/GameService');
const WebSocketHandler = require('./src/infrastructure/WebSocketHandler');
const StatsService = require('./src/infrastructure/StatsService');
const mongoConnection = require('./src/infrastructure/MongoConnection');

const app = express();
const PORT = process.env.PORT || 4000;

// Раздача статических файлов
app.use(express.static('public'));
// Serve Sound assets (mp3 files)
app.use('/Sound', express.static('Sound'));

let server;
let webSocketHandler;
let gameService;
let statsService;

// Подключение к Mongo и запуск HTTP/WSS (фатально при ошибке)
(async () => {
  try {
    await mongoConnection.connect();
    await mongoConnection.createIndexes();
    console.log('MongoDB connected and indexes ensured');

    // Seed words collection if empty (one-time bootstrap after migration to Mongo)
    const db = mongoConnection.getDatabase();
    const wordsCount = await db.collection('words').countDocuments();
    if (wordsCount === 0) {
      console.log('Words collection is empty. Seeding from backups or defaults...');
      const publicDir = path.join(__dirname, 'public');
      const backupFiles = fs.readdirSync(publicDir)
        .filter(f => f.startsWith('words_backup_') && f.endsWith('.csv'))
        .map(f => path.join(publicDir, f))
        .sort();

      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim()); current = '';
          } else { current += ch; }
        }
        result.push(current.trim());
        return result;
      };

      let seeded = 0;
      if (backupFiles.length > 0) {
        const latest = backupFiles[backupFiles.length - 1];
        console.log('Seeding words from', latest);
        const raw = fs.readFileSync(latest, 'utf8');
        const hasNewlines = raw.includes('\n');
        let entries = [];
        if (hasNewlines) {
          const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          let startIndex = 0;
          const headerCandidate = (lines[0] || '').toLowerCase();
          if (headerCandidate.includes('слово') || headerCandidate.includes('word')) startIndex = 1;
          for (let i = startIndex; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (!cols.length) continue;
            const word = (cols[0] || '').trim();
            if (!word) continue;
            const category = (cols[1] || '').trim() || null;
            const level = (cols[2] || '').trim().toLowerCase() || null;
            entries.push({ word: word.toUpperCase(), category, level, createdAt: new Date() });
          }
        } else {
          const flat = raw.split(',').map(w => w.trim()).filter(w => w.length > 0);
          entries = flat.map(w => ({ word: w.toUpperCase(), category: null, level: null, createdAt: new Date() }));
        }
        if (entries.length > 0) {
          const bulk = db.collection('words').initializeUnorderedBulkOp();
          entries.forEach(e => bulk.find({ word: e.word }).upsert().updateOne({ $setOnInsert: e }));
          const res = await bulk.execute();
          seeded = res.nUpserted || 0;
        }
      }

      if (seeded === 0) {
        console.log('No backup found or empty. Seeding default minimal words...');
        const defaults = ['ТЕСТ', 'СЛОВО', 'ИГРА', 'ШЛЯПА'].map(w => ({ word: w, category: null, level: 'обычный', createdAt: new Date() }));
        await db.collection('words').insertMany(defaults);
        seeded = defaults.length;
      }
      console.log(`Words seeded: ${seeded}`);
    }

    server = app.listen(PORT, () => {
      console.log(`Сервер запущен на http://localhost:${PORT}`);
    });

    // Инициализация репозиториев через фабрику
    const wordRepository = repositoryFactory.createWordRepository();
    const gameRepository = repositoryFactory.createGameRepository();
    const statsRepository = repositoryFactory.createStatsRepository();

    // Инициализация WebSocket обработчика
    webSocketHandler = new WebSocketHandler(server, null);

    // Инициализация сервисов
    gameService = new GameService(wordRepository, gameRepository, webSocketHandler);
    statsService = new StatsService(statsRepository, webSocketHandler);
    webSocketHandler.statsService = statsService;
    gameService.statsService = statsService;
    webSocketHandler.gameService = gameService;

    // Выводим информацию о конфигурации
    console.log('🔧 Конфигурация репозиториев:', repositoryFactory.getConfigurationInfo());
  } catch (err) {
    console.error('Failed to initialize application:', err.message);
    process.exit(1);
  }
})();
// Простейшие API для чтения статистики
app.get('/api/stats/player/:playerKey', async (req, res) => {
  try {
    const data = await statsService.getPlayerStats(req.params.playerKey);
    if (!data) return res.status(404).json({ error: 'not_found' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/api/stats/leaderboard/:metric', async (req, res) => {
  try {
    const data = await statsService.getLeaderboard(req.params.metric);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'internal_error' });
  }
});

// В новой модели сессии в Mongo нет эпхемерного снапшота; можно удалить эндпоинт или отдавать финальные данные игры из коллекции games
app.get('/api/stats/session/:gameId', async (req, res) => {
  try {
    const game = await gameRepository.loadGame(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'not_found' });
    res.json(game);
  } catch (e) {
    res.status(500).json({ error: 'internal_error' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Завершение работы сервера...');
  
  // Закрываем WebSocket соединения
  webSocketHandler.close();
  
  // Закрываем подключение к MongoDB
  try {
    await mongoConnection.disconnect();
  } catch (error) {
    console.error('Ошибка отключения от MongoDB:', error.message);
  }
  
  // Закрываем HTTP сервер
  server.close(() => {
    console.log('HTTP сервер остановлен');
    process.exit(0);
  });
  
  // Принудительное завершение через 5 секунд, если сервер не закрылся
  setTimeout(() => {
    console.log('Принудительное завершение работы...');
    process.exit(1);
  }, 5000);
});
