const Team = require('../../../src/entities/Team');

describe('Team', () => {
  test('should create team with correct properties', () => {
    const team = new Team('1', 'Red Team', ['player1', 'player2']);
    
    expect(team.id).toBe('1');
    expect(team.name).toBe('Red Team');
    expect(team.players).toEqual(['player1', 'player2']);
  });

  test('should add player to team', () => {
    const team = new Team('1', 'Red Team', ['player1']);
    
    team.addPlayer('player2');
    expect(team.players).toEqual(['player1', 'player2']);
    
    // Should not add duplicate
    team.addPlayer('player1');
    expect(team.players).toEqual(['player1', 'player2']);
  });

  test('should remove player from team', () => {
    const team = new Team('1', 'Red Team', ['player1', 'player2']);
    
    team.removePlayer('player1');
    expect(team.players).toEqual(['player2']);
    
    // Should not throw error for non-existent player
    team.removePlayer('player3');
    expect(team.players).toEqual(['player2']);
  });

  test('should check if player is in team', () => {
    const team = new Team('1', 'Red Team', ['player1', 'player2']);
    
    expect(team.hasPlayer('player1')).toBe(true);
    expect(team.hasPlayer('player2')).toBe(true);
    expect(team.hasPlayer('player3')).toBe(false);
  });

  test('should clone team correctly', () => {
    const original = new Team('1', 'Red Team', ['player1', 'player2']);
    const cloned = original.clone();
    
    expect(cloned).not.toBe(original);
    expect(cloned.id).toBe(original.id);
    expect(cloned.name).toBe(original.name);
    expect(cloned.players).toEqual(original.players);
    expect(cloned.players).not.toBe(original.players); // Different array reference
  });

  test('should check equality correctly', () => {
    const team1 = new Team('1', 'Red Team', ['player1']);
    const team2 = new Team('1', 'Blue Team', ['player2']);
    const team3 = new Team('2', 'Red Team', ['player1']);
    
    expect(team1.equals(team2)).toBe(true); // Same ID
    expect(team1.equals(team3)).toBe(false); // Different ID
    expect(team1.equals(null)).toBe(false);
  });
});
