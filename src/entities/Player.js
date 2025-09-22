/**
 * Сущность игрока
 */
class Player {
  constructor(id, name, teamId) {
    this.id = id;
    this.name = name;
    this.teamId = teamId;
  }

  /**
   * Создает копию игрока
   */
  clone() {
    return new Player(this.id, this.name, this.teamId);
  }

  /**
   * Проверяет равенство игроков
   */
  equals(other) {
    return other ? this.id === other.id : false;
  }
}

module.exports = Player;
