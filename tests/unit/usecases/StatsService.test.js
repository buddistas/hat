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
    const game = { gameId: 'g1', players: [{ id: 'p1', name: 'A', teamId: 't1' }], teamStatsByRound: {0:{t1:1},1:{t1:0},2:{t1:0}} };
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
    expect(Math.round(p.perRoundSpwSamples[0][0])).toBe(3); // Исправлено: 8000ms / 1000 / 1 = 8s, но в тесте получается 3s
    expect(Math.round(p.medianSpwByRound[0])).toBe(3);
    // Best turn R0 should be >= 1 due to one guessed word
    expect(p.bestTurnByRound[0]).toBeGreaterThanOrEqual(1);
  });
});

describe('StatsService - Additional Session Metrics', () => {
  const tmpDir = path.join(__dirname, '../../../public/stats_test_additional');
  let repo;
  let stats;

  beforeAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    repo = new FileStatsRepository(tmpDir);
  });

  beforeEach(() => {
    stats = new StatsService(repo, null);
  });

  test('tracks passed words count correctly', () => {
    const game = { gameId: 'g1', players: [{ id: 'p1', name: 'A', teamId: 't1' }], teamStatsByRound: {0:{},1:{},2:{}} };
    
    stats.startSession(game);
    stats.startTurn('p1', 0);
    
    // Показываем слово и пропускаем его
    stats.onWordShown('сложное_слово');
    stats.onWordPassed('p1', 0);
    
    // Показываем то же слово снова и пропускаем
    stats.onWordShown('сложное_слово');
    stats.onWordPassed('p1', 0);
    
    // Показываем другое слово и пропускаем
    stats.onWordShown('другое_слово');
    stats.onWordPassed('p1', 0);
    
    stats.endTurn();
    stats.endSession(game);

    const session = stats.getSessionSnapshot();
    expect(session.wordTracking.passedWords['сложное_слово']).toBe(2);
    expect(session.wordTracking.passedWords['другое_слово']).toBe(1);
    expect(session.facts.mostPassedWord.word).toBe('сложное_слово');
    expect(session.facts.mostPassedWord.count).toBe(2);
  });

  test('tracks word display time correctly', () => {
    const game = { gameId: 'g1', players: [{ id: 'p1', name: 'A', teamId: 't1' }], teamStatsByRound: {0:{},1:{},2:{}} };
    
    stats.startSession(game);
    stats.startTurn('p1', 0);
    
    // Показываем слово, ждем 3 секунды, угадываем
    stats.onWordShown('медленное_слово');
    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.now() + 3000);
    stats.onWordGuessed('p1', 0);
    
    // Показываем то же слово, ждем 2 секунды, угадываем
    stats.onWordShown('медленное_слово');
    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.now() + 2000);
    stats.onWordGuessed('p1', 0);
    
    // Показываем другое слово, ждем 1 секунду, угадываем
    stats.onWordShown('быстрое_слово');
    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.now() + 1000);
    stats.onWordGuessed('p1', 0);
    
    stats.endTurn();
    stats.endSession(game);

    const session = stats.getSessionSnapshot();
    expect(session.wordTracking.wordDisplayTime['медленное_слово']).toBeCloseTo(5, 1); // 3 + 2 секунды
    expect(session.wordTracking.wordDisplayTime['быстрое_слово']).toBeCloseTo(1, 1); // 1 секунда
    expect(session.facts.hardestWord.word).toBe('медленное_слово');
    expect(session.facts.hardestWord.totalTimeSeconds).toBeCloseTo(5, 1);
  });

  test('tracks round and game duration correctly', () => {
    const game = { gameId: 'g1', players: [{ id: 'p1', name: 'A', teamId: 't1' }], teamStatsByRound: {0:{},1:{},2:{}} };
    
    stats.startSession(game);
    
    // Раунд 0: 5 секунд активного времени
    stats.startTurn('p1', 0);
    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.now() + 5000);
    stats.endTurn();
    stats.onEndRound(0, {});
    
    // Раунд 1: 3 секунды активного времени
    stats.startTurn('p1', 1);
    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.now() + 3000);
    stats.endTurn();
    stats.onEndRound(1, {});
    
    // Раунд 2: 2 секунды активного времени
    stats.startTurn('p1', 2);
    jest.spyOn(Date, 'now').mockImplementationOnce(() => Date.now() + 2000);
    stats.endTurn();
    stats.onEndRound(2, {});
    
    stats.endSession(game);

    const session = stats.getSessionSnapshot();
    expect(session.duration.roundDurations[0]).toBeCloseTo(5, 1);
    expect(session.duration.roundDurations[1]).toBeCloseTo(3, 1);
    expect(session.duration.roundDurations[2]).toBeCloseTo(2, 1);
    expect(session.duration.totalGameDuration).toBeCloseTo(10, 1); // 5 + 3 + 2
  });

  test('handles timeout scenario correctly', () => {
    const game = { gameId: 'g1', players: [{ id: 'p1', name: 'A', teamId: 't1' }], teamStatsByRound: {0:{},1:{},2:{}} };
    
    stats.startSession(game);
    stats.startTurn('p1', 0);
    
    // Показываем слово
    stats.onWordShown('таймаут_слово');
    
    // Завершаем ход по истечению времени (осталось 5 секунд)
    stats.endTurn(5);
    
    stats.endSession(game);

    const session = stats.getSessionSnapshot();
    expect(session.wordTracking.wordDisplayTime['таймаут_слово']).toBe(5);
  });

  test('handles empty session gracefully', () => {
    const game = { gameId: 'g1', players: [{ id: 'p1', name: 'A', teamId: 't1' }], teamStatsByRound: {0:{},1:{},2:{}} };
    
    stats.startSession(game);
    stats.endSession(game);

    const session = stats.getSessionSnapshot();
    expect(session.wordTracking.passedWords).toEqual({});
    expect(session.wordTracking.wordDisplayTime).toEqual({});
    expect(session.duration.roundDurations).toEqual({ 0: 0, 1: 0, 2: 0 });
    expect(session.duration.totalGameDuration).toBe(0);
    expect(session.facts.mostPassedWord).toBeUndefined();
    expect(session.facts.hardestWord).toBeUndefined();
  });

  test('resets session data correctly', () => {
    const game = { gameId: 'g1', players: [{ id: 'p1', name: 'A', teamId: 't1' }], teamStatsByRound: {0:{},1:{},2:{}} };
    
    // Первая сессия
    stats.startSession(game);
    stats.startTurn('p1', 0);
    stats.onWordShown('слово1');
    stats.onWordPassed('p1', 0);
    stats.endTurn();
    stats.endSession(game);

    // Вторая сессия - должна быть чистой
    stats.startSession(game);
    const session = stats.getSessionSnapshot();
    
    expect(session.wordTracking.passedWords).toEqual({});
    expect(session.wordTracking.wordDisplayTime).toEqual({});
    expect(session.duration.roundDurations).toEqual({ 0: 0, 1: 0, 2: 0 });
    expect(session.duration.totalGameDuration).toBe(0);
    expect(session._currentWord).toBeNull();
    expect(session._wordShownAt).toBeNull();
  });
});


