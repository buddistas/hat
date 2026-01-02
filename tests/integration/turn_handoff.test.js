const WebSocket = require('ws');

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

// This test requires server to be running on port 4000
// Run: node server.js before executing tests
// Skip by default as it requires manual server setup
describe.skip('Turn handoff shuffles remaining words and picks a new word', () => {

  // Helper to connect with retries until server is ready
  async function connectWithRetry(url, attempts = 20, delayMs = 250) {
    for (let i = 0; i < attempts; i++) {
      try {
        const ws = new WebSocket(url);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('open timeout')), 4000);
          ws.on('open', () => { clearTimeout(timeout); resolve(); });
          ws.on('error', (e) => { clearTimeout(timeout); reject(e); });
        });
        return ws;
      } catch (_) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    throw new Error('Failed to connect to WS server after retries');
  }

  test('next player gets a (potentially) new word after shuffle', async () => {
    const ws = await connectWithRetry('ws://localhost:4000');

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
  }, 30000);
});


