const StartGameUseCase = require('../../../src/usecases/StartGameUseCase');
const Game = require('../../../src/entities/Game');

describe('StartGameUseCase', () => {
  let useCase;
  let mockWordRepository;

  beforeEach(() => {
    mockWordRepository = {
      selectRandomWords: jest.fn()
    };
    useCase = new StartGameUseCase(mockWordRepository);
  });

  test('should start game with basic data', async () => {
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team1' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1', '2'] }
    ];
    const selectedWords = [
      { word: 'word1' },
      { word: 'word2' },
      { word: 'word3' }
    ];

    mockWordRepository.selectRandomWords.mockResolvedValue(selectedWords);

    const game = await useCase.execute({ players, teams });

    expect(game).toBeInstanceOf(Game);
    expect(game.players).toHaveLength(2);
    expect(game.teams).toHaveLength(1);
    expect(game.currentRound).toBe(0);
    expect(game.selectedWords).toEqual(['word1', 'word2', 'word3']);
    expect(game.currentPlayer).toBeDefined();
    expect(mockWordRepository.selectRandomWords).toHaveBeenCalledWith(100, {
      categories: null,
      levels: null,
      hardPercentage: 0
    });
  });

  test('should start game with custom options', async () => {
    const players = [{ id: '1', name: 'Player 1', teamId: 'team1' }];
    const teams = [{ id: 'team1', name: 'Team 1', players: ['1'] }];
    const options = {
      roundDuration: 60,
      wordsCount: 50,
      categories: ['животные'],
      levels: ['обычный']
    };
    const selectedWords = [{ word: 'word1' }];

    mockWordRepository.selectRandomWords.mockResolvedValue(selectedWords);

    const game = await useCase.execute({ players, teams, options });

    expect(game.roundDuration).toBe(60);
    expect(game.wordFilters.categories).toEqual(['животные']);
    expect(game.wordFilters.levels).toEqual(['обычный']);
    expect(mockWordRepository.selectRandomWords).toHaveBeenCalledWith(50, {
      categories: ['животные'],
      levels: ['обычный'],
      hardPercentage: 0
    });
  });

  test('should initialize turn order correctly', async () => {
    const players = [
      { id: '1', name: 'Player 1', teamId: 'team1' },
      { id: '2', name: 'Player 2', teamId: 'team1' },
      { id: '3', name: 'Player 3', teamId: 'team2' }
    ];
    const teams = [
      { id: 'team1', name: 'Team 1', players: ['1', '2'] },
      { id: 'team2', name: 'Team 2', players: ['3'] }
    ];
    const selectedWords = [{ word: 'word1' }];

    mockWordRepository.selectRandomWords.mockResolvedValue(selectedWords);

    const game = await useCase.execute({ players, teams });

    expect(game.turnOrder.teams).toHaveLength(2);
    expect(game.turnOrder.playersByTeam.team1).toHaveLength(2);
    expect(game.turnOrder.playersByTeam.team2).toHaveLength(1);
    expect(game.currentPlayer).toBeDefined();
  });

  test('should handle empty teams gracefully', async () => {
    const players = [];
    const teams = [];
    const selectedWords = [{ word: 'word1' }];

    mockWordRepository.selectRandomWords.mockResolvedValue(selectedWords);

    const game = await useCase.execute({ players, teams });

    expect(game.players).toHaveLength(0);
    expect(game.teams).toHaveLength(0);
    expect(game.currentPlayer).toBeNull();
  });

  test('should use custom wordsCount from options', async () => {
    const players = [{ id: '1', name: 'Player 1', teamId: 'team1' }];
    const teams = [{ id: 'team1', name: 'Team 1', players: ['1'] }];
    const options = { wordsCount: 25 };
    const selectedWords = Array.from({ length: 25 }, (_, i) => ({ word: `word${i + 1}` }));

    mockWordRepository.selectRandomWords.mockResolvedValue(selectedWords);

    const game = await useCase.execute({ players, teams, options });

    expect(mockWordRepository.selectRandomWords).toHaveBeenCalledWith(25, {
      categories: null,
      levels: null,
      hardPercentage: 0
    });
    expect(game.selectedWords).toHaveLength(25);
  });
});
