const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

class TelegramBotService {
    constructor(token, gameService, statsService) {
        this.token = token;
        this.gameService = gameService;
        this.statsService = statsService;
        this.gameUrl = process.env.GAME_URL || 'http://localhost:4000';
        this.logsDir = path.join(__dirname, '../../logs');
        
        // Создаем директорию для логов если её нет
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        
        try {
            this.bot = new TelegramBot(token, { 
                polling: {
                    interval: 1000,
                    autoStart: false
                }
            });
            
            this.setupHandlers();
            this.startPolling();
            this.log('Telegram bot initialized');
        } catch (error) {
            this.log(`Error initializing Telegram bot: ${error.message}`, 'error');
            throw error;
        }
    }

    setupHandlers() {
        // Обработчик команды /start
        this.bot.onText(/\/start/, (msg) => {
            this.handleStart(msg);
        });

        // Обработчик callback_query (нажатия на кнопки)
        this.bot.on('callback_query', (callbackQuery) => {
            this.handleCallbackQuery(callbackQuery);
        });

        // Обработчик текстовых сообщений (для кода подтверждения)
        this.bot.on('message', (msg) => {
            if (msg.text && msg.text.startsWith('/')) {
                return; // Команды обрабатываются отдельно
            }
            this.handleTextMessage(msg);
        });

        // Обработчик ошибок
        this.bot.on('error', (error) => {
            this.log(`Bot error: ${error.message}`, 'error');
        });
    }

    startPolling() {
        try {
            this.bot.startPolling();
            this.log('Bot polling started');
        } catch (error) {
            this.log(`Error starting polling: ${error.message}`, 'error');
        }
    }

    stopPolling() {
        try {
            this.bot.stopPolling();
            this.log('Bot polling stopped');
        } catch (error) {
            this.log(`Error stopping polling: ${error.message}`, 'error');
        }
    }

    handleStart(msg) {
        const chatId = msg.chat.id;
        const username = msg.from.username;
        
        this.log(`User ${username} started bot`);
        this.sendMainMenu(chatId);
    }

    handleCallbackQuery(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const username = callbackQuery.from.username;

        this.log(`User ${username} pressed button: ${data}`);

        switch (data) {
            case 'start_game':
                this.handleStartGame(chatId, messageId, username);
                break;
            case 'join_game':
                this.handleJoinGame(chatId, messageId, username);
                break;
            case 'leave_game':
                this.handleLeaveGame(chatId, messageId, username);
                break;
            case 'end_game':
                this.handleEndGame(chatId, messageId, username);
                break;
            default:
                this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'Неизвестная команда',
                    show_alert: true
                });
        }
    }

    handleTextMessage(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        const username = msg.from.username;

        // Проверяем, ожидаем ли мы код подтверждения
        if (text === '1104') {
            this.handleEndGameConfirmation(chatId, username);
        } else {
            this.bot.sendMessage(chatId, 'Неизвестная команда. Используйте кнопки для управления игрой.');
        }
    }

    async handleStartGame(chatId, messageId, username) {
        try {
            const gameStatus = await this.gameService.getGameStatus();
            
            if (gameStatus.isActive) {
                this.bot.answerCallbackQuery({ message_id: messageId }, {
                    text: 'Игра уже запущена. Завершите текущую игру перед запуском новой.',
                    show_alert: true
                });
                return;
            }

            // Создаем новую игру
            const gameId = await this.gameService.startNewGame();
            
            // Создаем ссылку для автоматического добавления
            const gameUrl = `${this.gameUrl}?autoJoin=true&username=${username}&gameId=${gameId}`;
            
            // Отправляем сообщение с гиперссылкой
            const keyboard = {
                inline_keyboard: [[
                    { text: '🎮 Открыть игру в браузере', url: gameUrl }
                ]]
            };

            await this.bot.editMessageText(
                '🎯 Игра запущена!\n\nНажмите кнопку ниже, чтобы открыть игру в браузере и автоматически присоединиться:',
                {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: keyboard
                }
            );

            // Обновляем главное меню
            setTimeout(() => {
                this.sendMainMenu(chatId);
            }, 2000);

            this.log(`Game started by ${username}, gameId: ${gameId}`);
            
        } catch (error) {
            this.log(`Error starting game: ${error.message}`, 'error');
            this.bot.answerCallbackQuery({ message_id: messageId }, {
                text: 'Ошибка при запуске игры',
                show_alert: true
            });
        }
    }

    async handleJoinGame(chatId, messageId, username) {
        try {
            const gameStatus = await this.gameService.getGameStatus();
            
            if (!gameStatus.isActive) {
                this.bot.answerCallbackQuery({ message_id: messageId }, {
                    text: 'Нет активной игры. Сначала запустите игру.',
                    show_alert: true
                });
                return;
            }

            if (gameStatus.playersCount >= gameStatus.maxPlayers) {
                this.bot.answerCallbackQuery({ message_id: messageId }, {
                    text: 'Игра уже набрала максимальное количество участников.',
                    show_alert: true
                });
                return;
            }

            // Добавляем игрока в игру
            const success = await this.gameService.addPlayer(username, username);
            
            if (success) {
                this.bot.answerCallbackQuery({ message_id: messageId }, {
                    text: '✅ Вы успешно присоединились к игре!',
                    show_alert: true
                });
                this.log(`Player ${username} joined the game`);
            } else {
                this.bot.answerCallbackQuery({ message_id: messageId }, {
                    text: 'Ошибка при присоединении к игре',
                    show_alert: true
                });
            }
            
        } catch (error) {
            this.log(`Error joining game: ${error.message}`, 'error');
            this.bot.answerCallbackQuery({ message_id: messageId }, {
                text: 'Ошибка при присоединении к игре',
                show_alert: true
            });
        }
    }

    async handleLeaveGame(chatId, messageId, username) {
        try {
            const gameStatus = await this.gameService.getGameStatus();
            
            if (!gameStatus.isActive) {
                this.bot.answerCallbackQuery({ message_id: messageId }, {
                    text: 'Нет активной игры.',
                    show_alert: true
                });
                return;
            }

            // Удаляем игрока из игры
            const success = await this.gameService.removePlayer(username);
            
            if (success) {
                this.bot.answerCallbackQuery({ message_id: messageId }, {
                    text: '✅ Вы отключились от игры.',
                    show_alert: true
                });
                this.log(`Player ${username} left the game`);
            } else {
                this.bot.answerCallbackQuery({ message_id: messageId }, {
                    text: 'Вы не участвуете в текущей игре.',
                    show_alert: true
                });
            }
            
        } catch (error) {
            this.log(`Error leaving game: ${error.message}`, 'error');
            this.bot.answerCallbackQuery({ message_id: messageId }, {
                text: 'Ошибка при отключении от игры',
                show_alert: true
            });
        }
    }

    async handleEndGame(chatId, messageId, username) {
        try {
            const gameStatus = await this.gameService.getGameStatus();
            
            if (!gameStatus.isActive) {
                this.bot.answerCallbackQuery({ message_id: messageId }, {
                    text: 'Нет активной игры.',
                    show_alert: true
                });
                return;
            }

            // Запрашиваем код подтверждения
            await this.bot.editMessageText(
                '🛑 Принудительное завершение игры\n\nДля подтверждения введите код: 1104',
                {
                    chat_id: chatId,
                    message_id: messageId
                }
            );

            this.log(`User ${username} requested game end confirmation`);
            
        } catch (error) {
            this.log(`Error requesting game end: ${error.message}`, 'error');
            this.bot.answerCallbackQuery({ message_id: messageId }, {
                text: 'Ошибка при запросе завершения игры',
                show_alert: true
            });
        }
    }

    async handleEndGameConfirmation(chatId, username) {
        try {
            const success = await this.gameService.endGame();
            
            if (success) {
                await this.bot.sendMessage(chatId, '🏁 Игра завершена. Спасибо за участие!');
                this.log(`Game ended by ${username}`);
            } else {
                await this.bot.sendMessage(chatId, 'Ошибка при завершении игры.');
            }
            
        } catch (error) {
            this.log(`Error ending game: ${error.message}`, 'error');
            await this.bot.sendMessage(chatId, 'Ошибка при завершении игры.');
        }
    }

    sendMainMenu(chatId) {
        const gameStatus = this.getGameStatusSync();
        
        const keyboard = {
            inline_keyboard: [
                [
                    { 
                        text: gameStatus.isActive ? '🎯 Старт (неактивно)' : '🎯 Старт', 
                        callback_data: 'start_game',
                        disabled: gameStatus.isActive
                    },
                    { 
                        text: '👥 Присоединиться', 
                        callback_data: 'join_game',
                        disabled: !gameStatus.isActive || gameStatus.playersCount >= gameStatus.maxPlayers
                    }
                ],
                [
                    { 
                        text: '❌ Отключиться', 
                        callback_data: 'leave_game',
                        disabled: !gameStatus.isActive
                    },
                    { 
                        text: '🛑 Завершить игру', 
                        callback_data: 'end_game',
                        disabled: !gameStatus.isActive
                    }
                ]
            ]
        };

        const statusText = gameStatus.isActive 
            ? `🎮 Игра активна\n👥 Участников: ${gameStatus.playersCount}/${gameStatus.maxPlayers}`
            : '🎮 Нет активной игры';

        this.bot.sendMessage(chatId, `🎮 Управление игрой\n\n${statusText}`, {
            reply_markup: keyboard
        });
    }

    getGameStatusSync() {
        // Синхронная версия для получения статуса игры
        // В реальной реализации это должно быть асинхронным
        try {
            const gameState = this.gameService.getGameState();
            return {
                isActive: gameState && gameState.players && gameState.players.length > 0,
                playersCount: gameState ? gameState.players.length : 0,
                maxPlayers: gameState ? gameState.maxPlayers || 20 : 20
            };
        } catch (error) {
            return {
                isActive: false,
                playersCount: 0,
                maxPlayers: 20
            };
        }
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message
        };
        
        const logFile = path.join(this.logsDir, 'telegram-bot.log');
        fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
        
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }

    // Метод для отправки уведомлений о событиях игры
    async notifyGameEvent(event, data) {
        // В будущем можно добавить список подписчиков на уведомления
        this.log(`Game event: ${event}`, 'info');
    }
}

module.exports = TelegramBotService;
