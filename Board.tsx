import React from 'react';
import { BoardState, Move, Piece, Player, Position } from '../types';
import { BOARD_SIZE } from '../constants';
import PieceComponent from './Piece';

interface BoardProps {
  board: BoardState;
  selectedPos: Position | null;
  validMoves: Move[];
  onSquareClick: (pos: Position) => void;
  isRotated: boolean;
}

const Board: React.FC<BoardProps> = ({ board, selectedPos, validMoves, onSquareClick, isRotated }) => {
  
  const renderSquare = (row: number, col: number) => {
    const piece = board[row][col];
    
    const isSelected = selectedPos?.row === row && selectedPos?.col === col;
    const isValidMoveTarget = validMoves.some(m => m.to.row === row && m.to.col === col);
    
    // Find if this square is part of a valid move (to highlight it)
    const validMove = validMoves.find(m => m.to.row === row && m.to.col === col);
    const isCaptureMove = validMove?.isCapture;

    // Turkish Dama usually has a uniform board color or simple grid
    // We use alternating subtle shades for visual guidance but all squares are playable
    const isDark = (row + col) % 2 === 1;
    let bgClass = isDark ? 'bg-slate-600' : 'bg-slate-500';
    
    // Visual hints
    if (isValidMoveTarget) {
      bgClass = isCaptureMove ? 'bg-blue-900/80 ring-inset ring-4 ring-blue-500' : 'bg-emerald-900/80 ring-inset ring-4 ring-emerald-500';
    }

    return (
      <div
        key={`${row}-${col}`}
        onClick={() => onSquareClick({ row, col })}
        className={`
          relative w-full h-full aspect-square flex items-center justify-center
          ${bgClass}
          border border-slate-700/50
          transition-colors duration-200
        `}
      >
        {/* Inner container handles counter-rotation so pieces/labels stay upright */}
        <div className={`w-full h-full flex items-center justify-center relative transition-transform duration-500 ${isRotated ? 'rotate-180' : ''}`}>
          {/* Rank/File labels for corners */}
          {col === 0 && <span className="absolute left-0.5 bottom-0 text-[9px] text-white/20 font-mono">{row}</span>}
          {row === BOARD_SIZE - 1 && <span className="absolute right-0.5 bottom-0 text-[9px] text-white/20 font-mono">{col}</span>}

          {isValidMoveTarget && (
            <div className={`absolute w-3 h-3 rounded-full ${isCaptureMove ? 'bg-blue-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
          )}
          
          {piece && (
            <PieceComponent
              player={piece.player}
              isKing={piece.isKing}
              isSelected={isSelected}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`
        grid gap-1 p-2 bg-slate-800 rounded-lg shadow-2xl border border-slate-700
        w-full max-w-[600px] aspect-square
        transition-transform duration-500 ease-in-out
      `}
      style={{
        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        transform: isRotated ? 'rotate(180deg)' : 'none'
      }}
    >
      {board.map((row, rIndex) =>
        row.map((_, cIndex) => renderSquare(rIndex, cIndex))
      )}
    </div>
  );
};

export default Board;