const WebSocket = require('ws');

/**
 * Обработчик WebSocket соединений
 */
class WebSocketHandler {
  constructor(server, gameService) {
    this.wss = new WebSocket.Server({ server });
    this.gameService = gameService;
    this.clients = new Set();
    this.statsService = null;
    
    this.setupEventHandlers();
  }

  /**
   * Настраивает обработчики событий
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('Новое WebSocket подключение');
      this.clients.add(ws);
      
      // Клиент должен прислать gameId в первом сообщении, иначе не знаем что отправлять
      
      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });
      
      ws.on('close', () => {
        console.log('WebSocket подключение закрыто');
        this.clients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket ошибка:', error);
        this.clients.delete(ws);
      });
    });
  }

  /**
   * Обрабатывает входящие сообщения
   */
  async handleMessage(ws, message) {
    try {
      const raw = typeof message === 'string' ? message : message.toString('utf8');
      const event = JSON.parse(raw);
      console.log('Получено событие:', event.type);
      // Гарантируем наличие контейнера data и gameId (fallback к последнему для сокета)
      if (!event.data) event.data = {};
      // Если старт игры без gameId — сгенерируем и запомним на сокете
      if (event.type === 'start_game' && !event.data.gameId) {
        event.data.gameId = `game-${Date.now()}`;
      }
      if (!event.data.gameId && ws._gameId) event.data.gameId = ws._gameId;

      const result = await this.gameService.handleEvent(event);
      const gameId = (event && event.data && event.data.gameId) || (result && result.gameId) || null;
      if (gameId && !ws._gameId) ws._gameId = gameId;
      if (gameId) {
        await this.sendGameState(ws, gameId);
        this.broadcastGameState(gameId);
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
      this.sendError(ws, error && error.message ? error.message : 'Ошибка обработки сообщения');
    }
  }

  /**
   * Отправляет состояние игры клиенту
   */
  async sendGameState(ws, gameId) {
    const gameState = await this.gameService.getGameState(gameId);
    if (gameState) {
      this.sendMessage(ws, {
        type: 'game_state',
        data: gameState
      });
    }
  }

  /**
   * Отправляет состояние игры всем клиентам
   */
  async broadcastGameState(gameId) {
    const gameState = await this.gameService.getGameState(gameId);
    if (gameState) {
      this.broadcastMessage({
        type: 'game_state',
        data: gameState
      });
    }
  }

  /**
   * Отправляет событие завершения раунда
   */
  broadcastRoundCompleted(roundNumber, scores) {
    this.broadcastMessage({
      type: 'round_completed',
      data: {
        currentRound: roundNumber,
        scores: scores
      }
    });
  }

  /**
   * Отправляет событие завершения игры
   */
  broadcastGameEnded(gameState) {
    this.broadcastMessage({
      type: 'game_ended',
      data: gameState
    });
  }

  broadcastStatsUpdate(payload) {
    this.broadcastMessage({ type: 'stats:update', data: payload });
  }

  broadcastLeaderboardUpdate() {
    this.broadcastMessage({ type: 'leaderboard:update' });
  }

  /**
   * Отправляет событие экрана передачи хода
   */
  broadcastHandoffScreen(nextPlayer, currentRound) {
    this.broadcastMessage({
      type: 'handoff_screen',
      data: {
        nextPlayer: nextPlayer,
        currentRound: currentRound
      }
    });
  }

  /**
   * Отправляет сообщение клиенту
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Отправляет сообщение всем клиентам
   */
  broadcastMessage(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Отправляет ошибку клиенту
   */
  sendError(ws, errorMessage) {
    this.sendMessage(ws, {
      type: 'error',
      message: errorMessage
    });
  }

  /**
   * Закрывает все соединения
   */
  close() {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    
    this.wss.close();
  }
}

module.exports = WebSocketHandler;
