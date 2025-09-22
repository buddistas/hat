const Game = require('../../../src/entities/Game');
const Player = require('../../../src/entities/Player');
const Team = require('../../../src/entities/Team');

describe('Game', () => {
  let game;
  let players;
  let teams;

  beforeEach(() => {
    game = new Game();
    players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team1' },
      { id: '3', name: 'Player 3', teamId: 'team2' },
      { id: '4', name: 'Player 4', teamId: 'team2' }
    ];
    teams = [
      { id: 'team1', name: 'Team 1', players: ['1', '2'] },
      { id: 'team2', name: 'Team 2', players: ['3', '4'] }
    ];
  });

  test('should initialize game correctly', () => {
    game.initialize(players, teams, { roundDuration: 60 });
    
    expect(game.players).toHaveLength(4);
    expect(game.teams).toHaveLength(2);
    expect(game.currentRound).toBe(0);
    expect(game.roundDuration).toBe(60);
    expect(game.scores.team1).toBe(0);
    expect(game.scores.team2).toBe(0);
    expect(game.playerStats['1']).toEqual({
      guessed: 0,
      passed: 0,
      totalScore: 0
    });
  });

  test('should set selected words correctly', () => {
    const words = ['word1', 'word2', 'word3'];
    game.setSelectedWords(words);
    
    expect(game.selectedWords).toEqual(words);
    expect(game.availableWords).toEqual(words);
    expect(game.selectedWords).not.toBe(game.availableWords); // Different references
  });

  test('should initialize turn order correctly', () => {
    game.initialize(players, teams);
    game.initializeTurnOrder();
    
    expect(game.turnOrder.teams).toHaveLength(2);
    expect(game.turnOrder.currentTeamIndex).toBe(0);
    expect(game.turnOrder.currentPlayerIndex).toBe(0);
    expect(game.turnOrder.playersByTeam.team1).toHaveLength(2);
    expect(game.turnOrder.playersByTeam.team2).toHaveLength(2);
  });

  test('should switch to next player correctly', () => {
    game.initialize(players, teams);
    game.initializeTurnOrder();
    
    // Set first player
    game.currentPlayer = game.turnOrder.playersByTeam.team1[0];
    
    game.switchToNextPlayer();
    
    expect(game.nextPlayer).toBeDefined();
    expect(game.nextPlayer.teamId).toBe('team2'); // Next team
  });

  test('should start next player turn correctly', () => {
    game.initialize(players, teams);
    game.initializeTurnOrder();
    const nextPlayer = game.turnOrder.playersByTeam.team1[0];
    game.nextPlayer = nextPlayer;
    game.isHandoffScreen = true;
    
    game.startNextPlayerTurn();
    
    expect(game.currentPlayer).toEqual(nextPlayer);
    expect(game.nextPlayer).toBeNull();
    expect(game.isHandoffScreen).toBe(false);
  });

  test('should end player turn correctly', () => {
    game.initialize(players, teams);
    game.currentPlayer = new Player('1', 'Player 1', 'team1');
    
    game.endPlayerTurn(10);
    
    expect(game.playerCarriedTime['1']).toBe(10);
    expect(game.currentWord).toBeNull();
    expect(game.isHandoffScreen).toBe(true);
    expect(game.nextPlayer).toBeDefined();
  });

  test('should shuffle available words', () => {
    const words = ['word1', 'word2', 'word3', 'word4', 'word5'];
    game.setSelectedWords(words);
    
    const originalOrder = [...game.availableWords];
    game.shuffleAvailableWords();
    
    // Should have same words but potentially different order
    expect(game.availableWords).toHaveLength(originalOrder.length);
    expect(game.availableWords.sort()).toEqual(originalOrder.sort());
  });

  test('should get next word correctly', () => {
    const words = ['word1', 'word2', 'word3'];
    game.setSelectedWords(words);
    
    const nextWord = game.getNextWord();
    
    expect(nextWord).toBe('word1');
    expect(game.currentWord).toBe('word1');
  });

  test('should return null when no words available', () => {
    game.availableWords = [];
    
    const nextWord = game.getNextWord();
    
    expect(nextWord).toBeNull();
    expect(game.currentWord).toBeNull();
  });

  test('should handle word guessed correctly', () => {
    game.initialize(players, teams);
    game.setSelectedWords(['word1', 'word2', 'word3']);
    game.currentPlayer = new Player('1', 'Player 1', 'team1');
    game.getNextWord();
    
    const roundFinished = game.wordGuessed('team1');
    
    expect(game.scores.team1).toBe(1);
    expect(game.teamStatsByRound[0].team1).toBe(1);
    expect(game.playerStats['1'].guessed).toBe(1);
    expect(game.playerStats['1'].totalScore).toBe(1);
    expect(game.availableWords).toHaveLength(2);
    expect(game.usedWords).toContain('word1');
    expect(roundFinished).toBe(false);
  });

  test('should finish round when last word guessed', () => {
    game.initialize(players, teams);
    game.setSelectedWords(['word1']);
    game.currentPlayer = new Player('1', 'Player 1', 'team1');
    game.getNextWord();
    
    const roundFinished = game.wordGuessed('team1');
    
    expect(roundFinished).toBe(true);
    expect(game.currentWord).toBeNull();
    expect(game.availableWords).toHaveLength(0);
  });

  test('should handle word passed correctly', () => {
    game.initialize(players, teams);
    game.setSelectedWords(['word1', 'word2', 'word3']);
    game.currentPlayer = new Player('1', 'Player 1', 'team1');
    game.getNextWord();
    
    game.wordPassed('team1');
    
    expect(game.scores.team1).toBe(-1);
    expect(game.teamStatsByRound[0].team1).toBe(-1);
    expect(game.playerStats['1'].passed).toBe(1);
    expect(game.playerStats['1'].totalScore).toBe(-1);
    expect(game.availableWords).toHaveLength(3);
    expect(game.availableWords[2]).toBe('word1'); // Moved to end
    expect(game.passedWords).toHaveLength(1);
    expect(game.passedWords[0].word).toBe('word1');
  });

  test('should start next round correctly', () => {
    game.initialize(players, teams);
    game.setSelectedWords(['word1', 'word2']);
    game.currentRound = 0;
    
    const gameFinished = game.startNextRound();
    
    expect(game.currentRound).toBe(1);
    expect(gameFinished).toBe(false);
    expect(game.usedWords).toHaveLength(0);
    expect(game.passedWords).toHaveLength(0);
    expect(game.availableWords).toHaveLength(2);
    expect(game.availableWords).toContain('word1');
    expect(game.availableWords).toContain('word2');
    expect(game.teamStatsByRound[1].team1).toBe(0);
    expect(game.teamStatsByRound[1].team2).toBe(0);
  });

  test('should finish game after 3 rounds', () => {
    game.initialize(players, teams);
    game.setSelectedWords(['word1', 'word2']);
    game.currentRound = 3;
    
    const gameFinished = game.startNextRound();
    
    expect(gameFinished).toBe(true);
    expect(game.currentWord).toBeNull();
    expect(game.playerCarriedTime).toEqual({});
  });

  test('should pause and resume game', () => {
    game.pause();
    expect(game.isPaused).toBe(true);
    
    game.resume();
    expect(game.isPaused).toBe(false);
  });

  test('should manage carried time correctly', () => {
    game.playerCarriedTime['1'] = 10;
    
    expect(game.getCarriedTime('1')).toBe(10);
    expect(game.getCarriedTime('2')).toBe(0);
    
    game.useCarriedTime('1');
    expect(game.getCarriedTime('1')).toBe(0);
  });

  test('should check game and round status correctly', () => {
    game.currentRound = 2;
    game.currentWord = 'test';
    
    expect(game.isGameFinished()).toBe(false);
    expect(game.isRoundFinished()).toBe(false);
    
    game.currentRound = 4;
    expect(game.isGameFinished()).toBe(true);
    
    game.currentWord = null;
    expect(game.isRoundFinished()).toBe(true);
  });

  test('should clone game correctly', () => {
    game.initialize(players, teams);
    game.setSelectedWords(['word1', 'word2']);
    game.scores.team1 = 5;
    
    const cloned = game.clone();
    
    expect(cloned).not.toBe(game);
    expect(cloned.scores.team1).toBe(5);
    expect(cloned.selectedWords).toEqual(game.selectedWords);
    expect(cloned.selectedWords).not.toBe(game.selectedWords); // Different reference
  });
});
