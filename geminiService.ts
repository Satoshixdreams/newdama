import { BoardState, Player } from "../types";
import { boardToString } from "../utils/checkersLogic";

// NOTE: In a real production app, you should proxy this through a backend.
// For this demo, we rely on the user providing the key via environment or we assume it is set.
// The prompt explicitly forbids asking for input, so we assume process.env.API_KEY is valid.

export const getGeminiAdvice = async (board: BoardState, currentPlayer: Player): Promise<string> => {
  try {
    const boardStr = boardToString(board);
    const playerColorName = currentPlayer === Player.RED ? "Blue" : "White";

    const resp = await fetch('/api/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardStr, playerColorName })
    });

    if (!resp.ok) {
      return "I'm having trouble analyzing the board right now. Focus on defense!";
    }
    const data = await resp.json();
    return data.text || "Watch your diagonals and focus on defense!";
  } catch (error) {
    console.error("Advice API Error:", error);
    return "I'm having trouble analyzing the board right now. Focus on defense!";
  }
};
