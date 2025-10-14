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
    
    this.statsService = webSocketHandler ? webSocketHandler.statsService : null;
  }

  /**
   * Обрабатывает игровые события
   */
  async handleEvent(event) {
    const { type, data } = event;
    const gameId = data && data.gameId ? data.gameId : (this.game && this.game.gameId) || (data && data.options && data.options.gameId) || null;
    
    switch (type) {
      case 'start_game':
        return await this.handleStartGame(data);
        
      case 'next_word':
        return await this.handleNextWord(gameId);
        
      case 'word_guessed':
        return await this.handleWordGuessed(gameId, data);
        
      case 'word_passed':
        return await this.handleWordPassed(gameId, data);
        
      case 'pause_game':
        return await this.handlePauseGame(gameId);
        
      case 'resume_game':
        return await this.handleResumeGame(gameId);
        
      case 'end_round':
        return await this.handleEndRound(gameId, data);
        
      case 'continue_round':
        return await this.handleContinueRound(gameId);
        
      case 'time_up':
        return await this.handleTimeUp(gameId, data);
        
      case 'start_next_turn':
        return await this.handleStartNextTurn(gameId);
        
      case 'round_completed_carried_time':
        return await this.handleRoundCompletedCarriedTime(gameId, data);
        
      case 'carried_time_used':
        return await this.handleCarriedTimeUsed(gameId);
        
      case 'clear_game':
        return await this.handleClearGame(gameId);
        
      default:
        console.log('Неизвестное событие:', type);
        return false;
    }
  }

  /**
   * Обрабатывает начало игры
   */
  async handleStartGame(data) {
    const game = await this.startGameUseCase.execute(data);
    await this.gameRepository.saveGame(game);
    // Логируем событие
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'START_GAME', ts: Date.now(), data });
    }
    return { gameId: game.gameId };
  }

  /**
   * Обрабатывает получение следующего слова
   */
  async handleNextWord(gameId) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    this.nextWordUseCase.execute(game);
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'NEXT_WORD', ts: Date.now() });
    }
    return true;
  }

  /**
   * Обрабатывает угаданное слово
   */
  async handleWordGuessed(gameId, data) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    const roundFinished = this.wordGuessedUseCase.execute(game, data);
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'WORD_GUESSED', ts: Date.now(), data });
    }
    if (roundFinished) {
      this.endRoundUseCase.execute(game);
      await this.gameRepository.saveGame(game);
      this.webSocketHandler.broadcastRoundCompleted(
        game.currentRound + 1,
        game.scores
      );
    }
    return !roundFinished;
  }

  /**
   * Обрабатывает пропущенное слово
   */
  async handleWordPassed(gameId, data) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    this.wordPassedUseCase.execute(game, data);
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'WORD_PASSED', ts: Date.now(), data });
    }
    return true;
  }

  /**
   * Обрабатывает приостановку игры
   */
  async handlePauseGame(gameId) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    game.pause();
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'PAUSE', ts: Date.now() });
    }
    return true;
  }

  /**
   * Обрабатывает возобновление игры
   */
  async handleResumeGame(gameId) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    game.resume();
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'RESUME', ts: Date.now() });
    }
    return true;
  }

  /**
   * Обрабатывает завершение раунда
   */
  async handleEndRound(gameId, data) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    this.endRoundUseCase.execute(game, data);
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'END_ROUND', ts: Date.now(), data });
    }
    // Передаём номер завершенного раунда в пользовательском представлении (1..3)
    this.webSocketHandler.broadcastRoundCompleted(
      game.currentRound + 1,
      game.scores
    );
    return false;
  }

  /**
   * Обрабатывает продолжение раунда
   */
  async handleContinueRound(gameId) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    const gameFinished = this.turnManagementUseCase.startNextRound(game);
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'CONTINUE_ROUND', ts: Date.now() });
    }
    if (gameFinished) {
      this.webSocketHandler.broadcastGameEnded(game);
    }
    return true;
  }

  /**
   * Обрабатывает истечение времени
   */
  async handleTimeUp(gameId, data) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    this.turnManagementUseCase.endPlayerTurn(game, data);
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'TIME_UP', ts: Date.now(), data });
    }
    this.webSocketHandler.broadcastHandoffScreen(
      game.nextPlayer,
      game.currentRound
    );
    return false;
  }

  /**
   * Обрабатывает начало следующего хода
   */
  async handleStartNextTurn(gameId) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    this.turnManagementUseCase.startNextPlayerTurn(game);
    // Если слова закончились, завершаем раунд немедленно
    if (game.currentWord == null) {
      this.endRoundUseCase.execute(game);
      await this.gameRepository.saveGame(game);
      if (typeof this.gameRepository.appendEvent === 'function') {
        await this.gameRepository.appendEvent(game.gameId, { type: 'ROUND_COMPLETED_BY_EXHAUSTION', ts: Date.now() });
      }
      this.webSocketHandler.broadcastRoundCompleted(
        game.currentRound + 1,
        game.scores
      );
      return false; // сигнализируем WS не рассылать game_state
    }
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'START_NEXT_TURN', ts: Date.now() });
    }
    return true;
  }

  /**
   * Обрабатывает сохранение перенесенного времени
   */
  async handleRoundCompletedCarriedTime(gameId, data) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    this.turnManagementUseCase.saveCarriedTime(game, data);
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'ROUND_COMPLETED_CARRIED_TIME', ts: Date.now(), data });
    }
    return false;
  }

  /**
   * Обрабатывает использование перенесенного времени
   */
  async handleCarriedTimeUsed(gameId) {
    const game = await this.gameRepository.loadGame(gameId);
    if (!game) return false;
    this.turnManagementUseCase.useCarriedTime(game);
    await this.gameRepository.saveGame(game);
    if (typeof this.gameRepository.appendEvent === 'function') {
      await this.gameRepository.appendEvent(game.gameId, { type: 'CARRIED_TIME_USED', ts: Date.now() });
    }
    return false;
  }

  /**
   * Обрабатывает очистку игры
   */
  async handleClearGame(gameId) {
    await this.clearGame(gameId);
    return false;
  }

  /**
   * Получает текущее состояние игры
   */
  async getGameState(gameId) {
    return await this.gameRepository.loadGame(gameId);
  }

  /**
   * Загружает игру из репозитория
   */
  async loadGame(gameId) {
    return await this.gameRepository.loadGame(gameId);
  }

  /**
   * Очищает игру
   */
  async clearGame(gameId) {
    await this.gameRepository.clearGame(gameId);
  }
}

module.exports = GameService;
