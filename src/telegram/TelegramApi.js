const express = require('express');
const router = express.Router();

class TelegramApiService {
    constructor(gameService, statsService) {
        this.gameService = gameService;
        this.statsService = statsService;
        this.setupRoutes();
    }

    setupRoutes() {
        // Получение статуса игры
        router.get('/api/game/status', async (req, res) => {
            try {
                const gameState = this.gameService.getGameState();
                const status = {
                    isActive: gameState && gameState.players && gameState.players.length > 0,
                    playersCount: gameState ? gameState.players.length : 0,
                    maxPlayers: gameState ? gameState.maxPlayers || 20 : 20,
                    gameId: gameState ? gameState.gameId : null,
                    currentRound: gameState ? gameState.currentRound : null,
                    currentPlayer: gameState ? gameState.currentPlayer : null
                };
                
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Запуск новой игры
        router.post('/api/game/start', async (req, res) => {
            try {
                const { username } = req.body;
                
                if (!username) {
                    return res.status(400).json({ error: 'Username is required' });
                }

                const gameState = this.gameService.getGameState();
                if (gameState && gameState.players && gameState.players.length > 0) {
                    return res.status(400).json({ error: 'Game is already active' });
                }

                const gameId = await this.gameService.startNewGame();
                
                res.json({ 
                    success: true, 
                    gameId,
                    message: 'Game started successfully'
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Присоединение игрока
        router.post('/api/game/join', async (req, res) => {
            try {
                const { username, displayName } = req.body;
                
                if (!username) {
                    return res.status(400).json({ error: 'Username is required' });
                }

                const gameState = this.gameService.getGameState();
                if (!gameState || !gameState.players) {
                    return res.status(400).json({ error: 'No active game' });
                }

                if (gameState.players.length >= (gameState.maxPlayers || 20)) {
                    return res.status(400).json({ error: 'Game is full' });
                }

                // Проверяем, не участвует ли уже игрок
                const existingPlayer = gameState.players.find(p => p.id === username);
                if (existingPlayer) {
                    return res.status(400).json({ error: 'Player already in game' });
                }

                const success = await this.gameService.addPlayer(username, displayName || username);
                
                if (success) {
                    res.json({ 
                        success: true, 
                        message: 'Player joined successfully'
                    });
                } else {
                    res.status(400).json({ error: 'Failed to join game' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Отключение игрока
        router.post('/api/game/leave', async (req, res) => {
            try {
                const { username } = req.body;
                
                if (!username) {
                    return res.status(400).json({ error: 'Username is required' });
                }

                const gameState = this.gameService.getGameState();
                if (!gameState || !gameState.players) {
                    return res.status(400).json({ error: 'No active game' });
                }

                const success = await this.gameService.removePlayer(username);
                
                if (success) {
                    res.json({ 
                        success: true, 
                        message: 'Player left successfully'
                    });
                } else {
                    res.status(400).json({ error: 'Player not in game' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Принудительное завершение игры
        router.post('/api/game/end', async (req, res) => {
            try {
                const { username, confirmationCode } = req.body;
                
                if (!username) {
                    return res.status(400).json({ error: 'Username is required' });
                }

                if (confirmationCode !== '1104') {
                    return res.status(400).json({ error: 'Invalid confirmation code' });
                }

                const gameState = this.gameService.getGameState();
                if (!gameState || !gameState.players) {
                    return res.status(400).json({ error: 'No active game' });
                }

                const success = await this.gameService.endGame();
                
                if (success) {
                    res.json({ 
                        success: true, 
                        message: 'Game ended successfully'
                    });
                } else {
                    res.status(400).json({ error: 'Failed to end game' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Получение списка игроков
        router.get('/api/game/players', async (req, res) => {
            try {
                const gameState = this.gameService.getGameState();
                
                if (!gameState || !gameState.players) {
                    return res.json({ players: [] });
                }

                const players = gameState.players.map(player => ({
                    id: player.id,
                    name: player.name,
                    teamId: player.teamId
                }));

                res.json({ players });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Автоматическое присоединение через URL параметры
        router.get('/api/game/auto-join', async (req, res) => {
            try {
                const { username, gameId } = req.query;
                
                if (!username) {
                    return res.status(400).json({ error: 'Username is required' });
                }

                const gameState = this.gameService.getGameState();
                if (!gameState || !gameState.players) {
                    return res.status(400).json({ error: 'No active game' });
                }

                if (gameId && gameState.gameId !== gameId) {
                    return res.status(400).json({ error: 'Game ID mismatch' });
                }

                // Проверяем, не участвует ли уже игрок
                const existingPlayer = gameState.players.find(p => p.id === username);
                if (existingPlayer) {
                    return res.json({ 
                        success: true, 
                        message: 'Player already in game',
                        alreadyJoined: true
                    });
                }

                if (gameState.players.length >= (gameState.maxPlayers || 20)) {
                    return res.status(400).json({ error: 'Game is full' });
                }

                const success = await this.gameService.addPlayer(username, username);
                
                if (success) {
                    res.json({ 
                        success: true, 
                        message: 'Player joined successfully',
                        gameId: gameState.gameId
                    });
                } else {
                    res.status(400).json({ error: 'Failed to join game' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    getRouter() {
        return router;
    }
}

module.exports = TelegramApiService;
