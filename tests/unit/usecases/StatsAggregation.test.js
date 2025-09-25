const FileStatsRepository = require('../../../src/infrastructure/FileStatsRepository');
const StatsService = require('../../../src/infrastructure/StatsService');
const path = require('path');
const fs = require('fs');

describe('Stats aggregation (median SPW, zero-guessed exclusion, ties)', () => {
  const tmpDir = path.join(__dirname, '../../../public/stats_agg');
  let repo;
  let stats;

  beforeAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    repo = new FileStatsRepository(tmpDir);
    stats = new StatsService(repo, null);
  });

  test('median SPW across multiple samples', () => {
    const game = { gameId: 'g3', players: [{ id: 'p1', name: 'P', teamId: 'T' }], teamStatsByRound: {0:{T:0},1:{},2:{}} };
    jest.spyOn(Date, 'now').mockImplementation(() => 1000);
    stats.startSession(game);
    // First sample: 4s/1 word
    jest.spyOn(Date, 'now').mockImplementation(() => 2000); stats.startTurn('p1', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 6000); stats.onWordGuessed('p1', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 6000); stats.endTurn();
    // Second sample: 10s/2 words => 5s
    jest.spyOn(Date, 'now').mockImplementation(() => 7000); stats.startTurn('p1', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 12000); stats.onWordGuessed('p1', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 17000); stats.onWordGuessed('p1', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 17000); stats.endTurn();
    // Third sample: 20s/1 word
    jest.spyOn(Date, 'now').mockImplementation(() => 18000); stats.startTurn('p1', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 38000); stats.onWordGuessed('p1', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 38000); stats.endTurn();
    jest.spyOn(Date, 'now').mockImplementation(() => 39000); stats.endSession(game);

    const ps = repo.readPlayerStats('name:P');
    // Samples SPW R0: [4,5,20] => median = 5
    expect(Math.round(ps.medianSpwByRound[0])).toBe(5);
    // Best first round spw should be 4
    expect(Math.round(ps.bestFirstRoundSpw)).toBe(4);
  });

  test('zero-guessed excluded from SPW leaderboard', () => {
    const game = { gameId: 'g4', players: [{ id: 'p2', name: 'Z', teamId: 'T' }], teamStatsByRound: {0:{T:0},1:{},2:{}} };
    jest.spyOn(Date, 'now').mockImplementation(() => 1000);
    stats.startSession(game);
    jest.spyOn(Date, 'now').mockImplementation(() => 2000); stats.startTurn('p2', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 10000); stats.endTurn(); // no guesses
    jest.spyOn(Date, 'now').mockImplementation(() => 11000); stats.endSession(game);

    const lb = repo.readLeaderboard('spw_all');
    const hasZ = lb.some(x => x.playerKey === 'name:Z');
    expect(hasZ).toBe(false);
  });

  test('ties count as wins for all max-score teams', () => {
    const game = { gameId: 'g5', players: [
      { id: 'p3', name: 'A', teamId: 'TA' },
      { id: 'p4', name: 'B', teamId: 'TB' }
    ], teamStatsByRound: {0:{TA:5,TB:5},1:{},2:{}} };
    jest.spyOn(Date, 'now').mockImplementation(() => 1000);
    stats.startSession(game);
    jest.spyOn(Date, 'now').mockImplementation(() => 2000); stats.startTurn('p3', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 3000); stats.onWordGuessed('p3', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 3000); stats.endTurn();
    jest.spyOn(Date, 'now').mockImplementation(() => 4000); stats.endSession(game);

    const a = repo.readPlayerStats('name:A');
    const b = repo.readPlayerStats('name:B');
    expect(a.totals.wins).toBeGreaterThan(0);
    expect(b.totals.wins).toBeGreaterThan(0);
    // gamesPlayed increments only with winners
    expect(a.totals.gamesPlayed).toBeGreaterThan(0);
    expect(b.totals.gamesPlayed).toBeGreaterThan(0);
  });

  test('no winners -> no global stats update', () => {
    const game = { gameId: 'g6', players: [{ id: 'p5', name: 'NW', teamId: 'TN' }], teamStatsByRound: {0:{},1:{},2:{}} };
    jest.spyOn(Date, 'now').mockImplementation(() => 2000);
    stats.startSession(game);
    jest.spyOn(Date, 'now').mockImplementation(() => 3000); stats.startTurn('p5', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 6000); stats.onWordGuessed('p5', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 6000); stats.endTurn();
    jest.spyOn(Date, 'now').mockImplementation(() => 7000); stats.endSession(game);
    const ps = repo.readPlayerStats('name:NW');
    expect(ps).toBeNull();
  });
});


