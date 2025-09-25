const StartGameUseCase = require('../../../src/usecases/StartGameUseCase');

describe('Player key generation', () => {
  test('generates sha1 for name and tg: prefix for telegram id', async () => {
    const uc = new StartGameUseCase({ selectRandomWords: async () => [] });
    const data = {
      players: [
        { id: '1', name: 'Alice', teamId: 'A' },
        { id: '2', name: 'Bob', teamId: 'B', telegramUserId: '12345' }
      ],
      teams: [ { id: 'A', name: 'A' }, { id: 'B', name: 'B' } ],
      options: {}
    };
    const game = await uc.execute(data);
    const p1 = game.players.find(p => p.id === '1');
    const p2 = game.players.find(p => p.id === '2');
    expect(p1.playerKey).toMatch(/^name:[0-9a-f]{40}$/);
    expect(p2.playerKey).toBe('tg:12345');
  });
});


