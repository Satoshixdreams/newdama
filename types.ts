

export enum Player {
  RED = 'RED',
  WHITE = 'WHITE'
}

export enum GameMode {
  PVP = 'PVP',
  PVAI = 'PVAI', // Player vs AI
  ONLINE = 'ONLINE' // Online P2P
}

export interface Position {
  row: number;
  col: number;
}

export interface Piece {
  player: Player;
  isKing: boolean;
}

export interface Move {
  from: Position;
  to: Position;
  isCapture: boolean;
  capturedPos?: Position;
}

export type BoardState = (Piece | null)[][];

export interface GameState {
  board: BoardState;
  currentPlayer: Player;
  winner: Player | null;
  history: string[];
}

export interface UserProfile {
  level: number;
  xp: number;
  wins: number;
  losses: number;
  rankTitle: string;
  nextLevelXp: number;
  username?: string;
  pfpUrl?: string;
}