const express = require('express');
const path = require('path');

// Импорт наших классов
const repositoryFactory = require('./src/infrastructure/RepositoryFactory');
const GameService = require('./src/infrastructure/GameService');
const WebSocketHandler = require('./src/infrastructure/WebSocketHandler');
const StatsService = require('./src/infrastructure/StatsService');
const mongoConnection = require('./src/infrastructure/MongoConnection');

// Импорт Telegram-бота
const TelegramBotService = require('./src/telegram/TelegramBot');
const TelegramApiService = require('./src/telegram/TelegramApi');
const telegramConfig = require('./telegram-config');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware для парсинга JSON
app.use(express.json());

// Раздача статических файлов
app.use(express.static('public'));
// Serve Sound assets (mp3 files)
app.use('/Sound', express.static('Sound'));

// Создание HTTP сервера
const server = app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});

// Инициализация репозиториев через фабрику
const wordRepository = repositoryFactory.createWordRepository();
const gameRepository = repositoryFactory.createGameRepository();
const statsRepository = repositoryFactory.createStatsRepository();

// Инициализация WebSocket обработчика
const webSocketHandler = new WebSocketHandler(server, null);

// Инициализация игрового сервиса
const gameService = new GameService(wordRepository, gameRepository, webSocketHandler);
const statsService = new StatsService(statsRepository, webSocketHandler);
webSocketHandler.statsService = statsService;
gameService.statsService = statsService;

// Устанавливаем gameService в WebSocketHandler
webSocketHandler.gameService = gameService;

// Инициализация Telegram-бота
let telegramBot = null;
let telegramApi = null;

if (telegramConfig.TELEGRAM_BOT_TOKEN) {
  try {
    console.log('🔄 Инициализация Telegram-бота...');
    telegramBot = new TelegramBotService(telegramConfig.TELEGRAM_BOT_TOKEN, gameService, statsService);
    telegramApi = new TelegramApiService(gameService, statsService);
    
    // Подключаем API роуты для Telegram-бота
    app.use('/', telegramApi.getRouter());
    
    console.log('🤖 Telegram-бот инициализирован успешно');
  } catch (error) {
    console.error('❌ Ошибка инициализации Telegram-бота:', error.message);
    console.log('⚠️ Сервер будет работать без Telegram-бота');
    
    // Создаем API без бота для тестирования
    telegramApi = new TelegramApiService(gameService, statsService);
    app.use('/', telegramApi.getRouter());
  }
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN не установлен, Telegram-бот отключен');
  
  // Создаем API без бота для тестирования
  telegramApi = new TelegramApiService(gameService, statsService);
  app.use('/', telegramApi.getRouter());
}

// Выводим информацию о конфигурации
console.log('🔧 Конфигурация репозиториев:', repositoryFactory.getConfigurationInfo());
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
  console.log(`API /api/stats/session/${req.params.gameId} - запрос статистики сессии`);
  const snap = statsService.getSessionSnapshot();
  console.log('API - session snapshot:', snap);
  
  if (!snap || snap.gameId !== req.params.gameId) {
    console.log(`API - сессия не найдена. Запрошенный gameId: ${req.params.gameId}, текущий: ${snap?.gameId || 'null'}`);
    return res.status(404).json({ error: 'not_found' });
  }
  
  console.log('API - возвращаем данные сессии');
  res.json(snap);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Завершение работы сервера...');
  
  // Останавливаем Telegram-бота
  if (telegramBot) {
    try {
      telegramBot.stopPolling();
      console.log('Telegram-бот остановлен');
    } catch (error) {
      console.error('Ошибка остановки Telegram-бота:', error.message);
    }
  }
  
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
