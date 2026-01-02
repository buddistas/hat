const EndRoundUseCase = require('../../../src/usecases/EndRoundUseCase');
const Game = require('../../../src/entities/Game');

describe('EndRoundUseCase', () => {
  let useCase;
  let game;

  beforeEach(() => {
    useCase = new EndRoundUseCase();
    game = new Game();
    
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1'] },
      { id: 'team2', name: 'Team 2', players: ['2'] }
    ];
    
    game.initialize(players, teams);
    game.setSelectedWords(['word1', 'word2', 'word3']);
    game.currentPlayer = { id: '1', name: 'Player 1', teamId: 'team1' };
    game.getNextWord();
  });

  test('should end round with carried time', () => {
    const data = { carriedTime: 15 };
    
    useCase.execute(game, data);
    
    expect(game.playerCarriedTime['1']).toBe(15);
  });

  test('should end round without carried time', () => {
    useCase.execute(game);
    
    expect(game.playerCarriedTime['1']).toBeUndefined();
  });

  test('should save carried time for current player', () => {
    const data = { carriedTime: 25 };
    
    useCase.execute(game, data);
    
    expect(game.playerCarriedTime['1']).toBe(25);
    expect(game.playerCarriedTime['2']).toBeUndefined();
  });

  test('should handle zero carried time', () => {
    const data = { carriedTime: 0 };
    
    useCase.execute(game, data);
    
    // carriedTime = 0 is saved because check is !== null, not falsy
    expect(game.playerCarriedTime['1']).toBe(0);
  });

  test('should not crash when no current player', () => {
    game.currentPlayer = null;
    const data = { carriedTime: 10 };
    
    expect(() => useCase.execute(game, data)).not.toThrow();
  });

  test('should overwrite previous carried time', () => {
    game.playerCarriedTime['1'] = 10;
    const data = { carriedTime: 20 };
    
    useCase.execute(game, data);
    
    expect(game.playerCarriedTime['1']).toBe(20);
  });

  test('should work with empty data object', () => {
    useCase.execute(game, {});
    
    expect(game.playerCarriedTime['1']).toBeUndefined();
  });
});

