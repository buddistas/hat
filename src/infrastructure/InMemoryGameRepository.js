const Game = require('../entities/Game');

/**
 * Репозиторий для работы с игрой в памяти
 */
class InMemoryGameRepository {
  constructor() {
    this.game = null;
  }

  /**
   * Сохраняет состояние игры
   */
  async saveGame(game) {
    this.game = game.clone();
  }

  /**
   * Загружает состояние игры
   */
  async loadGame() {
    return this.game ? this.game.clone() : null;
  }

  /**
   * Очищает состояние игры
   */
  async clearGame() {
    this.game = null;
  }
}

module.exports = InMemoryGameRepository;
