const WebSocket = require('ws');

/**
 * Обработчик WebSocket соединений
 */
class WebSocketHandler {
  constructor(server, gameService) {
    this.wss = new WebSocket.Server({ server });
    this.gameService = gameService;
    this.clients = new Set();
    
    this.setupEventHandlers();
  }

  /**
   * Настраивает обработчики событий
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('Новое WebSocket подключение');
      this.clients.add(ws);
      
      // Отправка текущего состояния игры новому клиенту
      this.sendGameState(ws);
      
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
      const event = JSON.parse(message);
      console.log('Получено событие:', event.type);
      
      const result = await this.gameService.handleEvent(event);
      
      if (result) {
        this.broadcastGameState();
      }
    } catch (error) {
      console.error('Ошибка парсинга сообщения:', error);
      this.sendError(ws, 'Неверный формат сообщения');
    }
  }

  /**
   * Отправляет состояние игры клиенту
   */
  sendGameState(ws) {
    const gameState = this.gameService.getGameState();
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
  broadcastGameState() {
    const gameState = this.gameService.getGameState();
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
