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
    await this.gameRepository.saveGame(this.game);
    return true;
  }

  /**
   * Обрабатывает получение следующего слова
   */
  handleNextWord() {
    if (!this.game) return false;
    
    this.nextWordUseCase.execute(this.game);
    return true;
  }

  /**
   * Обрабатывает угаданное слово
   */
  async handleWordGuessed(data) {
    if (!this.game) return false;
    
    const roundFinished = this.wordGuessedUseCase.execute(this.game, data);
    await this.gameRepository.saveGame(this.game);
    
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
    await this.gameRepository.saveGame(this.game);
    return true;
  }

  /**
   * Обрабатывает приостановку игры
   */
  async handlePauseGame() {
    if (!this.game) return false;
    
    this.game.pause();
    await this.gameRepository.saveGame(this.game);
    return true;
  }

  /**
   * Обрабатывает возобновление игры
   */
  async handleResumeGame() {
    if (!this.game) return false;
    
    this.game.resume();
    await this.gameRepository.saveGame(this.game);
    return true;
  }

  /**
   * Обрабатывает завершение раунда
   */
  handleEndRound(data) {
    if (!this.game) return false;
    
    this.endRoundUseCase.execute(this.game, data);
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
    await this.gameRepository.saveGame(this.game);
    
    if (gameFinished) {
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
    this.webSocketHandler.broadcastHandoffScreen(
      this.game.nextPlayer,
      this.game.currentRound
    );
    await this.gameRepository.saveGame(this.game);
    return false; // Не отправляем game_state
  }

  /**
   * Обрабатывает начало следующего хода
   */
  async handleStartNextTurn() {
    if (!this.game) return false;
    
    this.turnManagementUseCase.startNextPlayerTurn(this.game);
    await this.gameRepository.saveGame(this.game);
    return true;
  }

  /**
   * Обрабатывает сохранение перенесенного времени
   */
  async handleRoundCompletedCarriedTime(data) {
    if (!this.game) return false;
    
    this.turnManagementUseCase.saveCarriedTime(this.game, data);
    await this.gameRepository.saveGame(this.game);
    return false; // Не отправляем game_state
  }

  /**
   * Обрабатывает использование перенесенного времени
   */
  async handleCarriedTimeUsed() {
    if (!this.game) return false;
    
    this.turnManagementUseCase.useCarriedTime(this.game);
    await this.gameRepository.saveGame(this.game);
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
   * Очищает игру
   */
  async clearGame() {
    this.game = null;
    await this.gameRepository.clearGame();
  }
}

module.exports = GameService;
