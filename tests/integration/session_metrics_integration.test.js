const GameService = require('../../src/infrastructure/GameService');
const WordFileRepository = require('../../src/infrastructure/WordFileRepository');
const InMemoryGameRepository = require('../../src/infrastructure/InMemoryGameRepository');
const WebSocketHandler = require('../../src/infrastructure/WebSocketHandler');
const FileStatsRepository = require('../../src/infrastructure/FileStatsRepository');
const path = require('path');
const fs = require('fs');

describe('Session Metrics Integration Tests', () => {
  const tmpDir = path.join(__dirname, '../../public/stats_integration_test');
  let gameService;
  let statsService;
  let webSocketHandler;

  beforeAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    
    const wordRepo = new WordFileRepository('public/words.csv');
    const gameRepo = new InMemoryGameRepository();
    const statsRepo = new FileStatsRepository(tmpDir);
    
    statsService = new (require('../../src/infrastructure/StatsService'))(statsRepo, null);
    
    // Создаем мок WebSocketHandler для тестов
    webSocketHandler = {
      statsService: statsService,
      broadcastGameState: jest.fn(),
      broadcastRoundCompleted: jest.fn(),
      broadcastGameEnded: jest.fn(),
      broadcastHandoffScreen: jest.fn()
    };
    gameService = new GameService(wordRepo, gameRepo, webSocketHandler);
  });

  beforeEach(async () => {
    await gameService.clearGame();
  });

  test('tracks session metrics through complete game flow', async () => {
    // Начинаем игру
    const startGameData = {
      players: [
        { id: 'p1', name: 'Игрок1', teamId: 't1' },
        { id: 'p2', name: 'Игрок2', teamId: 't2' }
      ],
      teams: [
        { id: 't1', name: 'Команда1', players: ['p1'] },
        { id: 't2', name: 'Команда2', players: ['p2'] }
      ],
      options: { roundDuration: 30 }
    };

    await gameService.handleEvent({ type: 'start_game', data: startGameData });
    
    // Начинаем ход первого игрока
    await gameService.handleEvent({ type: 'start_next_turn' });
    
    // Получаем слово
    gameService.handleEvent({ type: 'next_word' });
    let gameState = gameService.getGameState();
    const firstWord = gameState.currentWord;
    
    // Пропускаем слово
    await gameService.handleEvent({ type: 'word_passed', data: {} });
    
    // Получаем следующее слово
    gameService.handleEvent({ type: 'next_word' });
    gameState = gameService.getGameState();
    const secondWord = gameState.currentWord;
    
    // Угадываем слово
    await gameService.handleEvent({ type: 'word_guessed', data: {} });
    
    // Получаем третье слово
    gameService.handleEvent({ type: 'next_word' });
    gameState = gameService.getGameState();
    const thirdWord = gameState.currentWord;
    
    // Пропускаем третье слово
    await gameService.handleEvent({ type: 'word_passed', data: {} });
    
    // Завершаем ход
    await gameService.handleEvent({ type: 'time_up', data: { timerRemainingAtShow: 5 } });
    
    // Завершаем раунд
    gameService.handleEvent({ type: 'end_round', data: {} });
    
    // Завершаем игру
    await gameService.handleEvent({ type: 'continue_round' });
    
    // Проверяем статистику сессии
    const sessionStats = statsService.getSessionSnapshot();
    
    // Проверяем отслеживание пропущенных слов
    expect(sessionStats.wordTracking.passedWords[firstWord]).toBe(2); // Слово пропускается 2 раза
    expect(sessionStats.wordTracking.passedWords[thirdWord]).toBe(2); // Тоже пропускается 2 раза
    // Проверяем, что есть пропущенные слова
    expect(Object.keys(sessionStats.wordTracking.passedWords).length).toBeGreaterThan(0);
    
    // Проверяем отслеживание времени показа слов
    expect(sessionStats.wordTracking.wordDisplayTime[firstWord]).toBeGreaterThan(0);
    expect(sessionStats.wordTracking.wordDisplayTime[secondWord]).toBeGreaterThan(0);
    expect(sessionStats.wordTracking.wordDisplayTime[thirdWord]).toBeGreaterThan(0);
    expect(sessionStats.facts.hardestWord).toBeDefined();
    expect(sessionStats.facts.hardestWord.totalTimeSeconds).toBeGreaterThan(0);
    
    // Проверяем продолжительность раунда
    expect(sessionStats.duration.roundDurations[0]).toBeGreaterThan(0);
    expect(sessionStats.duration.totalGameDuration).toBeGreaterThan(0);
  });

  test('handles multiple rounds with different metrics', async () => {
    // Начинаем игру
    const startGameData = {
      players: [
        { id: 'p1', name: 'Игрок1', teamId: 't1' },
        { id: 'p2', name: 'Игрок2', teamId: 't2' }
      ],
      teams: [
        { id: 't1', name: 'Команда1', players: ['p1'] },
        { id: 't2', name: 'Команда2', players: ['p2'] }
      ],
      options: { roundDuration: 30 }
    };

    await gameService.handleEvent({ type: 'start_game', data: startGameData });
    
    // Раунд 0
    await gameService.handleEvent({ type: 'start_next_turn' });
    gameService.handleEvent({ type: 'next_word' });
    await gameService.handleEvent({ type: 'word_guessed', data: {} });
    await gameService.handleEvent({ type: 'time_up', data: { timerRemainingAtShow: 10 } });
    gameService.handleEvent({ type: 'end_round', data: {} });
    
    // Раунд 1
    await gameService.handleEvent({ type: 'continue_round' });
    await gameService.handleEvent({ type: 'start_next_turn' });
    gameService.handleEvent({ type: 'next_word' });
    await gameService.handleEvent({ type: 'word_passed', data: {} });
    await gameService.handleEvent({ type: 'time_up', data: { timerRemainingAtShow: 5 } });
    gameService.handleEvent({ type: 'end_round', data: {} });
    
    // Раунд 2
    await gameService.handleEvent({ type: 'continue_round' });
    await gameService.handleEvent({ type: 'start_next_turn' });
    gameService.handleEvent({ type: 'next_word' });
    await gameService.handleEvent({ type: 'word_guessed', data: {} });
    await gameService.handleEvent({ type: 'time_up', data: { timerRemainingAtShow: 15 } });
    gameService.handleEvent({ type: 'end_round', data: {} });
    
    // Завершаем игру
    await gameService.handleEvent({ type: 'continue_round' });
    
    // Проверяем статистику всех раундов
    const sessionStats = statsService.getSessionSnapshot();
    
    expect(sessionStats.duration.roundDurations[0]).toBeGreaterThanOrEqual(0);
    expect(sessionStats.duration.roundDurations[1]).toBeGreaterThanOrEqual(0);
    expect(sessionStats.duration.roundDurations[2]).toBeGreaterThanOrEqual(0);
    expect(sessionStats.duration.totalGameDuration).toBeGreaterThanOrEqual(0); // Может быть 0 если нет активного времени
    
    // Общая продолжительность должна быть суммой всех раундов
    const totalDuration = sessionStats.duration.roundDurations[0] + 
                         sessionStats.duration.roundDurations[1] + 
                         sessionStats.duration.roundDurations[2];
    expect(sessionStats.duration.totalGameDuration).toBeCloseTo(totalDuration, 1);
  });

  test('resets metrics correctly for new session', async () => {
    // Первая игра
    const startGameData = {
      players: [{ id: 'p1', name: 'Игрок1', teamId: 't1' }],
      teams: [{ id: 't1', name: 'Команда1', players: ['p1'] }],
      options: { roundDuration: 30 }
    };

    await gameService.handleEvent({ type: 'start_game', data: startGameData });
    await gameService.handleEvent({ type: 'start_next_turn' });
    gameService.handleEvent({ type: 'next_word' });
    await gameService.handleEvent({ type: 'word_passed', data: {} });
    await gameService.handleEvent({ type: 'time_up', data: { timerRemainingAtShow: 5 } });
    gameService.handleEvent({ type: 'end_round', data: {} });
    await gameService.handleEvent({ type: 'continue_round' });
    
    const firstSessionStats = statsService.getSessionSnapshot();
    expect(Object.keys(firstSessionStats.wordTracking.passedWords).length).toBeGreaterThan(0);
    
    // Вторая игра - должна быть чистой
    await gameService.handleEvent({ type: 'start_game', data: startGameData });
    const secondSessionStats = statsService.getSessionSnapshot();
    
    expect(secondSessionStats.wordTracking.passedWords).toEqual({});
    expect(secondSessionStats.wordTracking.wordDisplayTime).toEqual({});
    expect(secondSessionStats.duration.roundDurations).toEqual({ 0: 0, 1: 0, 2: 0 });
    expect(secondSessionStats.duration.totalGameDuration).toBe(0);
    expect(secondSessionStats._currentWord).toBeNull();
    expect(secondSessionStats._wordShownAt).toBeNull();
  });
});
