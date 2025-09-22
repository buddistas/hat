/**
 * Юзкейс для управления ходами игроков
 */
class TurnManagementUseCase {
  /**
   * Выполняет завершение хода игрока
   * @param {Game} game - состояние игры
   * @param {Object} data - данные события
   * @param {number} data.carriedTime - перенесенное время
   */
  endPlayerTurn(game, data = {}) {
    const { carriedTime } = data;
    game.endPlayerTurn(carriedTime);
  }

  /**
   * Выполняет начало хода следующего игрока
   * @param {Game} game - состояние игры
   */
  startNextPlayerTurn(game) {
    game.startNextPlayerTurn();
    game.shuffleAvailableWords();
    game.getNextWord();
  }

  /**
   * Выполняет переход к следующему раунду
   * @param {Game} game - состояние игры
   * @returns {boolean} - true если игра завершена, false если продолжается
   */
  startNextRound(game) {
    return game.startNextRound();
  }

  /**
   * Сохраняет перенесенное время игрока
   * @param {Game} game - состояние игры
   * @param {Object} data - данные события
   * @param {number} data.carriedTime - перенесенное время
   */
  saveCarriedTime(game, data) {
    const { carriedTime } = data;
    if (game.currentPlayer && carriedTime !== undefined) {
      game.playerCarriedTime[game.currentPlayer.id] = carriedTime;
    }
  }

  /**
   * Использует перенесенное время игрока
   * @param {Game} game - состояние игры
   */
  useCarriedTime(game) {
    if (game.currentPlayer) {
      game.useCarriedTime(game.currentPlayer.id);
    }
  }
}

module.exports = TurnManagementUseCase;
