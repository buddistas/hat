const Game = require('../../src/entities/Game');
const Player = require('../../src/entities/Player');
const Team = require('../../src/entities/Team');

describe('Simple Integration Tests', () => {
  test('should create and initialize game correctly', () => {
    const game = new Game();
    
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

    game.initialize(players, teams, { wordsCount: 10 });
    game.setSelectedWords(['word1', 'word2', 'word3', 'word4', 'word5']);
    game.initializeTurnOrder();
    game.getNextWord();

    expect(game.players).toHaveLength(4);
    expect(game.teams).toHaveLength(2);
    expect(game.selectedWords).toHaveLength(5);
    expect(game.currentWord).toBeDefined();
    expect(game.currentPlayer).toBeDefined();
  });

  test('should handle complete game flow', () => {
    const game = new Game();
    
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1'] },
      { id: 'team2', name: 'Team 2', players: ['2'] }
    ];

    // Инициализация игры
    game.initialize(players, teams);
    game.setSelectedWords(['word1', 'word2', 'word3']);
    game.initializeTurnOrder();
    game.getNextWord();

    expect(game.currentWord).toBe('word1');
    expect(game.scores.team1).toBe(0);

    // Угадываем слово
    const roundFinished = game.wordGuessed('team1');
    expect(game.scores.team1).toBe(1);
    expect(game.availableWords).toHaveLength(2);
    expect(roundFinished).toBe(false);

    // Пропускаем слово
    game.wordPassed('team1');
    expect(game.scores.team1).toBe(0);
  // теперь слово остается в available (в конце) и копируется в личный missed
  expect(game.availableWords).toHaveLength(2);
    expect(game.passedWords).toHaveLength(1);

    // Угадываем все оставшиеся слова
    game.wordGuessed('team1');
    game.wordGuessed('team1');

    // Раунд должен завершиться
    expect(game.currentWord).toBeNull();
    expect(game.availableWords).toHaveLength(0);

    // Начинаем следующий раунд
    const gameFinished = game.startNextRound();
    expect(game.currentRound).toBe(1);
    expect(gameFinished).toBe(false);
    expect(game.availableWords).toHaveLength(3);
    expect(game.usedWords).toHaveLength(0);
  });

  test('should handle turn management correctly', () => {
    const game = new Game();
    
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1'] },
      { id: 'team2', name: 'Team 2', players: ['2'] }
    ];

    game.initialize(players, teams);
    game.initializeTurnOrder();

    const initialPlayer = game.currentPlayer;
    expect(initialPlayer).toBeDefined();

    // Завершаем ход игрока
    game.endPlayerTurn(10);
    if (initialPlayer) {
      expect(game.playerCarriedTime[initialPlayer.id]).toBe(10);
    }
    expect(game.isHandoffScreen).toBe(true);
    expect(game.nextPlayer).toBeDefined();

    // Начинаем ход следующего игрока
    game.startNextPlayerTurn();
    expect(game.currentPlayer).not.toEqual(initialPlayer);
    expect(game.nextPlayer).toBeNull();
    expect(game.isHandoffScreen).toBe(false);
  });

  test('should handle game completion after 3 rounds', () => {
    const game = new Game();
    
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1'] },
      { id: 'team2', name: 'Team 2', players: ['2'] }
    ];

    game.initialize(players, teams);
    game.setSelectedWords(['word1', 'word2']);

    // Завершаем 3 раунда
    for (let round = 0; round < 3; round++) {
      game.startNextRound();
      expect(game.currentRound).toBe(round + 1);
    }

    // Начинаем 4-й раунд (игра должна завершиться)
    const gameFinished = game.startNextRound();
    expect(gameFinished).toBe(true);
    expect(game.currentRound).toBe(4);
    expect(game.currentWord).toBeNull();
    expect(game.playerCarriedTime).toEqual({});
  });
});
