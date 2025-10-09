const StartGameUseCase = require('../usecases/StartGameUseCase');
const WordGuessedUseCase = require('../usecases/WordGuessedUseCase');
const WordPassedUseCase = require('../usecases/WordPassedUseCase');
const NextWordUseCase = require('../usecases/NextWordUseCase');
const EndRoundUseCase = require('../usecases/EndRoundUseCase');
const TurnManagementUseCase = require('../usecases/TurnManagementUseCase');

/**
 * Сервис для управления игрой
 */
class GameService {
  constructor(wordRepository, gameRepository, webSocketHandler) {
    this.wordRepository = wordRepository;
    this.gameRepository = gameRepository;
    this.webSocketHandler = webSocketHandler;
    
    // Инициализация юзкейсов
    this.startGameUseCase = new StartGameUseCase(wordRepository);
    this.wordGuessedUseCase = new WordGuessedUseCase();
    this.wordPassedUseCase = new WordPassedUseCase();
    this.nextWordUseCase = new NextWordUseCase();
    this.endRoundUseCase = new EndRoundUseCase();
    this.turnManagementUseCase = new TurnManagementUseCase();
    
    this.game = null;
    this.statsService = webSocketHandler ? webSocketHandler.statsService : null;
  }

  /**
   * Обрабатывает игровые события
   */
  async handleEvent(event) {
    const { type, data } = event;
    
    switch (type) {
      case 'start_game':
        return await this.handleStartGame(data);
        
      case 'next_word':
        return this.handleNextWord();
        
      case 'word_guessed':
        return this.handleWordGuessed(data);
        
      case 'word_passed':
        return this.handleWordPassed(data);
        
      case 'pause_game':
        return this.handlePauseGame();
        
      case 'resume_game':
        return this.handleResumeGame();
        
      case 'end_round':
        return this.handleEndRound(data);
        
      case 'continue_round':
        return this.handleContinueRound();
        
      case 'time_up':
        return this.handleTimeUp(data);
        
      case 'start_next_turn':
        return this.handleStartNextTurn();
        
      case 'round_completed_carried_time':
        return this.handleRoundCompletedCarriedTime(data);
        
      case 'carried_time_used':
        return this.handleCarriedTimeUsed();
        
      case 'clear_game':
        return this.handleClearGame();
        
      default:
        console.log('Неизвестное событие:', type);
        return false;
    }
  }

  /**
   * Обрабатывает начало игры
   */
  async handleStartGame(data) {
    this.game = await this.startGameUseCase.execute(data);
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    if (this.statsService) this.statsService.startSession(this.game);
    return true;
  }

  /**
   * Обрабатывает получение следующего слова
   */
  handleNextWord() {
    if (!this.game) return false;
    
    this.nextWordUseCase.execute(this.game);
    
    // Отслеживание показа слова для статистики
    if (this.statsService && this.game.currentWord) {
      this.statsService.onWordShown(this.game.currentWord);
    }
    
    return true;
  }

  /**
   * Обрабатывает угаданное слово
   */
  async handleWordGuessed(data) {
    if (!this.game) return false;
    
    const roundFinished = this.wordGuessedUseCase.execute(this.game, data);
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    if (this.statsService && this.game.currentPlayer) this.statsService.onWordGuessed(this.game.currentPlayer.id, this.game.currentRound);
    
    if (roundFinished) {
      this.endRoundUseCase.execute(this.game);
      // Важно: сначала отправляем обновленное состояние игры,
      // чтобы клиенты увидели последнюю статистику перед экраном результатов раунда
      this.webSocketHandler.broadcastGameState();
      this.webSocketHandler.broadcastRoundCompleted(
        this.game.currentRound + 1,
        this.game.scores
      );
    }
    
    return !roundFinished; // Возвращаем true только если раунд не завершен
  }

  /**
   * Обрабатывает пропущенное слово
   */
  async handleWordPassed(data) {
    if (!this.game) return false;
    
    this.wordPassedUseCase.execute(this.game, data);
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    if (this.statsService && this.game.currentPlayer) this.statsService.onWordPassed(this.game.currentPlayer.id, this.game.currentRound);
    return true;
  }

  /**
   * Обрабатывает приостановку игры
   */
  async handlePauseGame() {
    if (!this.game) return false;
    
    this.game.pause();
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    if (this.statsService) this.statsService.pause();
    return true;
  }

  /**
   * Обрабатывает возобновление игры
   */
  async handleResumeGame() {
    if (!this.game) return false;
    
    this.game.resume();
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    if (this.statsService) this.statsService.resume();
    return true;
  }

  /**
   * Обрабатывает завершение раунда
   */
  handleEndRound(data) {
    if (!this.game) return false;
    
    this.endRoundUseCase.execute(this.game, data);
    if (this.statsService) {
      this.statsService.endTurn();
      this.statsService.onEndRound(this.game.currentRound, this.game.scores);
    }
    // Сначала обновленное состояние, затем событие завершения раунда
    this.webSocketHandler.broadcastGameState();
    this.webSocketHandler.broadcastRoundCompleted(
      this.game.currentRound + 1,
      this.game.scores
    );
    return false; // Не отправляем game_state
  }

  /**
   * Обрабатывает продолжение раунда
   */
  async handleContinueRound() {
    if (!this.game) return false;
    
    const gameFinished = this.turnManagementUseCase.startNextRound(this.game);
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    
    if (gameFinished) {
      if (this.statsService) this.statsService.endSession(this.game);
      // Сохраняем финальные результаты игры
      await this.gameRepository.saveGame(this.game);
      this.webSocketHandler.broadcastGameEnded(this.game);
    }
    
    return true;
  }

  /**
   * Обрабатывает истечение времени
   */
  async handleTimeUp(data) {
    if (!this.game) return false;
    
    this.turnManagementUseCase.endPlayerTurn(this.game, data);
    if (this.statsService) {
      // Передаем время, оставшееся на таймере в момент истечения
      const timerRemainingAtShow = data && data.timerRemainingAtShow ? data.timerRemainingAtShow : null;
      this.statsService.endTurn(timerRemainingAtShow);
    }
    this.webSocketHandler.broadcastHandoffScreen(
      this.game.nextPlayer,
      this.game.currentRound
    );
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    return false; // Не отправляем game_state
  }

  /**
   * Обрабатывает начало следующего хода
   */
  async handleStartNextTurn() {
    if (!this.game) return false;
    
    this.turnManagementUseCase.startNextPlayerTurn(this.game);
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    if (this.statsService && this.game.currentPlayer) this.statsService.startTurn(this.game.currentPlayer.id, this.game.currentRound);
    return true;
  }

  /**
   * Обрабатывает сохранение перенесенного времени
   */
  async handleRoundCompletedCarriedTime(data) {
    if (!this.game) return false;
    
    this.turnManagementUseCase.saveCarriedTime(this.game, data);
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    return false; // Не отправляем game_state
  }

  /**
   * Обрабатывает использование перенесенного времени
   */
  async handleCarriedTimeUsed() {
    if (!this.game) return false;
    
    this.turnManagementUseCase.useCarriedTime(this.game);
    // Убираем постоянное сохранение состояния - сохраняем только в конце игры
    return false; // Не отправляем game_state
  }

  /**
   * Обрабатывает очистку игры
   */
  async handleClearGame() {
    await this.clearGame();
    return false; // Не отправляем game_state
  }

  /**
   * Получает текущее состояние игры
   */
  getGameState() {
    return this.game;
  }

  /**
   * Загружает игру из репозитория
   */
  async loadGame() {
    this.game = await this.gameRepository.loadGame();
    return this.game;
  }

  /**
   * Получает статус игры для Telegram-бота
   */
  async getGameStatus() {
    const gameState = this.getGameState();
    return {
      isActive: gameState && gameState.players && gameState.players.length > 0,
      playersCount: gameState ? gameState.players.length : 0,
      maxPlayers: gameState ? gameState.maxPlayers || 20 : 20,
      gameId: gameState ? gameState.gameId : null,
      currentRound: gameState ? gameState.currentRound : null,
      currentPlayer: gameState ? gameState.currentPlayer : null
    };
  }

  /**
   * Запускает новую игру
   */
  async startNewGame() {
    if (this.game && this.game.players && this.game.players.length > 0) {
      throw new Error('Game is already active');
    }
    
    const gameId = `game-${Date.now()}`;
    this.game = {
      gameId,
      players: [],
      teams: [],
      currentRound: 0,
      currentPlayer: null,
      currentWord: null,
      availableWords: [],
      usedWords: [],
      teamStatsByRound: { 0: {}, 1: {}, 2: {} },
      playerStats: {},
      playerCarriedTime: {},
      maxPlayers: 20
    };
    
    return gameId;
  }

  /**
   * Добавляет игрока в игру
   */
  async addPlayer(username, displayName) {
    const gameState = this.getGameState();
    if (!gameState) {
      throw new Error('No active game');
    }
    
    if (gameState.players.length >= (gameState.maxPlayers || 20)) {
      throw new Error('Game is full');
    }
    
    // Проверяем, не участвует ли уже игрок
    const existingPlayer = gameState.players.find(p => p.id === username);
    if (existingPlayer) {
      return false; // Игрок уже в игре
    }
    
    const player = {
      id: username,
      name: displayName || username,
      teamId: null
    };
    
    gameState.players.push(player);
    return true;
  }

  /**
   * Удаляет игрока из игры
   */
  async removePlayer(username) {
    const gameState = this.getGameState();
    if (!gameState) {
      throw new Error('No active game');
    }
    
    const playerIndex = gameState.players.findIndex(p => p.id === username);
    if (playerIndex === -1) {
      return false; // Игрок не найден
    }
    
    gameState.players.splice(playerIndex, 1);
    return true;
  }

  /**
   * Завершает игру
   */
  async endGame() {
    const gameState = this.getGameState();
    if (!gameState) {
      throw new Error('No active game');
    }
    
    // Очищаем состояние игры
    this.game = null;
    return true;
  }

  /**
   * Очищает игру
   */
  async clearGame() {
    if (this.statsService && this.game) this.statsService.endSession(this.game);
    this.game = null;
    await this.gameRepository.clearGame();
  }
}

module.exports = GameService;
