/**
 * Юзкейс для обработки угаданного слова
 */
class WordGuessedUseCase {
  /**
   * Выполняет обработку угаданного слова
   * @param {Game} game - состояние игры
   * @param {Object} data - данные события
   * @param {string} data.teamId - ID команды
   * @returns {boolean} - true если раунд завершен, false если продолжается
   */
  execute(game, data) {
    const { teamId } = data;
    
    if (!game.currentWord || !teamId) {
      return false;
    }
    
    return game.wordGuessed(teamId);
  }
}

module.exports = WordGuessedUseCase;
