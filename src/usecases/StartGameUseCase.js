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
    game.gameId = data.gameId || `game-${Date.now()}`;
    
    // Инициализируем игру
    // Attach playerKey (tg:<id> or name:<sha1(normalizedDisplayName)>) if provided; otherwise null
    const crypto = require('crypto');
    const normalizeName = (s) => (s || '').toString().trim().toLowerCase();
    const toSha1 = (s) => crypto.createHash('sha1').update(s, 'utf8').digest('hex');
    const playersWithKeys = (players || []).map(p => {
      if (p.playerKey) return p;
      if (p.telegramUserId) return { ...p, playerKey: `tg:${p.telegramUserId}` };
      if (p.name) return { ...p, playerKey: `name:${toSha1(normalizeName(p.name))}` };
      return { ...p, playerKey: null };
    });
    game.initialize(playersWithKeys, teams, actualOptions);
    
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
