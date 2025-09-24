const WordFileRepository = require('../../src/infrastructure/WordFileRepository');
const InMemoryGameRepository = require('../../src/infrastructure/InMemoryGameRepository');
const GameService = require('../../src/infrastructure/GameService');
const path = require('path');

// Мок для WebSocketHandler
class MockWebSocketHandler {
  constructor() {
    this.broadcastedMessages = [];
  }

  broadcastGameState() {
    this.broadcastedMessages.push({ type: 'game_state' });
  }

  broadcastRoundCompleted(roundNumber, scores) {
    this.broadcastedMessages.push({ type: 'round_completed', roundNumber, scores });
  }

  broadcastGameEnded(gameState) {
    this.broadcastedMessages.push({ type: 'game_ended', gameState });
  }

  broadcastHandoffScreen(nextPlayer, currentRound) {
    this.broadcastedMessages.push({ type: 'handoff_screen', nextPlayer, currentRound });
  }
}

describe('Game Integration Tests', () => {
  let wordRepository;
  let gameRepository;
  let webSocketHandler;
  let gameService;

  beforeEach(() => {
    // Используем реальный WordFileRepository с тестовым файлом
    wordRepository = new WordFileRepository(path.join(__dirname, '../../public/words.csv'));
    gameRepository = new InMemoryGameRepository();
    webSocketHandler = new MockWebSocketHandler();
    gameService = new GameService(wordRepository, gameRepository, webSocketHandler);
  });

  test('should start game successfully', async () => {
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team1' },
      { id: '3', name: 'Player 3', teamId: 'team2' },
      { id: '4', name: 'Player 4', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1', '2'] },
      { id: 'team2', name: 'Team 2', players: ['3', '4'] }
    ];

    const result = await gameService.handleEvent({
      type: 'start_game',
      data: { players, teams, options: { wordsCount: 10 } }
    });

    expect(result).toBe(true);
    expect(gameService.getGameState()).toBeDefined();
    expect(gameService.getGameState().players).toHaveLength(4);
    expect(gameService.getGameState().teams).toHaveLength(2);
    expect(gameService.getGameState().selectedWords).toHaveLength(10);
    expect(gameService.getGameState().currentWord).toBeDefined();
  });

  test('should handle word guessed correctly', async () => {
    // Сначала начинаем игру
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1'] },
      { id: 'team2', name: 'Team 2', players: ['2'] }
    ];

    await gameService.handleEvent({
      type: 'start_game',
      data: { players, teams, options: { wordsCount: 5 } }
    });

    const gameState = gameService.getGameState();
    const initialScore = gameState.scores.team1;
    const guessedWord = gameState.currentWord; // capture before mutating events

    // Угадываем слово
    const result = await gameService.handleEvent({
      type: 'word_guessed',
      data: { teamId: 'team1' }
    });

    expect(result).toBe(true);
    const updatedGameState = gameService.getGameState();
    expect(updatedGameState.scores.team1).toBe(initialScore + 1);
    expect(updatedGameState.availableWords).toHaveLength(4);
    expect(updatedGameState.usedWords).toContain(guessedWord);
  });

  test('should handle word passed correctly', async () => {
    // Сначала начинаем игру
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1'] },
      { id: 'team2', name: 'Team 2', players: ['2'] }
    ];

    await gameService.handleEvent({
      type: 'start_game',
      data: { players, teams, options: { wordsCount: 5 } }
    });

    const gameState = gameService.getGameState();
    const initialScore = gameState.scores.team1;
    const initialPassedWords = gameState.passedWords.length;

    // Пропускаем слово
    const result = await gameService.handleEvent({
      type: 'word_passed',
      data: { teamId: 'team1' }
    });

    expect(result).toBe(true);
    const updatedGameState = gameService.getGameState();
    expect(updatedGameState.scores.team1).toBe(initialScore - 1);
    // В новой логике слово остается в available (переносится в конец) и копируется в личный missed
    expect(updatedGameState.availableWords).toHaveLength(5);
    expect(updatedGameState.passedWords).toHaveLength(initialPassedWords + 1);
  });

  test('should handle turn management correctly', async () => {
    // Сначала начинаем игру
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1'] },
      { id: 'team2', name: 'Team 2', players: ['2'] }
    ];

    await gameService.handleEvent({
      type: 'start_game',
      data: { players, teams, options: { wordsCount: 5 } }
    });

    const initialGameState = gameService.getGameState();
    const initialPlayer = initialGameState.currentPlayer;

    // Завершаем ход игрока
    const result = await gameService.handleEvent({
      type: 'time_up',
      data: { carriedTime: 10 }
    });

    expect(result).toBe(false); // Не отправляем game_state
    expect(webSocketHandler.broadcastedMessages).toContainEqual(
      expect.objectContaining({ type: 'handoff_screen' })
    );

    // Начинаем ход следующего игрока
    const nextTurnResult = await gameService.handleEvent({
      type: 'start_next_turn'
    });

    expect(nextTurnResult).toBe(true);
    const updatedGameState = gameService.getGameState();
    expect(updatedGameState.currentPlayer).not.toEqual(initialPlayer);
    expect(updatedGameState.isHandoffScreen).toBe(false);
  });

  test('should handle round completion correctly', async () => {
    // Сначала начинаем игру
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1'] },
      { id: 'team2', name: 'Team 2', players: ['2'] }
    ];

    await gameService.handleEvent({
      type: 'start_game',
      data: { players, teams, options: { wordsCount: 2 } }
    });

    // Угадываем все слова
    await gameService.handleEvent({
      type: 'word_guessed',
      data: { teamId: 'team1' }
    });

    await gameService.handleEvent({
      type: 'word_guessed',
      data: { teamId: 'team1' }
    });

    // Завершаем раунд
    const result = await gameService.handleEvent({
      type: 'end_round',
      data: { carriedTime: 5 }
    });

    expect(result).toBe(false); // Не отправляем game_state
    expect(webSocketHandler.broadcastedMessages).toContainEqual(
      expect.objectContaining({ type: 'round_completed' })
    );

    // Продолжаем следующий раунд
    const nextRoundResult = await gameService.handleEvent({
      type: 'continue_round'
    });

    expect(nextRoundResult).toBe(true);
    const updatedGameState = gameService.getGameState();
    expect(updatedGameState.currentRound).toBe(1);
    expect(updatedGameState.availableWords).toHaveLength(2);
  });

  test('should handle game completion after 3 rounds', async () => {
    // Сначала начинаем игру
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1'] },
      { id: 'team2', name: 'Team 2', players: ['2'] }
    ];

    await gameService.handleEvent({
      type: 'start_game',
      data: { players, teams, options: { wordsCount: 2 } }
    });

    // Завершаем 3 раунда
    for (let round = 0; round < 3; round++) {
      // Угадываем все слова в раунде
      await gameService.handleEvent({
        type: 'word_guessed',
        data: { teamId: 'team1' }
      });

      await gameService.handleEvent({
        type: 'word_guessed',
        data: { teamId: 'team1' }
      });

      // Завершаем раунд
      await gameService.handleEvent({
        type: 'end_round',
        data: { carriedTime: 5 }
      });

      // Продолжаем следующий раунд (кроме последнего)
      if (round < 2) {
        await gameService.handleEvent({
          type: 'continue_round'
        });
      }
    }

    // Начинаем 4-й раунд (игра должна завершиться): нужно два шага, чтобы дойти до >3
    await gameService.handleEvent({ type: 'continue_round' }); // to round 3
    const result = await gameService.handleEvent({ type: 'continue_round' }); // to round 4 => end

    expect(result).toBe(true);
    expect(webSocketHandler.broadcastedMessages).toContainEqual(
      expect.objectContaining({ type: 'game_ended' })
    );

    const finalGameState = gameService.getGameState();
    expect(finalGameState.currentRound).toBe(4);
    expect(finalGameState.currentWord).toBeNull();
  });
});
