
import { BoardState, Move, Piece, Player, Position } from '../types';
import { BOARD_SIZE } from '../constants';

export const createInitialBoard = (): BoardState => {
  const board: BoardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      // Checkers: Fill entire rows 1, 2 for White and 5, 6 for Blue (Red in Logic)
      if (row === 1 || row === 2) {
        board[row][col] = { player: Player.WHITE, isKing: false };
      } else if (row === 5 || row === 6) {
        board[row][col] = { player: Player.RED, isKing: false };
      }
    }
  }
  return board;
};

export const isValidPos = (pos: Position): boolean => {
  return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE;
};

// Helper to calculate the maximum capture chain length from a given move
const getCaptureChainLength = (board: BoardState, startMove: Move): number => {
  // Simulate the move
  const { newBoard } = applyMove(board, startMove);

  // The piece is now at startMove.to
  const piece = newBoard[startMove.to.row][startMove.to.col];
  if (!piece) return 0;

  // Find valid captures from this new position
  // We use getPieceMoves directly to avoid infinite recursion of getValidMoves calling this
  const nextMoves = getPieceMoves(newBoard, startMove.to, piece);
  const captureMoves = nextMoves.filter(m => m.isCapture);

  if (captureMoves.length === 0) {
    return 0;
  }

  // Recursively find the max length
  let maxSubLength = 0;
  for (const nextMove of captureMoves) {
    const len = 1 + getCaptureChainLength(newBoard, nextMove);
    if (len > maxSubLength) {
      maxSubLength = len;
    }
  }

  return maxSubLength;
};

export const getValidMoves = (board: BoardState, player: Player, fromPos?: Position | null): Move[] => {
  let moves: Move[] = [];

  if (fromPos) {
    // If we are forced to move a specific piece (e.g., mid-multijump)
    const piece = board[fromPos.row][fromPos.col];
    if (piece && piece.player === player) {
      moves = getPieceMoves(board, fromPos, piece);
    }
  } else {
    // Get all moves for all pieces
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (piece && piece.player === player) {
          const pieceMoves = getPieceMoves(board, { row: r, col: c }, piece);
          moves.push(...pieceMoves);
        }
      }
    }
  }

  // Checkers Rule: Forced Captures & Max Capture
  const captureMoves = moves.filter(m => m.isCapture);

  if (captureMoves.length > 0) {
    // Calculate the full chain length for each capture move
    const movesWithLengths = captureMoves.map(move => {
      // Base length is 1 (the current move) + any subsequent captures
      const length = 1 + getCaptureChainLength(board, move);
      return { move, length };
    });

    // Find the maximum length
    const maxLength = Math.max(...movesWithLengths.map(m => m.length));

    // Return only moves that lead to the maximum capture chain
    return movesWithLengths.filter(m => m.length === maxLength).map(m => m.move);
  }

  return moves;
};

export const getPieceMoves = (board: BoardState, pos: Position, piece: Piece): Move[] => {
  const moves: Move[] = [];

  // Orthogonal Directions: Up, Down, Left, Right
  const dirs = {
    UP: { r: -1, c: 0 },
    DOWN: { r: 1, c: 0 },
    LEFT: { r: 0, c: -1 },
    RIGHT: { r: 0, c: 1 }
  };

  const allowedDirections = [];

  if (piece.isKing) {
    allowedDirections.push(dirs.UP, dirs.DOWN, dirs.LEFT, dirs.RIGHT);
  } else {
    // Men move Forward and Sideways
    if (piece.player === Player.WHITE) {
      allowedDirections.push(dirs.DOWN, dirs.LEFT, dirs.RIGHT);
    } else {
      allowedDirections.push(dirs.UP, dirs.LEFT, dirs.RIGHT);
    }
  }

  if (piece.isKing) {
    // --- FLYING KING LOGIC ---
    allowedDirections.forEach(d => {
      // 1. Sliding Move
      let i = 1;
      while (true) {
        const target = { row: pos.row + d.r * i, col: pos.col + d.c * i };
        if (!isValidPos(target)) break;

        const cell = board[target.row][target.col];
        if (cell === null) {
          moves.push({ from: pos, to: target, isCapture: false });
        } else {
          break; // Blocked
        }
        i++;
      }

      // 2. Capture Move
      let dist = 1;
      while (true) {
        const checkPos = { row: pos.row + d.r * dist, col: pos.col + d.c * dist };
        if (!isValidPos(checkPos)) break;

        const cell = board[checkPos.row][checkPos.col];

        if (cell !== null) {
          if (cell.player !== piece.player) {
            // Found enemy, check landing spots behind it
            let jumpDist = 1;
            while (true) {
              const landPos = { row: checkPos.row + d.r * jumpDist, col: checkPos.col + d.c * jumpDist };
              if (!isValidPos(landPos)) break;

              const landCell = board[landPos.row][landPos.col];
              if (landCell === null) {
                moves.push({
                  from: pos,
                  to: landPos,
                  isCapture: true,
                  capturedPos: checkPos
                });
              } else {
                break; // Blocked after enemy
              }
              jumpDist++;
            }
          }
          break; // Cannot jump over two pieces or own piece
        }
        dist++;
      }
    });

  } else {
    // --- MAN LOGIC ---
    allowedDirections.forEach(d => {
      // 1. Simple Move لا
      const targetPos = { row: pos.row + d.r, col: pos.col + d.c };
      if (isValidPos(targetPos) && board[targetPos.row][targetPos.col] === null) {
        moves.push({ from: pos, to: targetPos, isCapture: false });
      }

      // 2. Capture Move
      const enemyPos = { row: pos.row + d.r, col: pos.col + d.c };
      const jumpPos = { row: pos.row + (d.r * 2), col: pos.col + (d.c * 2) };

      if (isValidPos(jumpPos) && isValidPos(enemyPos)) {
        const enemyPiece = board[enemyPos.row][enemyPos.col];
        const landingSquare = board[jumpPos.row][jumpPos.col];

        if (enemyPiece && enemyPiece.player !== piece.player && landingSquare === null) {
          moves.push({
            from: pos,
            to: jumpPos,
            isCapture: true,
            capturedPos: enemyPos
          });
        }
      }
    });
  }

  return moves;
};

export const applyMove = (currentBoard: BoardState, move: Move): { newBoard: BoardState, promoted: boolean } => {
  // Deep copy
  const newBoard = currentBoard.map(row => row.map(p => p ? { ...p } : null));

  const piece = newBoard[move.from.row][move.from.col];
  if (!piece) throw new Error("No piece at source");

  // Move piece
  newBoard[move.to.row][move.to.col] = piece;
  newBoard[move.from.row][move.from.col] = null;

  // Remove Captured
  if (move.isCapture && move.capturedPos) {
    newBoard[move.capturedPos.row][move.capturedPos.col] = null;
  }

  // Promotion (Standard)
  let promoted = false;
  if (!piece.isKing) {
    // In Checkers, promotion stops movement immediately usually, but checking end rows:
    if ((piece.player === Player.WHITE && move.to.row === BOARD_SIZE - 1) ||
      (piece.player === Player.RED && move.to.row === 0)) {
      piece.isKing = true;
      promoted = true;
    }
  }

  // --- Custom Rule: Last Man Standing ---
  // If a player has only 1 piece left, it becomes a King automatically.
  let redPieces: Piece[] = [];
  let whitePieces: Piece[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = newBoard[r][c];
      if (p) {
        if (p.player === Player.RED) redPieces.push(p);
        else whitePieces.push(p);
      }
    }
  }

  if (redPieces.length === 1 && !redPieces[0].isKing) {
    redPieces[0].isKing = true;
  }

  if (whitePieces.length === 1 && !whitePieces[0].isKing) {
    whitePieces[0].isKing = true;
  }

  return { newBoard, promoted };
};

export const checkWinner = (board: BoardState, currentPlayer?: Player): Player | null => {
  let redCount = 0;
  let whiteCount = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p?.player === Player.RED) redCount++;
      if (p?.player === Player.WHITE) whiteCount++;
    }
  }

  if (redCount === 0) return Player.WHITE;
  if (whiteCount === 0) return Player.RED;

  // Stalemate check: If current player has no moves, they lose.
  if (currentPlayer) {
    const moves = getValidMoves(board, currentPlayer);
    if (moves.length === 0) {
      return currentPlayer === Player.RED ? Player.WHITE : Player.RED;
    }
  }

  return null;
};

export const boardToString = (board: BoardState): string => {
  let str = "";
  for (let r = 0; r < BOARD_SIZE; r++) {
    let rowStr = `Row ${r}: `;
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (!p) rowStr += "[ ]";
      // Use 'B' for Blue (formerly Red)
      else rowStr += p.player === Player.RED ? `[B${p.isKing ? 'K' : ''}]` : `[W${p.isKing ? 'K' : ''}]`;
    }
    str += rowStr + "\n";
  }
  return str;
}
