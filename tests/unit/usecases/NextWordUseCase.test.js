const NextWordUseCase = require('../../../src/usecases/NextWordUseCase');
const Game = require('../../../src/entities/Game');

describe('NextWordUseCase', () => {
  let useCase;
  let game;

  beforeEach(() => {
    useCase = new NextWordUseCase();
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
  });

  test('should return next word from available words', () => {
    const word = useCase.execute(game);
    
    expect(word).toBe('word1');
    expect(game.currentWord).toBe('word1');
  });

  test('should return null when no available words', () => {
    game.availableWords = [];
    
    const word = useCase.execute(game);
    
    expect(word).toBeNull();
    expect(game.currentWord).toBeNull();
  });

  test('should skip missed words if possible', () => {
    game.missedWordsByPlayer['1'] = ['word1'];
    
    const word = useCase.execute(game);
    
    // Should skip word1 (in missed list) and return word2
    expect(word).toBe('word2');
    expect(game.currentWord).toBe('word2');
  });

  test('should return missed word when no other options', () => {
    game.setSelectedWords(['word1']);
    game.missedWordsByPlayer['1'] = ['word1'];
    
    const word = useCase.execute(game);
    
    expect(word).toBe('word1');
    expect(game.currentWord).toBe('word1');
    expect(game.currentWordFromMissed).toBe(true);
    expect(game.currentWordMissedOwnerId).toBe('1');
  });

  test('should work without current player', () => {
    game.currentPlayer = null;
    
    const word = useCase.execute(game);
    
    expect(word).toBe('word1');
    expect(game.currentWord).toBe('word1');
  });

  test('should update currentWord on each call', () => {
    // First call
    let word = useCase.execute(game);
    expect(word).toBe('word1');
    
    // Remove first word from available
    game.availableWords.shift();
    
    // Second call
    word = useCase.execute(game);
    expect(word).toBe('word2');
    expect(game.currentWord).toBe('word2');
  });

  test('should handle empty selectedWords', () => {
    game.setSelectedWords([]);
    
    const word = useCase.execute(game);
    
    expect(word).toBeNull();
    expect(game.currentWord).toBeNull();
  });

  test('should handle single word', () => {
    game.setSelectedWords(['onlyWord']);
    
    const word = useCase.execute(game);
    
    expect(word).toBe('onlyWord');
    expect(game.currentWord).toBe('onlyWord');
  });
});

