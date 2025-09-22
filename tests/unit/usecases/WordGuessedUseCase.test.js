const WordGuessedUseCase = require('../../../src/usecases/WordGuessedUseCase');
const Game = require('../../../src/entities/Game');

describe('WordGuessedUseCase', () => {
  let useCase;
  let game;

  beforeEach(() => {
    useCase = new WordGuessedUseCase();
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

  test('should handle word guessed correctly', () => {
    const data = { teamId: 'team1' };
    
    const roundFinished = useCase.execute(game, data);
    
    expect(game.scores.team1).toBe(1);
    expect(game.teamStatsByRound[0].team1).toBe(1);
    expect(game.playerStats['1'].guessed).toBe(1);
    expect(game.playerStats['1'].totalScore).toBe(1);
    expect(game.availableWords).toHaveLength(2);
    expect(game.usedWords).toContain('word1');
    expect(roundFinished).toBe(false);
  });

  test('should finish round when last word guessed', () => {
    game.setSelectedWords(['word1']);
    game.getNextWord();
    const data = { teamId: 'team1' };
    
    const roundFinished = useCase.execute(game, data);
    
    expect(roundFinished).toBe(true);
    expect(game.currentWord).toBeNull();
    expect(game.availableWords).toHaveLength(0);
  });

  test('should return false when no current word', () => {
    game.currentWord = null;
    const data = { teamId: 'team1' };
    
    const result = useCase.execute(game, data);
    
    expect(result).toBe(false);
    expect(game.scores.team1).toBe(0);
  });

  test('should return false when no teamId provided', () => {
    const data = {};
    
    const result = useCase.execute(game, data);
    
    expect(result).toBe(false);
    expect(game.scores.team1).toBe(0);
  });

  test('should handle multiple words guessed', () => {
    const data = { teamId: 'team1' };
    
    // Guess first word
    useCase.execute(game, data);
    expect(game.scores.team1).toBe(1);
    expect(game.availableWords).toHaveLength(2);
    
    // Guess second word
    useCase.execute(game, data);
    expect(game.scores.team1).toBe(2);
    expect(game.availableWords).toHaveLength(1);
    
    // Guess last word
    const roundFinished = useCase.execute(game, data);
    expect(game.scores.team1).toBe(3);
    expect(game.availableWords).toHaveLength(0);
    expect(roundFinished).toBe(true);
  });
});
