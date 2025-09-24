/**
 * Интерфейс репозитория для работы со словами
 */
class WordRepository {
  /**
   * Загружает все слова
   * @returns {Promise<WordEntry[]>}
   */
  async loadWords() {
    throw new Error('Method loadWords must be implemented');
  }

  /**
   * Получает слова по фильтрам
   * @param {Object} filters - фильтры
   * @param {string[]} filters.categories - категории
   * @param {string[]} filters.levels - уровни сложности
   * @returns {Promise<WordEntry[]>}
   */
  async getWordsByFilters(filters) {
    throw new Error('Method getWordsByFilters must be implemented');
  }

  /**
   * Выбирает случайные слова
   * @param {number} count - количество слов
   * @param {Object} filters - фильтры
   * @param {string[]} filters.categories - категории
   * @param {string[]} filters.levels - уровни сложности
   * @param {number} filters.hardPercentage - процент сложных слов (0-100)
   * @returns {Promise<WordEntry[]>}
   */
  async selectRandomWords(count, filters = {}) {
    throw new Error('Method selectRandomWords must be implemented');
  }
}

module.exports = WordRepository;
