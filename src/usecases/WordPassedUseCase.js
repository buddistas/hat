/**
 * Юзкейс для обработки пропущенного слова
 */
class WordPassedUseCase {
  /**
   * Выполняет обработку пропущенного слова
   * @param {Game} game - состояние игры
   * @param {Object} data - данные события
   * @param {string} data.teamId - ID команды
   */
  execute(game, data) {
    const { teamId } = data;
    
    if (!game.currentWord || !teamId) {
      return;
    }
    
    game.wordPassed(teamId);
  }
}

module.exports = WordPassedUseCase;
