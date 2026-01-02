const mongoConnection = require('./MongoConnection');
const Game = require('../entities/Game');

/**
 * Репозиторий игры на MongoDB (мульти‑сессионный по gameId)
 */
class MongoGameRepository {
  constructor() {
    this.db = null;
  }

  async _ensureConnection() {
    if (!this.db) {
      this.db = await mongoConnection.connect();
    }
    return this.db;
  }

  /**
   * Сохраняет состояние игры (upsert по gameId)
   * @param {Game} game
   */
  async saveGame(game) {
    const db = await this._ensureConnection();
    if (!game || !game.gameId) throw new Error('saveGame: gameId is required');

    // Храним как плоский JSON документ
    const payload = JSON.parse(JSON.stringify(game));
    payload.updatedAt = new Date();

    await db.collection('games').replaceOne(
      { gameId: game.gameId },
      payload,
      { upsert: true }
    );
  }

  /**
   * Загружает состояние игры по gameId
   * @param {string} gameId
   * @returns {Promise<Game|null>}
   */
  async loadGame(gameId) {
    const db = await this._ensureConnection();
    if (!gameId) throw new Error('loadGame: gameId is required');
    const doc = await db.collection('games').findOne({ gameId });
    if (!doc) return null;
    const { _id, ...plain } = doc; // strip Mongo _id
    const game = new Game();
    Object.assign(game, plain);
    return game;
  }

  /**
   * Удаляет состояние игры и связанные события
   * @param {string} gameId
   */
  async clearGame(gameId) {
    const db = await this._ensureConnection();
    if (!gameId) throw new Error('clearGame: gameId is required');
    await db.collection('games').deleteOne({ gameId });
    // Очищаем события этой сессии, если ведутся
    await db.collection('game_events').deleteMany({ gameId });
  }

  /**
   * Добавляет событие игры в журнал
   * @param {string} gameId
   * @param {Object} event
   */
  async appendEvent(gameId, event) {
    const db = await this._ensureConnection();
    if (!gameId) throw new Error('appendEvent: gameId is required');
    const ts = new Date(event.ts || Date.now());
    await db.collection('game_events').insertOne({ gameId, type: event.type, timestamp: ts, data: event });
  }
}

module.exports = MongoGameRepository;


