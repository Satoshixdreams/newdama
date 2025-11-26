import { Player } from './types';

export const BOARD_SIZE = 8;

export const INITIAL_BOARD_SETUP = {
  // Turkish Dama Setup:
  // White: Rows 1, 2
  // Blue (formerly Red): Rows 5, 6
  whiteRows: [1, 2],
  redRows: [5, 6]
};

export const COLORS = {
  [Player.RED]: 'bg-blue-600', // Visuals changed to Blue
  [Player.WHITE]: 'bg-slate-200',
  boardDark: 'bg-slate-700', 
  boardLight: 'bg-slate-700', 
  highlight: 'ring-4 ring-yellow-400',
  validMove: 'bg-green-500/50 ring-4 ring-green-400',
};