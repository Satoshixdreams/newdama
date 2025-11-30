
import { BoardState, Move, Player, Position } from '../types';
import { getValidMoves, applyMove, checkWinner } from './checkersLogic';

// Heuristic Evaluation
const evaluateBoard = (board: BoardState, aiPlayer: Player): number => {
    let score = 0;
    const enemy = aiPlayer === Player.WHITE ? Player.RED : Player.WHITE;

    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            const piece = board[r][c];
            if (!piece) continue;

            const isMe = piece.player === aiPlayer;

            // Material: Kings are devastating in Dama
            let value = piece.isKing ? 25 : 5;

            // Central Control: Columns 2, 3, 4, 5 are more valuable
            if (c >= 2 && c <= 5) value += 0.5;

            // Advancement (for Men)
            if (!piece.isKing) {
                const advancement = isMe
                    ? (aiPlayer === Player.WHITE ? r : (7 - r))
                    : (enemy === Player.WHITE ? r : (7 - r));
                // Reward advancing, but safe advancing
                if (isMe) value += advancement * 0.2;
                else value += advancement * 0.2;
            }

            score += isMe ? value : -value;
        }
    }
    return score;
};

export const getBestMove = (
    board: BoardState,
    player: Player,
    depth: number = 4,
    mustMoveFrom: Position | null = null
): Promise<Move | null> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const { move } = minimax(board, depth, true, player, -Infinity, Infinity, mustMoveFrom);
            resolve(move);
        }, 50);
    });
};

const minimax = (
    board: BoardState,
    depth: number,
    isMaximizing: boolean,
    player: Player,
    alpha: number,
    beta: number,
    mustMoveFrom: Position | null
): { score: number, move: Move | null } => {

    const currentPlayer = isMaximizing ? player : (player === Player.WHITE ? Player.RED : Player.WHITE);

    // Check terminal states
    const winner = checkWinner(board, currentPlayer);
    if (winner === player) return { score: 10000, move: null };
    if (winner && winner !== player) return { score: -10000, move: null };

    if (depth === 0) {
        return { score: evaluateBoard(board, player), move: null };
    }

    // If 'mustMoveFrom' is set (multi-jump chain), we strictly only look at those moves
    const moves = getValidMoves(board, currentPlayer, mustMoveFrom);

    // If no moves available, that player loses
    if (moves.length === 0) {
        return { score: isMaximizing ? -5000 : 5000, move: null };
    }

    // Sort moves: checks captures first (Alpha-Beta optimization)
    moves.sort((a, b) => (b.isCapture ? 1 : 0) - (a.isCapture ? 1 : 0));

    let bestMove: Move | null = null;

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const { newBoard } = applyMove(board, move);

            // Check if this move grants another turn (multi-jump)
            let nextIsMaximizing = false; // Normally swap
            let nextMustMoveFrom: Position | null = null;

            if (move.isCapture) {
                // In Dama, you continue if you can capture again
                const extraMoves = getValidMoves(newBoard, currentPlayer, move.to).filter(m => m.isCapture);
                if (extraMoves.length > 0) {
                    nextIsMaximizing = true; // Same player continues
                    nextMustMoveFrom = move.to;
                }
            }

            // If it's the same player moving again, we don't decrement depth as much (or at all)
            // to allow seeing the end of the chain.
            const nextDepth = nextIsMaximizing ? depth : depth - 1;

            const evalResult = minimax(newBoard, nextDepth, nextIsMaximizing, player, alpha, beta, nextMustMoveFrom);

            if (evalResult.score > maxEval) {
                maxEval = evalResult.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, evalResult.score);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove || moves[0] };
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const { newBoard } = applyMove(board, move);

            let nextIsMaximizing = true; // Normally swap back to maximizer
            let nextMustMoveFrom: Position | null = null;

            if (move.isCapture) {
                const extraMoves = getValidMoves(newBoard, currentPlayer, move.to).filter(m => m.isCapture);
                if (extraMoves.length > 0) {
                    nextIsMaximizing = false; // Enemy continues
                    nextMustMoveFrom = move.to;
                }
            }

            const nextDepth = !nextIsMaximizing ? depth : depth - 1;

            const evalResult = minimax(newBoard, nextDepth, nextIsMaximizing, player, alpha, beta, nextMustMoveFrom);

            if (evalResult.score < minEval) {
                minEval = evalResult.score;
                bestMove = move;
            }
            beta = Math.min(beta, evalResult.score);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove || moves[0] };
    }
};
