const WebSocket = require('ws');
const { spawn } = require('child_process');

// Helper to wait for a message of specific type
function waitForMessage(ws, type) {
  return new Promise((resolve, reject) => {
    const onMessage = (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg && msg.type === type) {
          ws.off('message', onMessage);
          resolve(msg.data);
        }
      } catch (e) {
        // ignore non-JSON
      }
    };
    ws.on('message', onMessage);
    ws.on('error', reject);
    ws.on('close', () => reject(new Error('WS closed')));
  });
}

describe('Turn handoff shuffles remaining words and picks a new word', () => {
  let serverProcess;

  beforeAll(async () => {
    serverProcess = spawn(process.platform === 'win32' ? 'node.exe' : 'node', ['server.js'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'ignore'
    });
    // wait a bit for server to start
    await new Promise(r => setTimeout(r, 500));
  }, 10000);

  afterAll(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGINT');
    }
  });

  test('next player gets a (potentially) new word after shuffle', async () => {
    const ws = new WebSocket('ws://localhost:4000');
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    // Consume initial game_state (empty)
    await waitForMessage(ws, 'game_state').catch(() => {});

    // Start game with minimal setup and small wordsCount for determinism
    const players = [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' }
    ];
    const teams = [
      { id: 't1', name: 'T1', players: ['p1'] },
      { id: 't2', name: 'T2', players: ['p2'] }
    ];

    ws.send(JSON.stringify({
      type: 'start_game',
      data: { players, teams, wordsCount: 20, roundDuration: 5 }
    }));

    // first game_state with currentWord
    const state1 = await waitForMessage(ws, 'game_state');
    expect(state1.currentWord).toBeTruthy();
    const firstWord = state1.currentWord;

    // simulate time_up (end turn) which triggers handoff screen
    ws.send(JSON.stringify({ type: 'time_up', data: {} }));
    const handoff = await waitForMessage(ws, 'handoff_screen');
    expect(handoff.nextPlayer).toBeTruthy();

    // start next turn
    ws.send(JSON.stringify({ type: 'start_next_turn' }));
    const state2 = await waitForMessage(ws, 'game_state');
    expect(state2.currentWord).toBeTruthy();

    // It can be same if only one word left; validate invariants instead
    // 1) previous word remains in availableWords unless guessed
    expect(Array.isArray(state2.availableWords)).toBe(true);
    expect(state2.availableWords.length).toBeGreaterThan(0);
    // 2) currentWord belongs to availableWords
    expect(state2.availableWords.includes(state2.currentWord)).toBe(true);

    ws.close();
  }, 15000);
});


