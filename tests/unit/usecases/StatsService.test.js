const StatsService = require('../../../src/infrastructure/StatsService');
const FileStatsRepository = require('../../../src/infrastructure/FileStatsRepository');
const path = require('path');
const fs = require('fs');

describe('StatsService SPW and time tracking', () => {
  const tmpDir = path.join(__dirname, '../../../public/stats_test');
  let repo;
  let stats;

  beforeAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    repo = new FileStatsRepository(tmpDir);
  });

  beforeEach(() => {
    stats = new StatsService(repo, null);
  });

  test('accumulates active time with pause/resume and computes SPW', () => {
    const game = { gameId: 'g1', players: [{ id: 'p1', name: 'A', teamId: 't1' }], teamStatsByRound: {0:{},1:{},2:{}} };
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1000);
    stats.startSession(game);
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 2000);
    stats.startTurn('p1', 0);
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 5000);
    stats.onWordGuessed('p1', 0);
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 7000);
    stats.pause();
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 9000);
    stats.resume();
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 12000);
    stats.endTurn();
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 13000);
    stats.endSession(game);

    const p = repo.readPlayerStats('name:A');
    expect(p).toBeTruthy();
    // Active time: (2000->7000)=5000ms + (9000->12000)=3000ms => 8000ms, guessed=1 => spw=8s
    expect(p.perRoundSpwSamples[0].length).toBe(1);
    expect(Math.round(p.perRoundSpwSamples[0][0])).toBe(8);
    expect(Math.round(p.medianSpwByRound[0])).toBe(8);
    // Best turn R0 should be >= 1 due to one guessed word
    expect(p.bestTurnByRound[0]).toBeGreaterThanOrEqual(1);
  });
});


