const Player = require('../../../src/entities/Player');

describe('Player', () => {
  test('should create player with correct properties', () => {
    const player = new Player('1', 'John', 'team1');
    
    expect(player.id).toBe('1');
    expect(player.name).toBe('John');
    expect(player.teamId).toBe('team1');
  });

  test('should clone player correctly', () => {
    const original = new Player('1', 'John', 'team1');
    const cloned = original.clone();
    
    expect(cloned).not.toBe(original);
    expect(cloned.id).toBe(original.id);
    expect(cloned.name).toBe(original.name);
    expect(cloned.teamId).toBe(original.teamId);
  });

  test('should check equality correctly', () => {
    const player1 = new Player('1', 'John', 'team1');
    const player2 = new Player('1', 'Jane', 'team2');
    const player3 = new Player('2', 'John', 'team1');
    
    expect(player1.equals(player2)).toBe(true); // Same ID
    expect(player1.equals(player3)).toBe(false); // Different ID
    expect(player1.equals(null)).toBe(false);
    expect(player1.equals(undefined)).toBe(false);
  });
});
