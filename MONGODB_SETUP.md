# Настройка MongoDB для Hat Web

## Установка MongoDB

### Windows

1. Скачайте MongoDB Community Server с [официального сайта](https://www.mongodb.com/try/download/community)
2. Запустите установщик и следуйте инструкциям
3. По умолчанию MongoDB будет установлен в `C:\Program Files\MongoDB\Server\7.0\`
4. Добавьте путь к MongoDB в переменную PATH: `C:\Program Files\MongoDB\Server\7.0\bin`

### Альтернативно через Chocolatey

```bash
choco install mongodb
```

### Альтернативно через Scoop

```bash
scoop install mongodb
```

## Запуск MongoDB

### Как служба Windows (рекомендуется)

```bash
# Установка как службы
mongod --install --serviceName MongoDB --serviceDisplayName "MongoDB" --logpath "C:\data\log\mongod.log" --dbpath "C:\data\db"

# Запуск службы
net start MongoDB
```

### Вручную

```bash
# Создайте директории для данных
mkdir C:\data\db
mkdir C:\data\log

# Запустите MongoDB
mongod --dbpath C:\data\db --logpath C:\data\log\mongod.log
```

## Настройка проекта

### 1. Создайте файл .env

Скопируйте `.env.example` в `.env` и настройте параметры:

```bash
# MongoDB Configuration (пример для Docker с аутентификацией)
MONGODB_URI=mongodb://admin:MyStrongPass2025!@localhost:27017/?authSource=admin
MONGODB_DATABASE=hat_game

# Storage Configuration
USE_MONGODB=true
STATS_STORAGE_TYPE=mongodb
WORDS_STORAGE_TYPE=mongodb

# Fallback to filesystem if MongoDB is not available
FALLBACK_TO_FILESYSTEM=true
```

### 2. Миграция данных

Запустите миграцию существующих данных из файловой системы в MongoDB:

```bash
npm run migrate:mongodb
```

### 3. Запуск сервера

```bash
npm start
```

## Конфигурация

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `MONGODB_URI` | URI подключения к MongoDB | `mongodb://localhost:27017/hat_game` |
| `MONGODB_DATABASE` | Имя базы данных | `hat_game` |
| `USE_MONGODB` | Включить использование MongoDB | `true` |
| `STATS_STORAGE_TYPE` | Тип хранения статистики (`mongodb` или `filesystem`) | `mongodb` |
| `WORDS_STORAGE_TYPE` | Тип хранения слов (`mongodb` или `filesystem`) | `mongodb` |
| `FALLBACK_TO_FILESYSTEM` | Fallback на файловую систему при ошибках MongoDB | `true` |

### Переключение между MongoDB и файловой системой

Для использования файловой системы вместо MongoDB:

```bash
# В .env файле
USE_MONGODB=false
STATS_STORAGE_TYPE=filesystem
WORDS_STORAGE_TYPE=filesystem
```

## Структура базы данных

### Коллекции

- **players** - информация об игроках
- **player_stats** - статистика игроков
- **games** - завершенные игры
- **game_events** - события игровых сессий
- **words** - словарь игры
- **leaderboards** - кэш лидербордов

### Индексы

Автоматически создаются следующие индексы:

- `players.playerKey` (уникальный)
- `players.telegramUserId` (уникальный, разреженный)
- `player_stats.playerKey` (уникальный)
- `words.word` (уникальный)
- `games.gameId` (уникальный)
- `leaderboards.metric` (уникальный)

## Мониторинг

### Проверка статуса MongoDB

```bash
# Подключение к MongoDB
mongo

# В MongoDB shell
use hat_game
db.stats()
```

### Просмотр данных

```bash
# Количество документов в коллекциях
db.words.countDocuments()
db.player_stats.countDocuments()
db.games.countDocuments()
```

## Устранение неполадок

### MongoDB не запускается

1. Проверьте, что порт 27017 свободен
2. Убедитесь, что директории `C:\data\db` и `C:\data\log` существуют
3. Проверьте права доступа к директориям

### Ошибки подключения

1. Убедитесь, что MongoDB запущен
2. Проверьте URI подключения в `.env`
3. Проверьте настройки файрвола

### Контейнер упал с ошибкой featureCompatibilityVersion

Если в логе контейнера `docker logs mongo` видите `Wrong mongod version ... Invalid featureCompatibilityVersion ... value '8.0'`:

- Данные в томе созданы в MongoDB 8.0, а контейнер запущен с 7.0. Варианты решения:
  - Перейти на образ `mongo:8.0` (рекомендуется):
    ```powershell
    docker rm -f mongo
    docker run -d --name mongo -p 27017:27017 `
      -e MONGO_INITDB_ROOT_USERNAME=admin `
      -e MONGO_INITDB_ROOT_PASSWORD='MyStrongPass2025!' `
      -e MONGO_INITDB_DATABASE=hat_game `
      -v mongo_data:/data/db `
      mongo:8.0
    ```
  - Либо очистить volume (данные будут удалены) и оставить 7.0:
    ```powershell
    docker rm -f mongo
    docker volume rm mongo_data
    docker volume create mongo_data
    docker run -d --name mongo -p 27017:27017 `
      -e MONGO_INITDB_ROOT_USERNAME=admin `
      -e MONGO_INITDB_ROOT_PASSWORD='MyStrongPass2025!' `
      -e MONGO_INITDB_DATABASE=hat_game `
      -v mongo_data:/data/db `
      mongo:7.0
    ```

### Fallback на файловую систему

Если MongoDB недоступен и включен fallback, приложение автоматически переключится на файловую систему. В логах будет сообщение:

```
❌ Ошибка подключения к MongoDB: [ошибка]
🔄 Переключение на файловую систему (fallback)
```

## Резервное копирование

### Создание бэкапа

```bash
mongodump --db hat_game --out backup/
```

### Восстановление из бэкапа

```bash
mongorestore --db hat_game backup/hat_game/
```

## Производительность

### Рекомендации

1. Используйте SSD для хранения данных MongoDB
2. Настройте размер кэша MongoDB в зависимости от доступной RAM
3. Регулярно создавайте бэкапы
4. Мониторьте использование дискового пространства

### Настройка кэша

В файле конфигурации MongoDB (`mongod.cfg`):

```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1  # 1GB кэша (настройте под вашу систему)
```

