const express = require('express');
const path = require('path');

// Импорт наших классов
const WordFileRepository = require('./src/infrastructure/WordFileRepository');
const InMemoryGameRepository = require('./src/infrastructure/InMemoryGameRepository');
const GameService = require('./src/infrastructure/GameService');
const WebSocketHandler = require('./src/infrastructure/WebSocketHandler');
const FileStatsRepository = require('./src/infrastructure/FileStatsRepository');
const StatsService = require('./src/infrastructure/StatsService');

const app = express();
const PORT = process.env.PORT || 4000;

// Раздача статических файлов
app.use(express.static('public'));
// Serve Sound assets (mp3 files)
app.use('/Sound', express.static('Sound'));

// Создание HTTP сервера
const server = app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});

// Инициализация репозиториев
const wordRepository = new WordFileRepository(path.join(__dirname, 'public', 'words.csv'));
const gameRepository = new InMemoryGameRepository();
const statsRepository = new FileStatsRepository(path.join(__dirname, 'public', 'stats'));

// Инициализация WebSocket обработчика
const webSocketHandler = new WebSocketHandler(server, null);

// Инициализация игрового сервиса
const gameService = new GameService(wordRepository, gameRepository, webSocketHandler);
const statsService = new StatsService(statsRepository, webSocketHandler);
webSocketHandler.statsService = statsService;
gameService.statsService = statsService;

// Устанавливаем gameService в WebSocketHandler
webSocketHandler.gameService = gameService;
// Простейшие API для чтения статистики
app.get('/api/stats/player/:playerKey', (req, res) => {
  const data = statsService.getPlayerStats(req.params.playerKey);
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json(data);
});

app.get('/api/stats/leaderboard/:metric', (req, res) => {
  const data = statsService.getLeaderboard(req.params.metric);
  res.json(data);
});

app.get('/api/stats/session/:gameId', (req, res) => {
  const snap = statsService.getSessionSnapshot();
  if (!snap || snap.gameId !== req.params.gameId) return res.status(404).json({ error: 'not_found' });
  res.json(snap);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Завершение работы сервера...');
  
  // Закрываем WebSocket соединения
  webSocketHandler.close();
  
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
