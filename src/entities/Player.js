/**
 * Сущность игрока
 */
class Player {
  constructor(id, name, teamId, playerKey = null) {
    this.id = id;
    this.name = name;
    this.teamId = teamId;
    this.playerKey = playerKey;
  }

  /**
   * Создает копию игрока
   */
  clone() {
    return new Player(this.id, this.name, this.teamId, this.playerKey);
  }

  /**
   * Проверяет равенство игроков
   */
  equals(other) {
    return other ? this.id === other.id : false;
  }
}

module.exports = Player;
