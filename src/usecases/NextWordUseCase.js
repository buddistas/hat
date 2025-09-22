/**
 * Юзкейс для получения следующего слова
 */
class NextWordUseCase {
  /**
   * Выполняет получение следующего слова
   * @param {Game} game - состояние игры
   * @returns {string|null} - следующее слово или null если слова закончились
   */
  execute(game) {
    return game.getNextWord();
  }
}

module.exports = NextWordUseCase;
