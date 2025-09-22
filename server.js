const express = require('express');
const path = require('path');

// Импорт наших классов
const WordFileRepository = require('./src/infrastructure/WordFileRepository');
const InMemoryGameRepository = require('./src/infrastructure/InMemoryGameRepository');
const GameService = require('./src/infrastructure/GameService');
const WebSocketHandler = require('./src/infrastructure/WebSocketHandler');

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

// Инициализация WebSocket обработчика
const webSocketHandler = new WebSocketHandler(server, null);

// Инициализация игрового сервиса
const gameService = new GameService(wordRepository, gameRepository, webSocketHandler);

// Устанавливаем gameService в WebSocketHandler
webSocketHandler.gameService = gameService;

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
