const path = require('path');

class StatsService {
  constructor(fileStatsRepository, webSocketHandler) {
    this.repo = fileStatsRepository;
    this.webSocketHandler = webSocketHandler;
    this.resetSession();
  }

  resetSession() {
    this.session = {
      gameId: null,
      startedAt: null,
      endedAt: null,
      perPlayer: {}, // playerId -> { roundActiveMs, guessedByRound, passedByRound, totalScore, bestTurnByRound }
      perTeam: {},
      _currentTurn: null, // { playerId, round, startedAt, lastResumeAt, accumulatedMs, paused }
      // Новые метрики сессии
      wordTracking: {
        passedWords: {}, // счетчик пропусков по словам
        wordDisplayTime: {} // суммарное время показа слова в секундах
      },
      duration: {
        roundDurations: { 0: 0, 1: 0, 2: 0 }, // продолжительность раундов в секундах
        totalGameDuration: 0 // общая продолжительность партии в секундах
      },
      // Временные переменные для отслеживания
      _currentWord: null, // текущее показываемое слово
      _wordShownAt: null // время показа текущего слова
    };
  }

  startSession(game) {
    this.resetSession();
    this.session.gameId = game.gameId || `game-${Date.now()}`;
    this.session.startedAt = Date.now();
    this.repo.startSessionLog(this.session.gameId);
    this.repo.appendSessionEvent(this.session.gameId, { type: 'SESSION_STARTED', ts: Date.now(), game: { gameId: this.session.gameId } });
    this.pushSessionUpdate();
  }

  endSession(game) {
    if (!this.session.gameId) return;
    this.session.endedAt = Date.now();
    this._finalizeOpenTurnIfAny();
    
    // Расчет общей продолжительности партии
    this._calculateTotalGameDuration();
    
    // Расчет фактов сессии
    this._calculateSessionFacts();
    
    this.repo.appendSessionEvent(this.session.gameId, { type: 'SESSION_ENDED', ts: Date.now() });
    // Apply to player aggregates only if winners exist (repo enforces as well, but avoid work)
    const winners = this._computeWinners(game);
    const roundIdxs = [0,1,2];
    if (winners && winners.winners && winners.winners.length > 0) {
      for (const [playerId, p] of Object.entries(this.session.perPlayer)) {
        const totals = { wordsGuessed: 0, wordsPassed: 0, totalScore: p.totalScore || 0, activeMsByRound: {}, guessedByRound: {}, spwByRound: {}, bestTurnByRound: p.bestTurnByRound || {0:0,1:0,2:0} };
        roundIdxs.forEach(r => {
          const activeMs = (p.roundActiveMs && p.roundActiveMs[r]) || 0;
          const guessed = (p.guessedByRound && p.guessedByRound[r]) || 0;
          totals.activeMsByRound[r] = activeMs;
          totals.guessedByRound[r] = guessed;
          totals.wordsGuessed += guessed;
          totals.wordsPassed += ((p.passedByRound && p.passedByRound[r]) || 0);
          totals.spwByRound[r] = guessed > 0 ? (activeMs / 1000) / guessed : null;
        });
        this.repo.applyPlayerSessionTotals(game, playerId, totals, winners);
      }
    }
    this.repo.finishSessionLog(this.session.gameId);
    this.pushLeaderboardUpdate();
  }

  _ensurePlayer(playerId) {
    if (!this.session.perPlayer[playerId]) {
      this.session.perPlayer[playerId] = {
        roundActiveMs: { 0: 0, 1: 0, 2: 0 },
        guessedByRound: { 0: 0, 1: 0, 2: 0 },
        passedByRound: { 0: 0, 1: 0, 2: 0 },
        totalScore: 0,
        bestTurnByRound: { 0: 0, 1: 0, 2: 0 }
      };
    }
    return this.session.perPlayer[playerId];
  }

  _finalizeOpenTurnIfAny() {
    const t = this.session._currentTurn;
    if (!t) return;
    if (!t.paused && t.lastResumeAt) {
      const delta = Date.now() - t.lastResumeAt;
      t.accumulatedMs += Math.max(0, delta);
    }
    const p = this._ensurePlayer(t.playerId);
    p.roundActiveMs[t.round] += t.accumulatedMs;
    this.session._currentTurn = null;
  }

  startTurn(playerId, round) {
    this._finalizeOpenTurnIfAny();
    this.session._currentTurn = {
      playerId,
      round,
      startedAt: Date.now(),
      lastResumeAt: Date.now(),
      accumulatedMs: 0,
      paused: false,
      pointsDelta: 0,
      guessed: 0,
      passed: 0
    };
    this.repo.appendSessionEvent(this.session.gameId, { type: 'START_TURN', ts: Date.now(), playerId, round });
    this.pushSessionUpdate();
  }

  pause() {
    const t = this.session._currentTurn;
    if (!t || t.paused) return;
    const delta = Date.now() - t.lastResumeAt;
    t.accumulatedMs += Math.max(0, delta);
    t.paused = true;
    this.repo.appendSessionEvent(this.session.gameId, { type: 'PAUSE', ts: Date.now() });
    this.pushSessionUpdate();
  }

  resume() {
    const t = this.session._currentTurn;
    if (!t || !t.paused) return;
    t.lastResumeAt = Date.now();
    t.paused = false;
    this.repo.appendSessionEvent(this.session.gameId, { type: 'RESUME', ts: Date.now() });
    this.pushSessionUpdate();
  }

  endTurn(timerRemainingAtShow = null) {
    const t = this.session._currentTurn;
    if (!t) return;
    if (!t.paused && t.lastResumeAt) {
      const delta = Date.now() - t.lastResumeAt;
      t.accumulatedMs += Math.max(0, delta);
    }
    const p = this._ensurePlayer(t.playerId);
    p.roundActiveMs[t.round] += t.accumulatedMs;
    // Update best turn for this round (by pointsDelta)
    if (typeof t.pointsDelta === 'number') {
      if (p.bestTurnByRound[t.round] == null || t.pointsDelta > p.bestTurnByRound[t.round]) {
        p.bestTurnByRound[t.round] = t.pointsDelta;
      }
    }
    
    // Обработка истечения времени хода - обновление времени показа слова
    if (timerRemainingAtShow !== null && this.session._currentWord && this.session._wordShownAt) {
      const word = this.session._currentWord;
      const displayTimeSeconds = Math.max(0, timerRemainingAtShow);
      
      this.session.wordTracking.wordDisplayTime[word] = 
        (this.session.wordTracking.wordDisplayTime[word] || 0) + displayTimeSeconds;
      
      this.repo.appendSessionEvent(this.session.gameId, { 
        type: 'WORD_DISPLAY_TIME_UPDATED_TIMEOUT', 
        ts: Date.now(), 
        word, 
        displayTimeSeconds,
        totalTimeSeconds: this.session.wordTracking.wordDisplayTime[word]
      });
      
      // Очистка текущего слова
      this.session._currentWord = null;
      this.session._wordShownAt = null;
    }
    
    this.repo.appendSessionEvent(this.session.gameId, { type: 'END_TURN', ts: Date.now(), playerId: t.playerId, round: t.round, activeMs: t.accumulatedMs });
    this.session._currentTurn = null;
    this.pushSessionUpdate();
  }

  onWordGuessed(playerId, round) {
    const p = this._ensurePlayer(playerId);
    p.guessedByRound[round] = (p.guessedByRound[round] || 0) + 1;
    p.totalScore = (p.totalScore || 0) + 1;
    if (this.session._currentTurn && this.session._currentTurn.playerId === playerId && this.session._currentTurn.round === round) {
      this.session._currentTurn.pointsDelta += 1;
      this.session._currentTurn.guessed += 1;
    }
    
    // Обновление времени показа слова при угадывании
    this._updateWordDisplayTime();
    
    this.repo.appendSessionEvent(this.session.gameId, { type: 'WORD_GUESSED', ts: Date.now(), playerId, round });
    this.pushSessionUpdate();
  }

  onWordPassed(playerId, round) {
    const p = this._ensurePlayer(playerId);
    p.passedByRound[round] = (p.passedByRound[round] || 0) + 1;
    p.totalScore = (p.totalScore || 0) - 1;
    if (this.session._currentTurn && this.session._currentTurn.playerId === playerId && this.session._currentTurn.round === round) {
      this.session._currentTurn.pointsDelta -= 1;
      this.session._currentTurn.passed += 1;
    }
    
    // Обновление счетчика пропусков и времени показа слова
    this._updatePassedWordCount();
    this._updateWordDisplayTime();
    
    this.repo.appendSessionEvent(this.session.gameId, { type: 'WORD_PASSED', ts: Date.now(), playerId, round });
    this.pushSessionUpdate();
  }

  onEndRound(round, scores) {
    // Фиксация продолжительности раунда
    this._recordRoundDuration(round);
    
    this.repo.appendSessionEvent(this.session.gameId, { type: 'END_ROUND', ts: Date.now(), round, scores });
    this.pushSessionUpdate();
  }

  // Новый метод для отслеживания показа слова
  onWordShown(word) {
    this.session._currentWord = word;
    this.session._wordShownAt = Date.now();
    this.repo.appendSessionEvent(this.session.gameId, { type: 'WORD_SHOWN', ts: Date.now(), word });
  }

  // Обновление счетчика пропущенных слов
  _updatePassedWordCount() {
    if (this.session._currentWord) {
      const word = this.session._currentWord;
      this.session.wordTracking.passedWords[word] = (this.session.wordTracking.passedWords[word] || 0) + 1;
      this.repo.appendSessionEvent(this.session.gameId, { 
        type: 'WORD_PASSED_COUNT_UPDATED', 
        ts: Date.now(), 
        word, 
        count: this.session.wordTracking.passedWords[word] 
      });
    }
  }

  // Обновление времени показа слова
  _updateWordDisplayTime() {
    if (this.session._currentWord && this.session._wordShownAt) {
      const word = this.session._currentWord;
      const displayTimeMs = Date.now() - this.session._wordShownAt;
      const displayTimeSeconds = Math.max(0, displayTimeMs / 1000);
      
      this.session.wordTracking.wordDisplayTime[word] = 
        (this.session.wordTracking.wordDisplayTime[word] || 0) + displayTimeSeconds;
      
      this.repo.appendSessionEvent(this.session.gameId, { 
        type: 'WORD_DISPLAY_TIME_UPDATED', 
        ts: Date.now(), 
        word, 
        displayTimeSeconds,
        totalTimeSeconds: this.session.wordTracking.wordDisplayTime[word]
      });
    }
    
    // Очистка текущего слова
    this.session._currentWord = null;
    this.session._wordShownAt = null;
  }

  // Фиксация продолжительности раунда
  _recordRoundDuration(round) {
    if (this.session.perPlayer) {
      let totalDurationMs = 0;
      Object.values(this.session.perPlayer).forEach(player => {
        if (player.roundActiveMs && player.roundActiveMs[round]) {
          totalDurationMs += player.roundActiveMs[round];
        }
      });
      
      const durationSeconds = Math.max(0, totalDurationMs / 1000);
      this.session.duration.roundDurations[round] = durationSeconds;
      
      this.repo.appendSessionEvent(this.session.gameId, { 
        type: 'ROUND_DURATION_RECORDED', 
        ts: Date.now(), 
        round, 
        durationSeconds 
      });
    }
  }

  // Расчет общей продолжительности партии
  _calculateTotalGameDuration() {
    const totalSeconds = Object.values(this.session.duration.roundDurations).reduce((sum, duration) => sum + duration, 0);
    this.session.duration.totalGameDuration = totalSeconds;
    
    this.repo.appendSessionEvent(this.session.gameId, { 
      type: 'TOTAL_GAME_DURATION_CALCULATED', 
      ts: Date.now(), 
      totalGameDurationSeconds: totalSeconds 
    });
  }

  // Расчет фактов сессии
  _calculateSessionFacts() {
    // Инициализация facts если не существует
    if (!this.session.facts) {
      this.session.facts = {};
    }

    // Самое часто пропускаемое слово
    const passedWords = this.session.wordTracking.passedWords;
    if (Object.keys(passedWords).length > 0) {
      let mostPassedWord = null;
      let maxCount = 0;
      
      Object.entries(passedWords).forEach(([word, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostPassedWord = word;
        }
      });
      
      if (mostPassedWord) {
        this.session.facts.mostPassedWord = { word: mostPassedWord, count: maxCount };
      }
    }

    // Самое сложное слово (на которое потрачено больше всего времени)
    const wordDisplayTime = this.session.wordTracking.wordDisplayTime;
    if (Object.keys(wordDisplayTime).length > 0) {
      let hardestWord = null;
      let maxTime = 0;
      
      Object.entries(wordDisplayTime).forEach(([word, time]) => {
        if (time > maxTime) {
          maxTime = time;
          hardestWord = word;
        }
      });
      
      if (hardestWord) {
        this.session.facts.hardestWord = { word: hardestWord, totalTimeSeconds: maxTime };
      }
    }

    this.repo.appendSessionEvent(this.session.gameId, { 
      type: 'SESSION_FACTS_CALCULATED', 
      ts: Date.now(), 
      facts: this.session.facts 
    });
  }

  _computeWinners(game) {
    if (!game || !game.teamStatsByRound) return { winners: [] };
    // Compute total scores by team from game if available
    const totals = {};
    [0,1,2].forEach(r => {
      const roundScores = (game.teamStatsByRound && game.teamStatsByRound[r]) || {};
      Object.entries(roundScores).forEach(([teamId, val]) => {
        totals[teamId] = (totals[teamId] || 0) + (val || 0);
      });
    });
    let max = -Infinity;
    Object.values(totals).forEach(v => { if (v > max) max = v; });
    const winners = Object.entries(totals).filter(([_, v]) => v === max).map(([teamId]) => teamId);
    return { winners };
  }

  getSessionSnapshot() {
    return this.session;
  }

  getPlayerStats(playerKey) {
    return this.repo.readPlayerStats(playerKey);
  }

  getLeaderboard(metric) {
    return this.repo.readLeaderboard(metric);
  }

  pushSessionUpdate() {
    if (this.webSocketHandler && typeof this.webSocketHandler.broadcastStatsUpdate === 'function') {
      this.webSocketHandler.broadcastStatsUpdate({ gameId: this.session.gameId, perPlayer: this.session.perPlayer });
    }
  }

  pushLeaderboardUpdate() {
    if (this.webSocketHandler && typeof this.webSocketHandler.broadcastLeaderboardUpdate === 'function') {
      this.webSocketHandler.broadcastLeaderboardUpdate();
    }
  }
}

module.exports = StatsService;


