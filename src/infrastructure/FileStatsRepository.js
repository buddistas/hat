const fs = require('fs');
const path = require('path');

class FileStatsRepository {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.sessionsDir = path.join(baseDir, 'sessions');
    this.playersDir = path.join(baseDir, 'players');
    this.leaderboardsDir = path.join(baseDir, 'leaderboards');
    [this.baseDir, this.sessionsDir, this.playersDir, this.leaderboardsDir].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  }

  startSessionLog(gameId) {
    const file = path.join(this.sessionsDir, `${gameId}.jsonl`);
    try { fs.unlinkSync(file); } catch(e) {}
    fs.writeFileSync(file, '', 'utf8');
  }

  appendSessionEvent(gameId, event) {
    const file = path.join(this.sessionsDir, `${gameId}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(event) + '\n', 'utf8');
  }

  finishSessionLog(gameId) {
    // no-op for now
  }

  _atomicWrite(file, dataStr) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, dataStr, 'utf8');
    fs.renameSync(tmp, file);
  }

  readPlayerStats(playerKey) {
    const file = path.join(this.playersDir, `${playerKey}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  _writePlayerStats(playerKey, data) {
    const file = path.join(this.playersDir, `${playerKey}.json`);
    this._atomicWrite(file, JSON.stringify(data, null, 2));
  }

  _median(values) {
    if (!values.length) return null;
    const arr = values.slice().sort((a,b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  applyPlayerSessionTotals(game, playerId, totals, winnersInfo) {
    // Update ONLY if winners are determined (game correctly finished)
    if (!winnersInfo || !Array.isArray(winnersInfo.winners) || winnersInfo.winners.length === 0) {
      return; // do not update global personal stats
    }
    const player = (game.players || []).find(p => p.id === playerId) || { id: playerId, name: String(playerId) };
    const playerKey = player.playerKey || `name:${player.name}`;
    const existing = this.readPlayerStats(playerKey) || {
      playerKey,
      displayName: player.name,
      totals: { gamesPlayed: 0, wins: 0, wordsGuessed: 0, wordsPassed: 0, totalScore: 0, maxPointsPerGame: 0 },
      perRoundSpwSamples: { 0: [], 1: [], 2: [] },
      bestFirstRoundSpw: null,
      bestSecondRoundSpw: null,
      bestThirdRoundSpw: null,
      bestTurnByRound: { 0: null, 1: null, 2: null },
      maxPassedPerGame: 0,
      bestWinStreak: 0,
      currentWinStreak: 0,
      lastPlayedAt: null
    };

    existing.totals.gamesPlayed += 1; // only when winners defined
    existing.totals.wordsGuessed += (totals.wordsGuessed || 0);
    existing.totals.wordsPassed += (totals.wordsPassed || 0);
    existing.totals.totalScore += (totals.totalScore || 0);
    if ((totals.totalScore || 0) > (existing.totals.maxPointsPerGame || 0)) {
      existing.totals.maxPointsPerGame = totals.totalScore || 0;
    }
    existing.lastPlayedAt = Date.now();

    // wins (ties count as wins)
    const teamId = player.teamId;
    if (winnersInfo && winnersInfo.winners && teamId && winnersInfo.winners.includes(teamId)) {
      existing.totals.wins += 1;
      existing.currentWinStreak += 1;
      if (existing.currentWinStreak > existing.bestWinStreak) existing.bestWinStreak = existing.currentWinStreak;
    } else {
      existing.currentWinStreak = 0;
    }

    // Collect SPW samples and best round SPW (per-session record)
    [0,1,2].forEach(r => {
      const spw = totals.spwByRound[r];
      if (spw != null && isFinite(spw)) existing.perRoundSpwSamples[r].push(spw);
      if (spw != null && isFinite(spw)) {
        if (r === 0 && (existing.bestFirstRoundSpw == null || spw < existing.bestFirstRoundSpw)) existing.bestFirstRoundSpw = spw;
        if (r === 1 && (existing.bestSecondRoundSpw == null || spw < existing.bestSecondRoundSpw)) existing.bestSecondRoundSpw = spw;
        if (r === 2 && (existing.bestThirdRoundSpw == null || spw < existing.bestThirdRoundSpw)) existing.bestThirdRoundSpw = spw;
      }
    });

    // Best turn by round (per-session record) — expect provided in totals if present
    if (totals.bestTurnByRound) {
      [0,1,2].forEach(r => {
        const v = totals.bestTurnByRound[r];
        if (typeof v === 'number') {
          if (existing.bestTurnByRound[r] == null || v > existing.bestTurnByRound[r]) existing.bestTurnByRound[r] = v;
        }
      });
    }

    // Max passed per game (session aggregate)
    const totalPassed = totals.wordsPassed || 0;
    if ((totalPassed || 0) > (existing.maxPassedPerGame || 0)) existing.maxPassedPerGame = totalPassed;

    // Precompute median SPW per round for convenience
    existing.medianSpwByRound = {
      0: this._median(existing.perRoundSpwSamples[0]),
      1: this._median(existing.perRoundSpwSamples[1]),
      2: this._median(existing.perRoundSpwSamples[2])
    };

    this._writePlayerStats(playerKey, existing);
    this._rebuildLeaderboards();
  }

  _rebuildLeaderboards() {
    // Build SPW leaderboards (ascending), tie-breakers: more guessed (desc), less active time (asc) — active time not tracked across all-time here, so skip time
    const files = fs.readdirSync(this.playersDir).filter(f => f.endsWith('.json'));
    const players = files.map(f => JSON.parse(fs.readFileSync(path.join(this.playersDir, f), 'utf8')));

    const spwAll = [];
    players.forEach(p => {
      const values = [p.medianSpwByRound && p.medianSpwByRound[0], p.medianSpwByRound && p.medianSpwByRound[1], p.medianSpwByRound && p.medianSpwByRound[2]]
        .filter(v => v != null && isFinite(v));
      if (values.length) {
        const medianAll = this._median(values);
        spwAll.push({ playerKey: p.playerKey, displayName: p.displayName, spw: medianAll, guessed: p.totals.wordsGuessed || 0 });
      }
    });
    spwAll.sort((a,b) => (a.spw - b.spw) || (b.guessed - a.guessed) || a.playerKey.localeCompare(b.playerKey));
    this._atomicWrite(path.join(this.leaderboardsDir, 'spw_all.json'), JSON.stringify(spwAll, null, 2));

    // Best win streak leaderboard
    const streaks = players.map(p => ({ playerKey: p.playerKey, displayName: p.displayName, bestWinStreak: p.bestWinStreak || 0 }))
      .sort((a,b) => (b.bestWinStreak - a.bestWinStreak) || a.playerKey.localeCompare(b.playerKey));
    this._atomicWrite(path.join(this.leaderboardsDir, 'best_streak.json'), JSON.stringify(streaks, null, 2));

    // Median SPW per round leaderboards (ascending)
    [0,1,2].forEach(r => {
      const key = `spw_r${r+1}`;
      const rows = players
        .filter(p => p.medianSpwByRound && p.medianSpwByRound[r] != null)
        .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, spw: p.medianSpwByRound[r] }))
        .sort((a,b) => (a.spw - b.spw) || a.playerKey.localeCompare(b.playerKey));
      this._atomicWrite(path.join(this.leaderboardsDir, `${key}.json`), JSON.stringify(rows, null, 2));
    });

    // Best round SPW records (ascending) for R1/R2/R3
    const bestRound = (field) => players
      .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, value: p[field] }))
      .filter(x => x.value != null && isFinite(x.value))
      .sort((a,b) => (a.value - b.value) || a.playerKey.localeCompare(b.playerKey));
    this._atomicWrite(path.join(this.leaderboardsDir, 'best_round_spw_r1.json'), JSON.stringify(bestRound('bestFirstRoundSpw'), null, 2));
    this._atomicWrite(path.join(this.leaderboardsDir, 'best_round_spw_r2.json'), JSON.stringify(bestRound('bestSecondRoundSpw'), null, 2));
    this._atomicWrite(path.join(this.leaderboardsDir, 'best_round_spw_r3.json'), JSON.stringify(bestRound('bestThirdRoundSpw'), null, 2));

    // Max points per game (descending)
    const bestPoints = players
      .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, maxPointsPerGame: (p.totals && p.totals.maxPointsPerGame) || 0 }))
      .sort((a,b) => (b.maxPointsPerGame - a.maxPointsPerGame) || a.playerKey.localeCompare(b.playerKey));
    this._atomicWrite(path.join(this.leaderboardsDir, 'max_points_per_game.json'), JSON.stringify(bestPoints, null, 2));

    // Max passed per game (descending)
    const maxPassed = players
      .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, maxPassedPerGame: p.maxPassedPerGame || 0 }))
      .sort((a,b) => (b.maxPassedPerGame - a.maxPassedPerGame) || a.playerKey.localeCompare(b.playerKey));
    this._atomicWrite(path.join(this.leaderboardsDir, 'max_passed_per_game.json'), JSON.stringify(maxPassed, null, 2));

    // Best turn per round (descending by points)
    [0,1,2].forEach(r => {
      const key = `best_turn_r${r+1}`;
      const rows = players
        .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, points: p.bestTurnByRound ? (p.bestTurnByRound[r] || 0) : 0 }))
        .sort((a,b) => (b.points - a.points) || a.playerKey.localeCompare(b.playerKey));
      this._atomicWrite(path.join(this.leaderboardsDir, `${key}.json`), JSON.stringify(rows, null, 2));
    });
  }

  readLeaderboard(metric) {
    const file = path.join(this.leaderboardsDir, `${metric}.json`);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
}

module.exports = FileStatsRepository;


