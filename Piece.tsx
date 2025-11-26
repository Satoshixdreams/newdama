import React from 'react';
import { Player } from '../types';
import { Crown } from 'lucide-react';

interface PieceProps {
  player: Player;
  isKing: boolean;
  isSelected: boolean;
}

const PieceComponent: React.FC<PieceProps> = ({ player, isKing, isSelected }) => {
  // Changed Red to Blue visuals
  const colorClass = player === Player.RED 
    ? 'bg-blue-600 shadow-[0_4px_0_rgb(30,64,175)]' 
    : 'bg-slate-100 shadow-[0_4px_0_rgb(148,163,184)]';

  const borderClass = isSelected 
    ? 'ring-4 ring-yellow-400 scale-110 z-10' 
    : '';

  const textColor = player === Player.RED ? 'text-blue-900' : 'text-slate-600';

  return (
    <div 
      className={`
        w-[80%] h-[80%] rounded-full 
        flex items-center justify-center 
        transition-all duration-300 ease-out
        cursor-pointer
        ${colorClass} ${borderClass}
      `}
    >
      {isKing && <Crown className={`w-3/5 h-3/5 ${textColor}`} strokeWidth={3} />}
      
      {/* Inner bevel effect for realism */}
      <div className={`absolute w-[70%] h-[70%] rounded-full border-2 border-white/20 pointer-events-none`}></div>
    </div>
  );
};

export default PieceComponent;