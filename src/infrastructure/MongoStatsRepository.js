const mongoConnection = require('./MongoConnection');

/**
 * MongoDB репозиторий для статистики
 * Реализует тот же интерфейс, что и FileStatsRepository
 */
class MongoStatsRepository {
  constructor() {
    this.db = null;
  }

  /**
   * Инициализация подключения к базе данных
   */
  async _ensureConnection() {
    if (!this.db) {
      this.db = await mongoConnection.connect();
    }
    return this.db;
  }

  /**
   * Начинает логирование сессии
   */
  async startSessionLog(gameId) {
    const db = await this._ensureConnection();
    
    // Удаляем предыдущую сессию с таким же gameId, если существует
    await db.collection('game_events').deleteMany({ gameId });
    
    // Создаем начальное событие сессии
    await db.collection('game_events').insertOne({
      gameId,
      type: 'SESSION_STARTED',
      timestamp: new Date(),
      data: { gameId }
    });
  }

  /**
   * Добавляет событие в лог сессии
   */
  async appendSessionEvent(gameId, event) {
    const db = await this._ensureConnection();
    
    await db.collection('game_events').insertOne({
      gameId,
      type: event.type,
      timestamp: new Date(event.ts || Date.now()),
      data: event
    });
  }

  /**
   * Завершает логирование сессии
   */
  async finishSessionLog(gameId) {
    const db = await this._ensureConnection();
    
    await db.collection('game_events').insertOne({
      gameId,
      type: 'SESSION_ENDED',
      timestamp: new Date(),
      data: { gameId }
    });
  }

  /**
   * Читает статистику игрока
   */
  async readPlayerStats(playerKey) {
    const db = await this._ensureConnection();
    
    const playerStats = await db.collection('player_stats').findOne({ playerKey });
    return playerStats;
  }

  /**
   * Записывает статистику игрока
   */
  async _writePlayerStats(playerKey, data) {
    const db = await this._ensureConnection();
    
    await db.collection('player_stats').replaceOne(
      { playerKey },
      { ...data, updatedAt: new Date() },
      { upsert: true }
    );
  }

  /**
   * Вычисляет медиану массива значений
   */
  _median(values) {
    if (!values.length) return null;
    const arr = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  /**
   * Применяет результаты сессии к статистике игрока
   */
  async applyPlayerSessionTotals(game, playerId, totals, winnersInfo) {
    // Обновляем ТОЛЬКО если определены победители (игра корректно завершена)
    if (!winnersInfo || !Array.isArray(winnersInfo.winners) || winnersInfo.winners.length === 0) {
      return; // не обновляем глобальную персональную статистику
    }

    const player = (game.players || []).find(p => p.id === playerId) || { id: playerId, name: String(playerId) };
    const playerKey = player.playerKey || `name:${player.name}`;
    
    const existing = await this.readPlayerStats(playerKey) || {
      playerKey,
      displayName: player.name,
      totals: { gamesPlayed: 0, wins: 0, wordsGuessed: 0, wordsPassed: 0, totalScore: 0, maxPointsPerGame: 0 },
      perRoundSpwSamples: { r0: [], r1: [], r2: [] },
      bestFirstRoundSpw: null,
      bestSecondRoundSpw: null,
      bestThirdRoundSpw: null,
      bestTurnByRound: { r0: null, r1: null, r2: null },
      maxPassedPerGame: 0,
      bestWinStreak: 0,
      currentWinStreak: 0,
      lastPlayedAt: null
    };

    existing.totals.gamesPlayed += 1; // только когда определены победители
    existing.totals.wordsGuessed += (totals.wordsGuessed || 0);
    existing.totals.wordsPassed += (totals.wordsPassed || 0);
    existing.totals.totalScore += (totals.totalScore || 0);
    if ((totals.totalScore || 0) > (existing.totals.maxPointsPerGame || 0)) {
      existing.totals.maxPointsPerGame = totals.totalScore || 0;
    }
    existing.lastPlayedAt = new Date();

    // Победы (ничьи считаются как победы)
    const teamId = player.teamId;
    if (winnersInfo && winnersInfo.winners && teamId && winnersInfo.winners.includes(teamId)) {
      existing.totals.wins += 1;
      existing.currentWinStreak += 1;
      if (existing.currentWinStreak > existing.bestWinStreak) existing.bestWinStreak = existing.currentWinStreak;
    } else {
      existing.currentWinStreak = 0;
    }

    // Собираем образцы SPW и лучший SPW раунда (рекорд за сессию)
    [0, 1, 2].forEach(r => {
      const spw = totals.spwByRound[r];
      if (spw != null && isFinite(spw)) existing.perRoundSpwSamples[`r${r}`].push(spw);
      if (spw != null && isFinite(spw)) {
        if (r === 0 && (existing.bestFirstRoundSpw == null || spw < existing.bestFirstRoundSpw)) existing.bestFirstRoundSpw = spw;
        if (r === 1 && (existing.bestSecondRoundSpw == null || spw < existing.bestSecondRoundSpw)) existing.bestSecondRoundSpw = spw;
        if (r === 2 && (existing.bestThirdRoundSpw == null || spw < existing.bestThirdRoundSpw)) existing.bestThirdRoundSpw = spw;
      }
    });

    // Лучший ход по раундам (рекорд за сессию) — ожидается в totals если присутствует
    if (totals.bestTurnByRound) {
      [0, 1, 2].forEach(r => {
        const v = totals.bestTurnByRound[r];
        if (typeof v === 'number') {
          if (existing.bestTurnByRound[`r${r}`] == null || v > existing.bestTurnByRound[`r${r}`]) existing.bestTurnByRound[`r${r}`] = v;
        }
      });
    }

    // Максимум пропущенных за игру (агрегат сессии)
    const totalPassed = totals.wordsPassed || 0;
    if ((totalPassed || 0) > (existing.maxPassedPerGame || 0)) existing.maxPassedPerGame = totalPassed;

    // Предварительно вычисляем медиану SPW по раундам для удобства
    existing.medianSpwByRound = {
      r0: this._median(existing.perRoundSpwSamples.r0),
      r1: this._median(existing.perRoundSpwSamples.r1),
      r2: this._median(existing.perRoundSpwSamples.r2)
    };

    await this._writePlayerStats(playerKey, existing);
    await this._rebuildLeaderboards();
  }

  /**
   * Перестраивает лидерборды
   */
  async _rebuildLeaderboards() {
    const db = await this._ensureConnection();
    
    // Получаем всех игроков
    const players = await db.collection('player_stats').find({}).toArray();

    // Строим лидерборд SPW (по возрастанию), тай-брейкеры: больше угаданных (убыв), меньше активного времени (возр) — активное время не отслеживается здесь, поэтому пропускаем время
    const spwAll = [];
    players.forEach(p => {
      const values = [p.medianSpwByRound && p.medianSpwByRound.r0, p.medianSpwByRound && p.medianSpwByRound.r1, p.medianSpwByRound && p.medianSpwByRound.r2]
        .filter(v => v != null && isFinite(v));
      if (values.length) {
        const medianAll = this._median(values);
        spwAll.push({ playerKey: p.playerKey, displayName: p.displayName, spw: medianAll, guessed: p.totals.wordsGuessed || 0 });
      }
    });
    spwAll.sort((a, b) => (a.spw - b.spw) || (b.guessed - a.guessed) || a.playerKey.localeCompare(b.playerKey));
    await this._updateLeaderboard('spw_all', spwAll);

    // Лидерборд лучших серий побед
    const streaks = players.map(p => ({ playerKey: p.playerKey, displayName: p.displayName, bestWinStreak: p.bestWinStreak || 0 }))
      .sort((a, b) => (b.bestWinStreak - a.bestWinStreak) || a.playerKey.localeCompare(b.playerKey));
    await this._updateLeaderboard('best_streak', streaks);

    // Медианные SPW по раундам (по возрастанию)
    for (const r of [0, 1, 2]) {
      const key = `spw_r${r + 1}`;
      const rows = players
        .filter(p => p.medianSpwByRound && p.medianSpwByRound[`r${r}`] != null)
        .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, spw: p.medianSpwByRound[`r${r}`] }))
        .sort((a, b) => (a.spw - b.spw) || a.playerKey.localeCompare(b.playerKey));
      await this._updateLeaderboard(key, rows);
    }

    // Лучшие SPW раундов (по возрастанию) для R1/R2/R3
    const bestRound = (field) => players
      .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, value: p[field] }))
      .filter(x => x.value != null && isFinite(x.value))
      .sort((a, b) => (a.value - b.value) || a.playerKey.localeCompare(b.playerKey));
    
    await this._updateLeaderboard('best_round_spw_r1', bestRound('bestFirstRoundSpw'));
    await this._updateLeaderboard('best_round_spw_r2', bestRound('bestSecondRoundSpw'));
    await this._updateLeaderboard('best_round_spw_r3', bestRound('bestThirdRoundSpw'));

    // Максимум очков за игру (по убыванию)
    const bestPoints = players
      .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, maxPointsPerGame: (p.totals && p.totals.maxPointsPerGame) || 0 }))
      .sort((a, b) => (b.maxPointsPerGame - a.maxPointsPerGame) || a.playerKey.localeCompare(b.playerKey));
    await this._updateLeaderboard('max_points_per_game', bestPoints);

    // Максимум пропущенных за игру (по убыванию)
    const maxPassed = players
      .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, maxPassedPerGame: p.maxPassedPerGame || 0 }))
      .sort((a, b) => (b.maxPassedPerGame - a.maxPassedPerGame) || a.playerKey.localeCompare(b.playerKey));
    await this._updateLeaderboard('max_passed_per_game', maxPassed);

    // Лучший ход по раундам (по убыванию очков)
    for (const r of [0, 1, 2]) {
      const key = `best_turn_r${r + 1}`;
      const rows = players
        .map(p => ({ playerKey: p.playerKey, displayName: p.displayName, points: p.bestTurnByRound ? (p.bestTurnByRound[`r${r}`] || 0) : 0 }))
        .sort((a, b) => (b.points - a.points) || a.playerKey.localeCompare(b.playerKey));
      await this._updateLeaderboard(key, rows);
    }
  }

  /**
   * Обновляет лидерборд в базе данных
   */
  async _updateLeaderboard(metric, data) {
    const db = await this._ensureConnection();
    
    await db.collection('leaderboards').replaceOne(
      { metric },
      { 
        metric, 
        data: data.map((item, index) => ({ ...item, rank: index + 1 })),
        updatedAt: new Date()
      },
      { upsert: true }
    );
  }

  /**
   * Читает лидерборд
   */
  async readLeaderboard(metric) {
    const db = await this._ensureConnection();
    
    const leaderboard = await db.collection('leaderboards').findOne({ metric });
    return leaderboard ? leaderboard.data : [];
  }

  /**
   * Сохраняет игру в базе данных
   */
  async saveGame(game) {
    const db = await this._ensureConnection();
    
    const gameData = {
      gameId: game.gameId,
      startedAt: new Date(game.startedAt || Date.now()),
      endedAt: game.endedAt ? new Date(game.endedAt) : null,
      players: game.players || [],
      teams: game.teams || [],
      winners: game.winners || [],
      facts: game.facts || {},
      duration: game.duration || {},
      updatedAt: new Date()
    };

    await db.collection('games').replaceOne(
      { gameId: game.gameId },
      gameData,
      { upsert: true }
    );
  }

  /**
   * Загружает игру из базы данных
   */
  async loadGame(gameId) {
    const db = await this._ensureConnection();
    
    const game = await db.collection('games').findOne({ gameId });
    return game;
  }

  /**
   * Очищает игру из базы данных
   */
  async clearGame(gameId) {
    const db = await this._ensureConnection();
    
    await db.collection('games').deleteOne({ gameId });
    await db.collection('game_events').deleteMany({ gameId });
  }
}

module.exports = MongoStatsRepository;
