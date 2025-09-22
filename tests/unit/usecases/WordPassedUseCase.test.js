const WordPassedUseCase = require('../../../src/usecases/WordPassedUseCase');
const Game = require('../../../src/entities/Game');

describe('WordPassedUseCase', () => {
  let useCase;
  let game;

  beforeEach(() => {
    useCase = new WordPassedUseCase();
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

  test('should handle word passed correctly', () => {
    const data = { teamId: 'team1' };
    
    useCase.execute(game, data);
    
    expect(game.scores.team1).toBe(-1);
    expect(game.teamStatsByRound[0].team1).toBe(-1);
    expect(game.playerStats['1'].passed).toBe(1);
    expect(game.playerStats['1'].totalScore).toBe(-1);
    expect(game.availableWords).toHaveLength(3);
    expect(game.availableWords[2]).toBe('word1'); // Moved to end
    expect(game.passedWords).toHaveLength(1);
    expect(game.passedWords[0].word).toBe('word1');
    expect(game.passedWords[0].player).toBe(game.currentPlayer);
    expect(game.passedWords[0].team).toBe('team1');
  });

  test('should not execute when no current word', () => {
    game.currentWord = null;
    const data = { teamId: 'team1' };
    
    useCase.execute(game, data);
    
    expect(game.scores.team1).toBe(0);
    expect(game.passedWords).toHaveLength(0);
  });

  test('should not execute when no teamId provided', () => {
    const data = {};
    
    useCase.execute(game, data);
    
    expect(game.scores.team1).toBe(0);
    expect(game.passedWords).toHaveLength(0);
  });

  test('should move passed word to end of queue', () => {
    const data = { teamId: 'team1' };
    
    // Pass first word
    useCase.execute(game, data);
    expect(game.availableWords).toEqual(['word2', 'word3', 'word1']);
    
    // Pass second word
    useCase.execute(game, data);
    expect(game.availableWords).toEqual(['word3', 'word1', 'word2']);
  });

  test('should track multiple passed words', () => {
    const data = { teamId: 'team1' };
    
    useCase.execute(game, data);
    expect(game.passedWords).toHaveLength(1);
    expect(game.scores.team1).toBe(-1);
    
    useCase.execute(game, data);
    expect(game.passedWords).toHaveLength(2);
    expect(game.scores.team1).toBe(-2);
  });
});
