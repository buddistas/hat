const Player = require('./Player');
const Team = require('./Team');

/**
 * Сущность игры
 */
class Game {
  constructor() {
    this.gameId = null;
    this.players = [];
    this.teams = [];
    this.currentRound = 0;
    this.currentPlayer = null;
    this.currentWord = null;
    this.usedWords = [];
    this.selectedWords = [];
    this.availableWords = [];
    this.passedWords = [];
    this.isPaused = false;
    this.scores = {};
    this.roundDuration = 30;
    
    // Очередность ходов
    this.turnOrder = {
      teams: [],
      playersByTeam: {},
      currentTeamIndex: 0,
      currentPlayerIndex: 0
    };
    
    // Состояние передачи хода
    this.isHandoffScreen = false;
    this.nextPlayer = null;
    
    // Перенесенное время
    this.playerCarriedTime = {};
    
    // Статистика по раундам для команд
    this.teamStatsByRound = {
      0: {},
      1: {},
      2: {}
    };
    
    // Личная статистика игроков
    this.playerStats = {};
    
    // Фильтры слов
    this.wordFilters = {
      categories: null,
      levels: null
    };

    // Пропущенные слова по игрокам (персистентны между раундами)
    this.missedWordsByPlayer = {};

    // Технические флаги для текущего слова
    this.currentWordFromMissed = false;
    this.currentWordMissedOwnerId = null;
  }

  /**
   * Инициализирует игру
   */
  initialize(players, teams, options = {}) {
    this.players = players.map(p => new Player(p.id, p.name, p.teamId, p.playerKey || null));
    this.teams = teams.map(t => new Team(t.id, t.name, t.players || []));
    this.currentRound = 0;
    this.usedWords = [];
    this.passedWords = [];
    this.scores = {};
    this.roundDuration = options.roundDuration || 30;
    this.isHandoffScreen = false;
    this.nextPlayer = null;
    this.playerCarriedTime = {};
    
    // Инициализация статистики
    this.teamStatsByRound = { 0: {}, 1: {}, 2: {} };
    this.playerStats = {};
    this.missedWordsByPlayer = {};
    this.currentWordFromMissed = false;
    this.currentWordMissedOwnerId = null;
    
    // Фильтры слов
    this.wordFilters = {
      categories: options.categories || null,
      levels: options.levels || null
    };
    
    // Инициализация счетов команд
    this.teams.forEach(team => {
      this.scores[team.id] = 0;
      this.teamStatsByRound[0][team.id] = 0;
      this.teamStatsByRound[1][team.id] = 0;
      this.teamStatsByRound[2][team.id] = 0;
    });
    
    // Инициализация личной статистики игроков
    this.players.forEach(player => {
      this.playerStats[player.id] = {
        guessed: 0,
        passed: 0,
        totalScore: 0
      };
    });
  }

  /**
   * Устанавливает выбранные слова
   */
  setSelectedWords(words) {
    this.selectedWords = [...words];
    this.availableWords = [...words];
  }

  /**
   * Инициализирует очередь ходов
   */
  initializeTurnOrder() {
    // Детеминированный порядок команд (как объявлены)
    this.turnOrder.teams = [...this.teams];
    this.turnOrder.currentTeamIndex = 0;
    this.turnOrder.currentPlayerIndex = 0;
    
    // Детеминированный порядок игроков внутри каждой команды
    this.turnOrder.playersByTeam = {};
    this.teams.forEach(team => {
      const teamPlayers = this.players.filter(player => 
        team.hasPlayer(player.id)
      );
      this.turnOrder.playersByTeam[team.id] = [...teamPlayers];
    });
  }

  /**
   * Получает текущего игрока
   */
  getCurrentPlayer() {
    return this.currentPlayer;
  }

  /**
   * Получает следующего игрока
   */
  getNextPlayer() {
    return this.nextPlayer;
  }

  /**
   * Переключает ход к следующему игроку
   */
  switchToNextPlayer() {
    if (!this.turnOrder.teams || this.turnOrder.teams.length === 0) return;
    
    // Переходим к следующей команде
    this.turnOrder.currentTeamIndex = (this.turnOrder.currentTeamIndex + 1) % this.turnOrder.teams.length;
    
    // Если мы вернулись к первой команде, переходим к следующему игроку
    if (this.turnOrder.currentTeamIndex === 0) {
      this.turnOrder.currentPlayerIndex++;
    }
    
    // Получаем текущую команду
    const currentTeam = this.turnOrder.teams[this.turnOrder.currentTeamIndex];
    const currentTeamPlayers = this.turnOrder.playersByTeam[currentTeam.id];
    
    // Если индекс игрока превышает количество игроков в команде, сбрасываем его
    if (this.turnOrder.currentPlayerIndex >= currentTeamPlayers.length) {
      this.turnOrder.currentPlayerIndex = 0;
    }
    
    this.nextPlayer = currentTeamPlayers[this.turnOrder.currentPlayerIndex];
  }

  /**
   * Начинает ход следующего игрока
   */
  startNextPlayerTurn() {
    if (!this.nextPlayer) return;
    
    this.currentPlayer = this.nextPlayer;
    this.nextPlayer = null;
    this.isHandoffScreen = false;
  }

  /**
   * Завершает ход текущего игрока
   */
  endPlayerTurn(carriedTime = null) {
    if (this.currentPlayer && carriedTime !== null) {
      this.playerCarriedTime[this.currentPlayer.id] = carriedTime;
    }
    
    this.currentWord = null;
    this.switchToNextPlayer();
    this.isHandoffScreen = true;
  }

  /**
   * Показывает экран передачи хода
   */
  showHandoffScreen() {
    this.isHandoffScreen = true;
  }

  /**
   * Перемешивает доступные слова
   */
  shuffleAvailableWords() {
    if (this.availableWords && this.availableWords.length > 0) {
      for (let i = this.availableWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.availableWords[i], this.availableWords[j]] = 
        [this.availableWords[j], this.availableWords[i]];
      }
    }
  }

  /**
   * Получает следующее слово
   */
  getNextWord() {
    // Если основной пул пуст — слов нет вовсе
    if (!this.availableWords || this.availableWords.length === 0) {
      this.currentWord = null;
      this.currentWordFromMissed = false;
      this.currentWordMissedOwnerId = null;
      return null;
    }

    // Если у игрока есть личный черный список, сначала пытаемся выбрать слово, которого в нем нет
    const playerId = this.currentPlayer ? this.currentPlayer.id : null;
    if (playerId) {
      const missedSet = new Set(this.missedWordsByPlayer[playerId] || []);
      const preferred = this.availableWords.find(w => !missedSet.has(w));
      if (preferred) {
        this.currentWordFromMissed = false;
        this.currentWordMissedOwnerId = null;
        this.currentWord = preferred;
        return this.currentWord;
      }
      // Все оставшиеся слова — из черного списка: можно показывать их
      this.currentWordFromMissed = true;
      this.currentWordMissedOwnerId = playerId;
      this.currentWord = this.availableWords[0];
      return this.currentWord;
    }

    // Нет текущего игрока: берем первое доступное
    this.currentWordFromMissed = false;
    this.currentWordMissedOwnerId = null;
    this.currentWord = this.availableWords[0];
    return this.currentWord;
  }

  /**
   * Обрабатывает угаданное слово
   */
  wordGuessed(teamId) {
    if (!this.currentWord || !teamId) return false;
    
    const oldScore = this.scores[teamId] || 0;
    const oldRoundScore = this.teamStatsByRound[this.currentRound][teamId] || 0;
    
    this.scores[teamId] = oldScore + 1;
    this.teamStatsByRound[this.currentRound][teamId] = oldRoundScore + 1;
    
    // Обновляем личную статистику игрока
    if (this.currentPlayer) {
      this.playerStats[this.currentPlayer.id].guessed += 1;
      this.playerStats[this.currentPlayer.id].totalScore += 1;
    }
    
    // Удаляем угаданное слово из пула доступных (всегда)
    const guessedWord = this.currentWord;
    const wordIndex = this.availableWords.indexOf(guessedWord);
    if (wordIndex !== -1) {
      this.availableWords.splice(wordIndex, 1);
    }
    
    this.usedWords.push(guessedWord);
    
    // Выбираем следующее слово; если его нет ни в одном источнике — раунд завершен
    const next = this.getNextWord();
    return next === null;
  }

  /**
   * Обрабатывает пропущенное слово
   */
  wordPassed(teamId) {
    if (!this.currentWord || !teamId) return;
    
    this.scores[teamId] = (this.scores[teamId] || 0) - 1;
    this.teamStatsByRound[this.currentRound][teamId] = 
      (this.teamStatsByRound[this.currentRound][teamId] || 0) - 1;
    
    // Обновляем личную статистику игрока
    if (this.currentPlayer) {
      this.playerStats[this.currentPlayer.id].passed += 1;
      this.playerStats[this.currentPlayer.id].totalScore -= 1;
    }
    
    // Перемещаем пропущенное слово в конец очереди и добавляем копию в личный черный список
    const currentWord = this.currentWord;
    const wordIndex2 = this.availableWords.indexOf(currentWord);
    if (wordIndex2 !== -1) {
      this.availableWords.splice(wordIndex2, 1);
      this.availableWords.push(currentWord);
    }
    if (this.currentPlayer) {
      const playerId = this.currentPlayer.id;
      if (!this.missedWordsByPlayer[playerId]) {
        this.missedWordsByPlayer[playerId] = [];
      }
      if (!this.missedWordsByPlayer[playerId].includes(currentWord)) {
        this.missedWordsByPlayer[playerId].push(currentWord);
      }
    }
    
    // Добавляем в список пропущенных слов
    this.passedWords.push({
      word: currentWord,
      player: this.currentPlayer,
      team: teamId,
      timestamp: Date.now()
    });
    
    this.getNextWord();
  }

  /**
   * Завершает раунд
   */
  endRound(carriedTime = null) {
    if (this.currentPlayer && carriedTime !== null) {
      this.playerCarriedTime[this.currentPlayer.id] = carriedTime;
    }
  }

  /**
   * Начинает следующий раунд
   */
  startNextRound() {
    this.currentRound++;
    
    // На старте 2-го и 3-го раунда поднимаем сохраненное время до минимума 5 секунд
    // Внутренние индексы раундов: 0 (первый), 1 (второй), 2 (третий)
    if (this.currentRound === 1 || this.currentRound === 2) {
      if (this.playerCarriedTime) {
        Object.keys(this.playerCarriedTime).forEach(playerId => {
          const timeMs = this.playerCarriedTime[playerId];
          if (typeof timeMs === 'number' && timeMs > 0 && timeMs < 5) {
            this.playerCarriedTime[playerId] = 5;
          }
        });
      }
    }

    if (this.currentRound > 3) {
      // Игра завершена
      this.currentWord = null;
      this.playerCarriedTime = {};
      // Очистка личных списков пропущенных при завершении сессии
      this.missedWordsByPlayer = {};
      this.currentWordFromMissed = false;
      this.currentWordMissedOwnerId = null;
      return true; // Игра завершена
    } else {
      // Сброс для нового раунда
      this.usedWords = [];
      this.passedWords = [];
      this.availableWords = [...this.selectedWords];
      this.shuffleAvailableWords();
      
      // Инициализация статистики для нового раунда
      this.teamStatsByRound[this.currentRound] = {};
      this.teams.forEach(team => {
        this.teamStatsByRound[this.currentRound][team.id] = 0;
      });
      
      this.getNextWord();
      return false; // Игра продолжается
    }
  }

  /**
   * Приостанавливает игру
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Возобновляет игру
   */
  resume() {
    this.isPaused = false;
  }

  /**
   * Получает перенесенное время игрока
   */
  getCarriedTime(playerId) {
    return this.playerCarriedTime[playerId] || 0;
  }

  /**
   * Использует перенесенное время игрока
   */
  useCarriedTime(playerId) {
    if (this.playerCarriedTime[playerId]) {
      delete this.playerCarriedTime[playerId];
    }
  }

  /**
   * Проверяет, завершена ли игра
   */
  isGameFinished() {
    return this.currentRound > 3;
  }

  /**
   * Проверяет, завершен ли раунд
   */
  isRoundFinished() {
    return this.currentWord === null;
  }

  /**
   * Создает копию состояния игры
   */
  clone() {
    const cloned = new Game();
    Object.assign(cloned, JSON.parse(JSON.stringify(this)));
    return cloned;
  }
}

module.exports = Game;
