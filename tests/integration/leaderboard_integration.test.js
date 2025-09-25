const FileStatsRepository = require('../../src/infrastructure/FileStatsRepository');
const StatsService = require('../../src/infrastructure/StatsService');
const path = require('path');
const fs = require('fs');

describe('Leaderboards integration', () => {
  const tmpDir = path.join(__dirname, '../../public/stats_it');
  let repo;
  let stats;

  beforeAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    repo = new FileStatsRepository(tmpDir);
    stats = new StatsService(repo, null);
  });

  test('rebuilds SPW and best streak leaderboards', () => {
    const game = { gameId: 'g2', players: [
      { id: 'p1', name: 'Alice', teamId: 'A' },
      { id: 'p2', name: 'Bob', teamId: 'B' }
    ], teamStatsByRound: {0:{A:0,B:0},1:{A:0,B:0},2:{A:0,B:0}} };

    jest.spyOn(Date, 'now').mockImplementation(() => 1000);
    stats.startSession(game);
    jest.spyOn(Date, 'now').mockImplementation(() => 2000);
    stats.startTurn('p1', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 5000);
    stats.onWordGuessed('p1', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 6000);
    stats.endTurn();

    jest.spyOn(Date, 'now').mockImplementation(() => 7000);
    stats.startTurn('p2', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 13000);
    stats.onWordGuessed('p2', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 14000);
    stats.endTurn();

    // Make team A winner by adding teamScores in game before end
    game.teamStatsByRound[0].A = 1; game.teamStatsByRound[0].B = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => 15000);
    stats.endSession(game);

    const spw = repo.readLeaderboard('spw_all');
    expect(spw.length).toBeGreaterThan(0);
    const streaks = repo.readLeaderboard('best_streak');
    expect(streaks.length).toBeGreaterThan(0);
    // Additional boards
    expect(repo.readLeaderboard('spw_r1').length).toBeGreaterThan(0);
    expect(repo.readLeaderboard('best_round_spw_r1').length).toBeGreaterThan(0);
  });
});


