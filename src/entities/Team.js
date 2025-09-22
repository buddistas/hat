/**
 * Сущность команды
 */
class Team {
  constructor(id, name, players = []) {
    this.id = id;
    this.name = name;
    this.players = players; // массив ID игроков
  }

  /**
   * Добавляет игрока в команду
   */
  addPlayer(playerId) {
    if (!this.players.includes(playerId)) {
      this.players.push(playerId);
    }
  }

  /**
   * Удаляет игрока из команды
   */
  removePlayer(playerId) {
    const index = this.players.indexOf(playerId);
    if (index > -1) {
      this.players.splice(index, 1);
    }
  }

  /**
   * Проверяет, есть ли игрок в команде
   */
  hasPlayer(playerId) {
    return this.players.includes(playerId);
  }

  /**
   * Создает копию команды
   */
  clone() {
    return new Team(this.id, this.name, [...this.players]);
  }

  /**
   * Проверяет равенство команд
   */
  equals(other) {
    return other ? this.id === other.id : false;
  }
}

module.exports = Team;
