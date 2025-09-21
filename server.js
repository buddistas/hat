const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Раздача статических файлов
app.use(express.static('public'));

// Функция нормализации слова согласно плану проекта
function normalizeWord(word) {
  return word
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/[.,!?:;"'()\-–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Функция проверки дубликатов в словаре
function checkForDuplicates(wordList) {
  const duplicates = [];
  const seen = new Set();
  const normalizedSeen = new Set();
  
  wordList.forEach((word, index) => {
    const normalized = normalizeWord(word);
    
    // Проверка точных дубликатов
    if (seen.has(word)) {
      duplicates.push({
        type: 'exact',
        word: word,
        index: index,
        message: `Точный дубликат слова "${word}"`
      });
    }
    
    // Проверка нормализованных дубликатов
    if (normalizedSeen.has(normalized)) {
      duplicates.push({
        type: 'normalized',
        word: word,
        normalized: normalized,
        index: index,
        message: `Нормализованный дубликат: "${word}" → "${normalized}"`
      });
    }
    
    seen.add(word);
    normalizedSeen.add(normalized);
  });
  
  return duplicates;
}

// Загрузка словаря
let words = [];
try {
  const wordsData = fs.readFileSync(path.join(__dirname, 'public', 'words.csv'), 'utf8');
  words = wordsData.split(',').map(word => word.trim()).filter(word => word.length > 0);
  
  // Проверка на дубликаты при загрузке
  const duplicates = checkForDuplicates(words);
  if (duplicates.length > 0) {
    console.warn(`⚠️  Найдены дубликаты в словаре (${duplicates.length}):`);
    duplicates.forEach(dup => {
      console.warn(`   ${dup.message}`);
    });
  } else {
    console.log(`✅ Словарь загружен без дубликатов: ${words.length} уникальных слов`);
  }
} catch (error) {
  console.error('Ошибка загрузки словаря:', error.message);
  words = ['тест', 'слово', 'игра', 'шляпа']; // Fallback слова
}

// Создание HTTP сервера
const server = app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});

// Создание WebSocket сервера
const wss = new WebSocket.Server({ server });

// Состояние игры
let gameState = {
  players: [],
  teams: [],
  currentRound: 0,
  currentPlayer: null,
  currentWord: null,
  usedWords: [],
  selectedWords: [],
  availableWords: [],
  passedWords: [], // Список пропущенных слов для статистики
  isPaused: false,
  scores: {},
  roundDuration: 60,
  // Очередность ходов (формируется один раз при старте игры)
  turnOrder: {
    teams: [], // Порядок команд
    playersByTeam: {}, // Порядок игроков внутри каждой команды
    currentTeamIndex: 0,
    currentPlayerIndex: 0
  },
  // Состояние передачи хода
  isHandoffScreen: false,
  nextPlayer: null,
  // Перенесенное время для каждого игрока
  playerCarriedTime: {}
};

// WebSocket обработчики
wss.on('connection', (ws) => {
  console.log('Новое WebSocket подключение');
  
  // Отправка текущего состояния игры новому клиенту
  ws.send(JSON.stringify({
    type: 'game_state',
    data: gameState
  }));

  ws.on('message', (message) => {
    try {
      const event = JSON.parse(message);
      console.log('Получено событие:', event.type);
      
      handleGameEvent(ws, event);
    } catch (error) {
      console.error('Ошибка парсинга сообщения:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Неверный формат сообщения'
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket подключение закрыто');
  });
});

// Обработка игровых событий
function handleGameEvent(ws, event) {
  switch (event.type) {
    case 'start_game':
      startGame(event.data);
      broadcastGameState();
      break;
      
    case 'next_word':
      nextWord();
      broadcastGameState();
      break;
      
    case 'word_guessed':
      wordGuessed(event.data);
      broadcastGameState();
      break;
      
    case 'word_passed':
      wordPassed(event.data);
      broadcastGameState();
      break;
      
    case 'pause_game':
      pauseGame();
      broadcastGameState();
      break;
      
    case 'resume_game':
      resumeGame();
      broadcastGameState();
      break;
      
    case 'end_round':
      endRound(event.data);
      broadcastGameState();
      break;
      
    case 'continue_round':
      startNextRound();
      // broadcastGameState() вызывается внутри startNextRound после установки currentWord
      break;
      
    case 'time_up':
      endPlayerTurn(event.data);
      broadcastGameState();
      break;
      
    case 'start_next_turn':
      startNextPlayerTurn();
      break;
      
    case 'round_completed_carried_time':
      // Сохраняем перенесенное время для текущего игрока
      if (gameState.currentPlayer && event.data.carriedTime !== undefined) {
        gameState.playerCarriedTime[gameState.currentPlayer.id] = event.data.carriedTime;
        console.log(`Сохранено перенесенное время ${event.data.carriedTime}с для игрока ${gameState.currentPlayer.name} после завершения раунда`);
      }
      break;
      
    case 'carried_time_used':
      // Сбрасываем перенесенное время для текущего игрока после использования
      if (gameState.currentPlayer && gameState.playerCarriedTime[gameState.currentPlayer.id]) {
        console.log(`Сброшено перенесенное время ${event.data.carriedTime}с для игрока ${gameState.currentPlayer.name} после использования`);
        delete gameState.playerCarriedTime[gameState.currentPlayer.id];
      }
      break;
      
    default:
      console.log('Неизвестное событие:', event.type);
  }
}

// Игровые функции
function startGame(data) {
  gameState.players = data.players || [];
  gameState.teams = data.teams || [];
  gameState.currentRound = 0;
  gameState.usedWords = [];
  gameState.passedWords = []; // Инициализация списка пропущенных слов
  gameState.scores = {};
  gameState.roundDuration = data.roundDuration || 60;
  gameState.isHandoffScreen = false;
  gameState.nextPlayer = null;
  
  // Настройка количества слов
  const wordsCount = data.wordsCount || 100;
  gameState.selectedWords = selectRandomWords(wordsCount);
  gameState.availableWords = [...gameState.selectedWords];
  
  // Перемешиваем слова при старте игры
  shuffleAvailableWords();
  
  // Инициализация счетов команд
  gameState.teams.forEach(team => {
    gameState.scores[team.id] = 0;
  });
  
  // Инициализация очереди ходов
  initializeTurnOrder();
  
  // Выбор первого игрока из очереди ходов
  if (gameState.turnOrder.teams.length > 0) {
    const firstTeam = gameState.turnOrder.teams[0];
    const firstTeamPlayers = gameState.turnOrder.playersByTeam[firstTeam.id];
    if (firstTeamPlayers.length > 0) {
      gameState.currentPlayer = firstTeamPlayers[0];
    }
  }
  
  console.log(`Игра начата с ${gameState.selectedWords.length} словами`);
  nextWord();
}

function selectRandomWords(count) {
  // Валидация количества слов
  const minWords = 20;
  const maxWords = 200;
  const validCount = Math.max(minWords, Math.min(maxWords, count));
  
  if (validCount > words.length) {
    console.warn(`Запрошено ${validCount} слов, но в словаре только ${words.length}. Используем все доступные слова.`);
    return [...words];
  }
  
  // Случайный выбор слов
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, validCount);
}

// Функция инициализации очереди ходов
function initializeTurnOrder() {
  // Случайный порядок команд
  const shuffledTeams = [...gameState.teams].sort(() => Math.random() - 0.5);
  gameState.turnOrder.teams = shuffledTeams;
  gameState.turnOrder.currentTeamIndex = 0;
  gameState.turnOrder.currentPlayerIndex = 0;
  
  // Случайный порядок игроков внутри каждой команды
  gameState.turnOrder.playersByTeam = {};
  gameState.teams.forEach(team => {
    const teamPlayers = gameState.players.filter(player => 
      team.players && team.players.includes(player.id)
    );
    // Перемешиваем игроков внутри команды
    const shuffledPlayers = [...teamPlayers].sort(() => Math.random() - 0.5);
    gameState.turnOrder.playersByTeam[team.id] = shuffledPlayers;
  });
  
  console.log('Очередность ходов инициализирована:');
  console.log('Порядок команд:', gameState.turnOrder.teams.map(t => t.name));
  gameState.teams.forEach(team => {
    console.log(`Игроки команды ${team.name}:`, 
      gameState.turnOrder.playersByTeam[team.id].map(p => p.name));
  });
}

function nextWord() {
  // Проверяем, есть ли еще слова в пуле
  if (!gameState.availableWords || gameState.availableWords.length === 0) {
    console.log('Слова закончились, завершаем раунд');
    gameState.currentWord = null;
    endRound();
    return;
  }
  
  // Берем первое слово из списка (после перемешивания порядок будет случайным)
  gameState.currentWord = gameState.availableWords[0];
  
  // НЕ удаляем слово из пула - оно остается до угадывания
  // Слово будет удалено только в функции wordGuessed()
  
  console.log(`Показано слово: ${gameState.currentWord}, осталось слов: ${gameState.availableWords.length}`);
}

function wordGuessed(data) {
  if (gameState.currentWord && data.teamId) {
    gameState.scores[data.teamId] = (gameState.scores[data.teamId] || 0) + 1;
    
    // Удаляем угаданное слово из пула
    const guessedWord = gameState.currentWord;
    const wordIndex = gameState.availableWords.indexOf(guessedWord);
    if (wordIndex !== -1) {
      gameState.availableWords.splice(wordIndex, 1);
    }
    
    // Добавляем в список использованных слов для статистики
    gameState.usedWords.push(guessedWord);
    
    console.log(`Слово "${guessedWord}" угадано и удалено из пула. Осталось слов: ${gameState.availableWords.length}`);
    
    nextWord();
    // Игрок продолжает свой ход до истечения таймера
  }
}

function wordPassed(data) {
  if (gameState.currentWord && data.teamId) {
    gameState.scores[data.teamId] = (gameState.scores[data.teamId] || 0) - 1;
    
    // Перемещаем пропущенное слово в конец очереди availableWords
    const currentWord = gameState.currentWord;
    const wordIndex = gameState.availableWords.indexOf(currentWord);
    if (wordIndex !== -1) {
      // Удаляем слово из текущей позиции
      gameState.availableWords.splice(wordIndex, 1);
      // Добавляем в конец очереди
      gameState.availableWords.push(currentWord);
    }
    
    // Добавляем в список пропущенных слов для статистики
    gameState.passedWords.push({
      word: currentWord,
      player: gameState.currentPlayer,
      team: data.teamId,
      timestamp: Date.now()
    });
    
    console.log(`Слово "${currentWord}" пропущено игроком ${gameState.currentPlayer?.name} и перемещено в конец очереди. Осталось слов: ${gameState.availableWords.length}`);
    
    // Переходим к следующему слову
    nextWord();
    // Игрок продолжает свой ход до истечения таймера
  }
}

// Функция для переключения хода к следующему игроку
function switchToNextPlayer() {
  if (!gameState.turnOrder.teams || gameState.turnOrder.teams.length === 0) return;
  
  // Переходим к следующей команде
  gameState.turnOrder.currentTeamIndex = (gameState.turnOrder.currentTeamIndex + 1) % gameState.turnOrder.teams.length;
  
  // Если мы вернулись к первой команде, значит прошел полный цикл команд
  // и нужно перейти к следующему игроку
  if (gameState.turnOrder.currentTeamIndex === 0) {
    gameState.turnOrder.currentPlayerIndex++;
  }
  
  // Получаем текущую команду
  const currentTeam = gameState.turnOrder.teams[gameState.turnOrder.currentTeamIndex];
  const currentTeamPlayers = gameState.turnOrder.playersByTeam[currentTeam.id];
  
  // Если индекс игрока превышает количество игроков в команде, сбрасываем его
  if (gameState.turnOrder.currentPlayerIndex >= currentTeamPlayers.length) {
    gameState.turnOrder.currentPlayerIndex = 0;
  }
  
  const nextPlayer = currentTeamPlayers[gameState.turnOrder.currentPlayerIndex];
  gameState.nextPlayer = nextPlayer;
  
  console.log(`Следующий игрок: ${nextPlayer.name} из команды ${currentTeam.name}`);
}

// Функция для случайного перемешивания доступных слов
function shuffleAvailableWords() {
  if (gameState.availableWords && gameState.availableWords.length > 0) {
    // Используем алгоритм Fisher-Yates для перемешивания
    for (let i = gameState.availableWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gameState.availableWords[i], gameState.availableWords[j]] = 
      [gameState.availableWords[j], gameState.availableWords[i]];
    }
    console.log('Слова перемешаны при смене игрока');
  }
}

// Функция для окончания хода игрока
function endPlayerTurn(data = {}) {
  console.log(`Ход игрока ${gameState.currentPlayer ? gameState.currentPlayer.name : 'неизвестного'} завершен`);
  
  // Сохраняем перенесенное время для текущего игрока, если оно передано
  if (gameState.currentPlayer && data.carriedTime !== undefined) {
    gameState.playerCarriedTime[gameState.currentPlayer.id] = data.carriedTime;
    console.log(`Сохранено перенесенное время ${data.carriedTime}с для игрока ${gameState.currentPlayer.name}`);
  }
  
  // Переключаем ход к следующему игроку
  switchToNextPlayer();
  
  // Показываем экран передачи хода
  showHandoffScreen();
}


// Функция для показа экрана передачи хода
function showHandoffScreen() {
  gameState.isHandoffScreen = true;
  
  // Отправляем событие для показа экрана передачи хода
  const message = JSON.stringify({
    type: 'handoff_screen',
    data: {
      nextPlayer: gameState.nextPlayer,
      currentRound: gameState.currentRound
    }
  });
  
  console.log('Отправляем событие handoff_screen:', message);
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Функция для начала хода следующего игрока
function startNextPlayerTurn() {
  if (!gameState.nextPlayer) return;
  
  // Устанавливаем следующего игрока как текущего
  gameState.currentPlayer = gameState.nextPlayer;
  gameState.nextPlayer = null;
  gameState.isHandoffScreen = false;
  
  // Сбрасываем состояние для нового хода
  
  // Перемешиваем слова при смене игрока
  shuffleAvailableWords();
  
  // Выбираем первое слово для нового хода только если нет текущего слова
  // (если предыдущий игрок не угадал слово, оно остается в пуле)
  if (!gameState.currentWord) {
    nextWord();
  }
  
  console.log(`Начался ход игрока: ${gameState.currentPlayer.name}`);
  
  // Отправляем обновленное состояние игры
  broadcastGameState();
}

function pauseGame() {
  gameState.isPaused = true;
}

function resumeGame() {
  gameState.isPaused = false;
}

function endRound(data = {}) {
  // Сохраняем перенесенное время для текущего игрока, если оно передано
  if (gameState.currentPlayer && data.carriedTime !== undefined) {
    gameState.playerCarriedTime[gameState.currentPlayer.id] = data.carriedTime;
    console.log(`Сохранено перенесенное время ${data.carriedTime}с для игрока ${gameState.currentPlayer.name} при завершении раунда`);
  }
  
  // Показываем результаты раунда
  showRoundResults();
  console.log(`Раунд ${gameState.currentRound + 1} завершен`);
}

function startNextRound() {
  gameState.currentRound++;
  
  if (gameState.currentRound > 3) {
    // Игра завершена
    gameState.currentWord = null;
    console.log('Игра завершена');
  } else {
    // Сброс использованных слов для нового раунда
    gameState.usedWords = [];
    // Сброс списка пропущенных слов для нового раунда
    gameState.passedWords = [];
    // Восстанавливаем полный список слов для нового раунда
    gameState.availableWords = [...gameState.selectedWords];
    // Перемешиваем слова для нового раунда
    shuffleAvailableWords();
    
    // Сброс состояния для нового раунда
    
    // Выбираем первое слово нового раунда
    nextWord();
    
    console.log(`Начался раунд ${gameState.currentRound} с ${gameState.availableWords.length} словами`);
    
    // Отправляем обновленное состояние игры с carriedTime
    broadcastGameState();
  }
}

function showRoundResults() {
  // Отправляем событие для показа результатов раунда
  const message = JSON.stringify({
    type: 'round_completed',
    data: {
      currentRound: gameState.currentRound,
      scores: gameState.scores
    }
  });
  
  console.log('Отправляем событие round_completed:', message);
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Отправка состояния всем подключенным клиентам
function broadcastGameState() {
  // Не отправляем game_state если раунд завершен (currentWord === null) или показывается экран передачи хода
  if (gameState.currentWord === null || gameState.isHandoffScreen) {
    console.log('Пропускаем broadcastGameState - раунд завершен или показывается экран передачи хода');
    return;
  }
  
  const message = JSON.stringify({
    type: 'game_state',
    data: gameState
  });
  
  // Отладочная информация
  console.log('Отправляем game_state с playerCarriedTime:', gameState.playerCarriedTime);
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Завершение работы сервера...');
  
  // Закрываем все WebSocket соединения
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });
  
  // Закрываем WebSocket сервер
  wss.close(() => {
    console.log('WebSocket сервер закрыт');
  });
  
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
