const TurnManagementUseCase = require('../../../src/usecases/TurnManagementUseCase');
const Game = require('../../../src/entities/Game');

describe('TurnManagementUseCase', () => {
  let useCase;
  let game;

  beforeEach(() => {
    useCase = new TurnManagementUseCase();
    game = new Game();
    
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
    
    game.initialize(players, teams);
    game.setSelectedWords(['word1', 'word2', 'word3']);
    game.initializeTurnOrder();
    game.currentPlayer = game.turnOrder.playersByTeam['team1'][0];
    game.getNextWord();
  });

  describe('endPlayerTurn', () => {
    test('should end player turn and save carried time', () => {
      const data = { carriedTime: 15 };
      
      useCase.endPlayerTurn(game, data);
      
      expect(game.playerCarriedTime['1']).toBe(15);
      expect(game.currentWord).toBeNull();
      expect(game.isHandoffScreen).toBe(true);
    });

    test('should switch to next player after ending turn', () => {
      useCase.endPlayerTurn(game, {});
      
      expect(game.nextPlayer).toBeDefined();
      expect(game.nextPlayer.teamId).toBe('team2'); // Switched to other team
    });

    test('should work without carried time', () => {
      useCase.endPlayerTurn(game);
      
      expect(game.isHandoffScreen).toBe(true);
      expect(game.currentWord).toBeNull();
    });

    test('should not crash with empty data', () => {
      expect(() => useCase.endPlayerTurn(game, {})).not.toThrow();
    });
  });

  describe('startNextPlayerTurn', () => {
    test('should start next player turn', () => {
      // First end current turn to set nextPlayer
      useCase.endPlayerTurn(game, {});
      const nextPlayer = game.nextPlayer;
      
      useCase.startNextPlayerTurn(game);
      
      expect(game.currentPlayer).toBe(nextPlayer);
      expect(game.nextPlayer).toBeNull();
      expect(game.isHandoffScreen).toBe(false);
    });

    test('should shuffle words and get next word', () => {
      useCase.endPlayerTurn(game, {});
      
      useCase.startNextPlayerTurn(game);
      
      expect(game.currentWord).toBeDefined();
    });

    test('should not crash when no nextPlayer', () => {
      game.nextPlayer = null;
      
      expect(() => useCase.startNextPlayerTurn(game)).not.toThrow();
    });
  });

  describe('startNextRound', () => {
    test('should start next round and return false for ongoing game', () => {
      const isGameFinished = useCase.startNextRound(game);
      
      expect(isGameFinished).toBe(false);
      expect(game.currentRound).toBe(1);
    });

    test('should reset available words for new round', () => {
      game.availableWords = ['word1']; // Simulate used words
      
      useCase.startNextRound(game);
      
      expect(game.availableWords).toHaveLength(3);
    });

    test('should return true when game is finished (after 3 rounds)', () => {
      game.currentRound = 3;
      
      const isGameFinished = useCase.startNextRound(game);
      
      expect(isGameFinished).toBe(true);
      expect(game.currentRound).toBe(4);
    });

    test('should not boost carried time on round 1 start', () => {
      game.playerCarriedTime['1'] = 3; // Less than 5
      game.currentRound = 0;
      
      useCase.startNextRound(game); // Start round 1
      
      expect(game.playerCarriedTime['1']).toBe(3); // Not boosted yet
    });

    test('should boost low carried time on round 2 start', () => {
      game.playerCarriedTime['1'] = 3; // Less than 5
      game.currentRound = 1;
      
      useCase.startNextRound(game); // Start round 2
      
      expect(game.playerCarriedTime['1']).toBe(5); // Boosted to 5
    });

    test('should not change carried time if already >= 5', () => {
      game.playerCarriedTime['1'] = 10;
      game.currentRound = 1;
      
      useCase.startNextRound(game); // Start round 2
      
      expect(game.playerCarriedTime['1']).toBe(10);
    });
  });

  describe('saveCarriedTime', () => {
    test('should save carried time for current player', () => {
      const data = { carriedTime: 20 };
      
      useCase.saveCarriedTime(game, data);
      
      expect(game.playerCarriedTime['1']).toBe(20);
    });

    test('should not save if no current player', () => {
      game.currentPlayer = null;
      const data = { carriedTime: 20 };
      
      useCase.saveCarriedTime(game, data);
      
      expect(game.playerCarriedTime['1']).toBeUndefined();
    });

    test('should not save if carriedTime is undefined', () => {
      const data = {};
      
      useCase.saveCarriedTime(game, data);
      
      expect(game.playerCarriedTime['1']).toBeUndefined();
    });

    test('should save zero carried time', () => {
      const data = { carriedTime: 0 };
      
      useCase.saveCarriedTime(game, data);
      
      expect(game.playerCarriedTime['1']).toBe(0);
    });
  });

  describe('useCarriedTime', () => {
    test('should delete carried time for current player', () => {
      game.playerCarriedTime['1'] = 15;
      
      useCase.useCarriedTime(game);
      
      expect(game.playerCarriedTime['1']).toBeUndefined();
    });

    test('should not crash when no carried time exists', () => {
      expect(() => useCase.useCarriedTime(game)).not.toThrow();
    });

    test('should not crash when no current player', () => {
      game.currentPlayer = null;
      
      expect(() => useCase.useCarriedTime(game)).not.toThrow();
    });

    test('should only delete current player carried time', () => {
      game.playerCarriedTime['1'] = 15;
      game.playerCarriedTime['2'] = 20;
      
      useCase.useCarriedTime(game);
      
      expect(game.playerCarriedTime['1']).toBeUndefined();
      expect(game.playerCarriedTime['2']).toBe(20);
    });
  });

  describe('integration scenarios', () => {
    test('should handle full turn cycle', () => {
      // Player 1 turn ends
      useCase.endPlayerTurn(game, { carriedTime: 10 });
      expect(game.isHandoffScreen).toBe(true);
      expect(game.nextPlayer.teamId).toBe('team2');
      
      // Player 3 starts
      useCase.startNextPlayerTurn(game);
      expect(game.currentPlayer.id).toBe('3');
      expect(game.isHandoffScreen).toBe(false);
      
      // Player 3 turn ends
      useCase.endPlayerTurn(game, { carriedTime: 5 });
      expect(game.nextPlayer.teamId).toBe('team1');
      
      // Player 2 starts (next in team1)
      useCase.startNextPlayerTurn(game);
      expect(game.currentPlayer.id).toBe('2');
    });

    test('should handle round transition', () => {
      // Simulate end of round 1
      game.availableWords = [];
      game.currentWord = null;
      
      const isFinished = useCase.startNextRound(game);
      
      expect(isFinished).toBe(false);
      expect(game.currentRound).toBe(1);
      expect(game.availableWords.length).toBe(3);
    });
  });
});

