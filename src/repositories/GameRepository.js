/**
 * Интерфейс репозитория для работы с игрой
 */
class GameRepository {
  /**
   * Сохраняет состояние игры
   * @param {Game} game - состояние игры
   * @returns {Promise<void>}
   */
  async saveGame(game) {
    throw new Error('Method saveGame must be implemented');
  }

  /**
   * Загружает состояние игры
   * @returns {Promise<Game>}
   */
  async loadGame() {
    throw new Error('Method loadGame must be implemented');
  }

  /**
   * Очищает состояние игры
   * @returns {Promise<void>}
   */
  async clearGame() {
    throw new Error('Method clearGame must be implemented');
  }
}

module.exports = GameRepository;
