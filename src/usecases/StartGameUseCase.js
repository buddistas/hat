const Game = require('../entities/Game');

/**
 * Юзкейс для начала игры
 */
class StartGameUseCase {
  constructor(wordRepository) {
    this.wordRepository = wordRepository;
  }

  /**
   * Выполняет начало игры
   * @param {Object} data - данные для начала игры
   * @param {Player[]} data.players - игроки
   * @param {Team[]} data.teams - команды
   * @param {Object} data.options - опции игры
   * @returns {Promise<Game>}
   */
  async execute(data) {
    // Обрабатываем данные как от frontend (прямой формат) или как от других сервисов (с options)
    const { players, teams, options = {} } = data;
    
    // Если данные приходят напрямую от frontend, извлекаем их из корневого уровня
    const actualOptions = {
      roundDuration: data.roundDuration || options.roundDuration || 30,
      wordsCount: data.wordsCount || options.wordsCount || 100,
      categories: data.categories || options.categories || null,
      levels: data.levels || options.levels || null,
      hardPercentage: data.hardPercentage || options.hardPercentage || 0
    };
    
    // Создаем новую игру
    const game = new Game();
    
    // Инициализируем игру
    game.initialize(players, teams, actualOptions);
    
    // Инициализируем очередь ходов
    game.initializeTurnOrder();
    
    // Выбираем первого игрока
    if (game.turnOrder.teams.length > 0) {
      const firstTeam = game.turnOrder.teams[0];
      const firstTeamPlayers = game.turnOrder.playersByTeam[firstTeam.id];
      if (firstTeamPlayers.length > 0) {
        game.currentPlayer = firstTeamPlayers[0];
      }
    }
    
    // Выбираем слова
    const selectedWords = await this.wordRepository.selectRandomWords(
      actualOptions.wordsCount, 
      {
        ...game.wordFilters,
        hardPercentage: actualOptions.hardPercentage
      }
    );
    
    game.setSelectedWords(selectedWords.map(w => w.word));
    game.shuffleAvailableWords();
    game.getNextWord();
    
    return game;
  }
}

module.exports = StartGameUseCase;
