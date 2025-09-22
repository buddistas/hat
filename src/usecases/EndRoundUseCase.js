/**
 * Юзкейс для завершения раунда
 */
class EndRoundUseCase {
  /**
   * Выполняет завершение раунда
   * @param {Game} game - состояние игры
   * @param {Object} data - данные события
   * @param {number} data.carriedTime - перенесенное время
   */
  execute(game, data = {}) {
    const { carriedTime } = data;
    game.endRound(carriedTime);
  }
}

module.exports = EndRoundUseCase;
