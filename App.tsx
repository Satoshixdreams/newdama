
import React, { useState, useEffect, useRef } from 'react';
import { createInitialBoard, getValidMoves, applyMove, checkWinner } from './utils/checkersLogic';
import { BoardState, Move, Player, Position, GameMode, UserProfile } from './types';
import Board from './components/Board';
import { getGeminiAdvice } from './services/geminiService';
import { loadProfile, saveProfile, calculateNewStats, getLeaderboard } from './services/storageService';
import { getBestMove } from './utils/aiLogic';
import { connectWallet, checkIfWalletIsConnected, listenToAccountChanges, ensureBaseNetwork } from './services/web3Service';
import { peerService, PeerMessage } from './services/peerService';
import { initFarcaster, getFarcasterContext, FarcasterUser, openExternalUrl, addMiniAppAndEnableNotifications, sendSelfNotification } from './services/farcasterService';
import { RotateCcw, Trophy, BrainCircuit, Cpu, User, BookOpen, X, Wallet, Repeat, Globe, ArrowRight, Loader2, BarChart3, Share2, Link, CheckCheck, Bell, Smartphone, Plus } from 'lucide-react';

const App: React.FC = () => {
  // Game State
  const [board, setBoard] = useState<BoardState>(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(Player.RED);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.PVAI);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [mustCaptureFrom, setMustCaptureFrom] = useState<Position | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isRotated, setIsRotated] = useState(false);

  // App Initialization State
  const [isInitializing, setIsInitializing] = useState(true);

  // User Profile & Wallet/Identity State
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [farcasterUser, setFarcasterUser] = useState<FarcasterUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(loadProfile(null));
  const [xpGained, setXpGained] = useState<number | null>(null);
  type Snapshot = { board: BoardState; currentPlayer: Player; selectedPos: Position | null; validMoves: Move[]; mustCaptureFrom: Position | null; winner: Player | null };
  const [history, setHistory] = useState<Snapshot[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [turnWarning, setTurnWarning] = useState<string>("");
  const turnTimerRef = useRef<number | null>(null);

  // AI Advice State
  const [advice, setAdvice] = useState<string>("");
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [boardTheme, setBoardTheme] = useState<'classic' | 'neon' | 'checkers'>('checkers');

  // Online State
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [remotePeerIdInput, setRemotePeerIdInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [myOnlineColor, setMyOnlineColor] = useState<Player | null>(null);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [shareBtnLabel, setShareBtnLabel] = useState("Share Invite");
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [showFcConfirm, setShowFcConfirm] = useState(false);
  const [showAddMiniApp, setShowAddMiniApp] = useState(false);
  const [addToFarcaster, setAddToFarcaster] = useState(true);
  const [enableNotifications, setEnableNotifications] = useState(true);

  // Constants
  const HUMAN_PLAYER = Player.RED;
  const AI_PLAYER = Player.WHITE;

  // Initialize Farcaster SDK and Wallet
  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Try Farcaster
        await initFarcaster();
        const fcUser = await getFarcasterContext();

        if (fcUser) {
          console.log("Farcaster user detected:", fcUser);
          const fcId = `fc-${fcUser.fid}`;
          setFarcasterUser(fcUser);
          setIdentityId(fcId);

          let profile = loadProfile(fcId);
          if (fcUser.username || fcUser.pfpUrl) {
            profile = { ...profile, username: fcUser.username, pfpUrl: fcUser.pfpUrl };
            saveProfile(profile, fcId);
          }
          setUserProfile(profile);
          setIsInitializing(false);
          // Check for deep link game join
          const params = new URLSearchParams(window.location.search);
          const joinCode = params.get('join');
          if (joinCode) {
            setRemotePeerIdInput(joinCode);
            setTimeout(() => joinGame(joinCode), 1000);
          }
          return;
        }

        // 2. Try Wallet (fallback)
        const address = await checkIfWalletIsConnected();
        if (address) {
          setIdentityId(address);
          setUserProfile(loadProfile(address));
        }

        // Check deep link for non-FC users too
        const params = new URLSearchParams(window.location.search);
        const joinCode = params.get('join');
        if (joinCode) {
          setShowConnectModal(true);
        }

      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initApp();

    listenToAccountChanges((account) => {
      if (!farcasterUser) {
        setIdentityId(account);
        setUserProfile(loadProfile(account));
        handleReset();
      }
    });

    return () => {
      peerService.destroy();
    };
  }, []);

  // Initialize Online Listener
  useEffect(() => {
    peerService.onMessage((msg: PeerMessage) => {
      if (msg.type === 'MOVE') {
        const move: Move = msg.payload;
        executeMove(move, true);
      } else if (msg.type === 'RESET') {
        handleReset(true);
      }
    });
  }, [board, currentPlayer, gameMode]);

  // Check Winner & Update Stats
  useEffect(() => {
    const win = checkWinner(board);
    if (win && !winner) {
      setWinner(win);
      const isUserWin = (gameMode === GameMode.ONLINE) ? win === myOnlineColor : win === HUMAN_PLAYER;
      const shouldUpdateStats = gameMode !== GameMode.PVP || win === Player.RED;

      if (shouldUpdateStats) {
        const newProfile = calculateNewStats(userProfile, isUserWin);
        setUserProfile(newProfile);
        saveProfile(newProfile, identityId);
        setXpGained(isUserWin ? 50 : 10);
      }
      playFx(isUserWin ? 'win' : 'lose');
    }
  }, [board, winner]);

  // AI Turn Logic
  useEffect(() => {
    if (gameMode === GameMode.PVAI && currentPlayer === AI_PLAYER && !winner) {
      const makeAiMove = async () => {
        setIsAiThinking(true);
        const bestMove = await getBestMove(board, AI_PLAYER, 4, mustCaptureFrom);
        setIsAiThinking(false);
        if (bestMove) {
          executeMove(bestMove);
        } else {
          setWinner(HUMAN_PLAYER);
        }
      };
      makeAiMove();
    }
  }, [currentPlayer, gameMode, winner, board, mustCaptureFrom]);

  useEffect(() => {
    if (turnTimerRef.current) { clearTimeout(turnTimerRef.current); turnTimerRef.current = null; }
    setTurnWarning("");
    const isMyTurn = (
      (gameMode === GameMode.PVAI && currentPlayer === HUMAN_PLAYER) ||
      (gameMode === GameMode.PVP) ||
      (gameMode === GameMode.ONLINE && currentPlayer === myOnlineColor)
    );
    if (!winner && isMyTurn) {
      const id = window.setTimeout(() => { setTurnWarning("Time is running..."); playFx('prompt'); }, 20000);
      turnTimerRef.current = id;
    }
    return () => { if (turnTimerRef.current) { clearTimeout(turnTimerRef.current); turnTimerRef.current = null; } };
  }, [currentPlayer, gameMode, winner, myOnlineColor]);

  const handleSquareClick = (pos: Position) => {
    if (winner || isAiThinking) return;
    if (gameMode === GameMode.PVAI && currentPlayer === AI_PLAYER) return;
    if (gameMode === GameMode.ONLINE && currentPlayer !== myOnlineColor) return;

    const clickedPiece = board[pos.row][pos.col];

    // 1. Move Execution
    const move = validMoves.find(m => m.to.row === pos.row && m.to.col === pos.col);
    if (move) {
      executeMove(move);
      return;
    }

    // 2. Selection
    if (mustCaptureFrom) return;

    if (clickedPiece && clickedPiece.player === currentPlayer) {
      setSelectedPos(pos);
      const allMoves = getValidMoves(board, currentPlayer, null);
      const pieceMoves = allMoves.filter(m => m.from.row === pos.row && m.from.col === pos.col);
      setValidMoves(pieceMoves);
    } else if (!clickedPiece) {
      setSelectedPos(null);
      setValidMoves([]);
    }
  };

  const executeMove = (move: Move, isRemote: boolean = false) => {
    setHistory(prev => [...prev, { board, currentPlayer, selectedPos, validMoves, mustCaptureFrom, winner }]);
    const { newBoard, promoted } = applyMove(board, move);
    setBoard(newBoard);
    if (!isRemote) {
      setTurnWarning("");
      playFx(move.isCapture ? 'capture' : 'move');
    }

    if (gameMode === GameMode.ONLINE && !isRemote) {
      peerService.sendMessage({ type: 'MOVE', payload: move });
    }

    let nextPlayer = currentPlayer;
    let nextMustCaptureFrom: Position | null = null;

    if (move.isCapture && !promoted) {
      const followUpMoves = getValidMoves(newBoard, currentPlayer, move.to).filter(m => m.isCapture);
      if (followUpMoves.length > 0) {
        nextMustCaptureFrom = move.to;
        const isMyTurnToContinue = (gameMode === GameMode.ONLINE && currentPlayer === myOnlineColor) ||
          (gameMode !== GameMode.ONLINE && (currentPlayer === HUMAN_PLAYER || gameMode === GameMode.PVP));

        if (isMyTurnToContinue && !isRemote) {
          setSelectedPos(move.to);
          setValidMoves(followUpMoves);
        } else {
          setSelectedPos(null);
          setValidMoves([]);
        }
      } else {
        nextPlayer = currentPlayer === Player.RED ? Player.WHITE : Player.RED;
        setSelectedPos(null);
        setValidMoves([]);
      }
    } else {
      nextPlayer = currentPlayer === Player.RED ? Player.WHITE : Player.RED;
      setSelectedPos(null);
      setValidMoves([]);
    }

    setMustCaptureFrom(nextMustCaptureFrom);
    setCurrentPlayer(nextPlayer);
    setAdvice("");
    setHintMove(null);
  };

  const undoLastMove = () => {
    if (gameMode === GameMode.ONLINE || isAiThinking) return;
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snap = next.pop() as Snapshot;
      setBoard(snap.board);
      setCurrentPlayer(snap.currentPlayer);
      setSelectedPos(snap.selectedPos);
      setValidMoves(snap.validMoves);
      setMustCaptureFrom(snap.mustCaptureFrom);
      setWinner(snap.winner);
      setAdvice("");
      return next;
    });
  };

  const handleReset = (isRemote: boolean = false) => {
    setBoard(createInitialBoard());
    setCurrentPlayer(Player.RED);
    setWinner(null);
    setSelectedPos(null);
    setValidMoves([]);
    setMustCaptureFrom(null);
    setAdvice("");
    setHintMove(null);
    setIsAiThinking(false);
    setXpGained(null);
    setHistory([]);
    setTurnWarning("");
    if (turnTimerRef.current) { clearTimeout(turnTimerRef.current); turnTimerRef.current = null; }
    if (gameMode === GameMode.ONLINE && !isRemote) {
      peerService.sendMessage({ type: 'RESET', payload: null });
    }
  };

  const toggleGameMode = (mode: GameMode) => {
    if (mode === GameMode.ONLINE && gameMode === GameMode.ONLINE) return;
    setGameMode(mode);
    handleReset();
    if (mode !== GameMode.ONLINE) {
      setMyPeerId(null);
      setIsConnected(false);
      setMyOnlineColor(null);
      peerService.destroy();
    }

    // Auto start host if switching to online
    if (mode === GameMode.ONLINE) {
      startHost();
    }
  };

  const handleAskAI = async () => {
    if (winner) return;
    setIsLoadingAdvice(true);
    const tip = await getGeminiAdvice(board, currentPlayer);
    const best = await getBestMove(board, currentPlayer, 3, mustCaptureFrom);
    setAdvice(tip);
    setHintMove(best || null);
    setIsLoadingAdvice(false);
  };

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    return audioCtxRef.current as AudioContext;
  };

  const playTone = (
    f: number,
    ms: number,
    opts: { vol?: number; type?: OscillatorType; attack?: number; lp?: number; delayMs?: number } = {}
  ) => {
    const { vol = 0.05, type = 'sine', attack = 0.01, lp = 1400, delayMs = 0 } = opts;
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.value = f;
    filter.type = 'lowpass';
    filter.frequency.value = lp;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(filter);
    filter.connect(ctx.destination);
    const start = ctx.currentTime + (delayMs / 1000);
    const end = start + (ms / 1000);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + attack);
    gain.gain.linearRampToValueAtTime(0.0001, end);
    osc.start(start);
    osc.stop(end + 0.02);
  };

  const playFx = (t: 'move' | 'capture' | 'win' | 'lose' | 'prompt') => {
    if (t === 'move') playTone(420, 120, { vol: 0.045, type: 'sine', attack: 0.01, lp: 1500 });
    else if (t === 'capture') playTone(560, 160, { vol: 0.05, type: 'triangle', attack: 0.01, lp: 1400 });
    else if (t === 'win') { playTone(523.25, 160, { vol: 0.05 }); playTone(659.25, 180, { vol: 0.05, delayMs: 120 }); playTone(783.99, 200, { vol: 0.05, delayMs: 250 }); }
    else if (t === 'lose') { playTone(659.25, 160, { vol: 0.045 }); playTone(523.25, 160, { vol: 0.045, delayMs: 120 }); playTone(392.0, 160, { vol: 0.045, delayMs: 240 }); }
    else if (t === 'prompt') playTone(880, 200, { vol: 0.045, type: 'sine', attack: 0.02, lp: 1600 });
  };

  const handleConnectWallet = async () => {
    if (farcasterUser) return;
    try {
      const address = await connectWallet();
      if (address) {
        setIdentityId(address);
        setUserProfile(loadProfile(address));
        await ensureBaseNetwork();
        handleReset();
      }
    } catch (err: any) {
      console.error("Connection failed", err);
      alert(err.message || "Failed to connect wallet.");
    }
  };

  const handleConnectMetaMask = async () => {
    if (farcasterUser) return;
    try {
      const address = await (await import('./services/web3Service')).connectWithMetaMask();
      if (address) {
        setIdentityId(address);
        setUserProfile(loadProfile(address));
        await ensureBaseNetwork();
        handleReset();
      }
    } catch (err: any) {
      console.error("Connection failed", err);
      alert(err.message || "Failed to connect MetaMask.");
    }
  };

  const handleConnectCoinbase = async () => {
    if (farcasterUser) return;
    try {
      const address = await (await import('./services/web3Service')).connectWithCoinbase();
      if (address) {
        setIdentityId(address);
        setUserProfile(loadProfile(address));
        await ensureBaseNetwork();
        handleReset();
      }
    } catch (err: any) {
      console.error("Connection failed", err);
      alert(err.message || "Failed to connect Coinbase Wallet.");
    }
  };

  const startHost = () => {
    // Only init if not already initialized
    if (!myPeerId) {
      peerService.init((id) => {
        setMyPeerId(id);
        setMyOnlineColor(Player.RED);
      });
      peerService.onMessage((msg) => {
        if (msg.type === 'MOVE') executeMove(msg.payload, true);
        if (msg.type === 'RESET') handleReset(true);
      });
    }
  };

  const joinGame = (code?: string) => {
    if (!farcasterUser) { setShowConnectModal(true); return; }
    const codeToJoin = code || remotePeerIdInput;
    if (!codeToJoin) return;
    // Ensure mode is Online
    if (gameMode !== GameMode.ONLINE) setGameMode(GameMode.ONLINE);

    setMyOnlineColor(Player.WHITE);
    setIsRotated(true);
    peerService.connect(codeToJoin, () => {
      setIsConnected(true);
      alert("Connected to game!");
    });
  };

  const shareInvite = async () => {
    if (!myPeerId) return;
    if (!farcasterUser) {
      setShareBtnLabel('Farcaster required');
      setTimeout(() => setShareBtnLabel('Share Invite'), 2000);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('join', myPeerId);
    const shareUrl = url.toString();
    const shareText = gameMode === GameMode.ONLINE ? "Playing now: Checkers 🟢 vs ⚪️ — join me!" : "Training Checkers — come watch or play!";
    setShareBtnLabel("Opening...");
    const composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareUrl)}`;
    openExternalUrl(composeUrl);
    setTimeout(() => setShareBtnLabel("Share Invite"), 2000);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        <p className="text-sm font-medium animate-pulse">Loading Checkers...</p>
      </div>
    );
  }

  const leaderboardData = getLeaderboard(userProfile);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-2 md:p-6 gap-6 overflow-y-auto pb-24 md:pb-10">

      {/* Board Section - First */}
      <div className="flex flex-col items-center justify-center w-full max-w-[600px]">
        <div className="w-full aspect-square relative">
          <Board
            board={board}
            selectedPos={selectedPos}
            validMoves={validMoves}
            onSquareClick={handleSquareClick}
            isRotated={isRotated}
            hintMove={hintMove}
            theme={boardTheme}
          />
        </div>

        {/* Bottom Actions */}
        <div className="flex w-full gap-2 mt-4">
          <button onClick={undoLastMove} disabled={history.length === 0 || gameMode === GameMode.ONLINE || isAiThinking} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-1 border border-slate-700 disabled:opacity-50">
            <ArrowRight className="w-4 h-4" /> <span className="text-xs font-bold">Undo</span>
          </button>
          <button onClick={() => handleReset()} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-1 border border-slate-700">
            <RotateCcw className="w-4 h-4" /> <span className="text-xs font-bold">Reset</span>
          </button>
          <button onClick={() => setIsRotated(!isRotated)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-1 border border-slate-700">
            <Repeat className="w-4 h-4" /> <span className="text-xs font-bold">Rotate</span>
          </button>
          <button
            onClick={handleAskAI}
            disabled={isLoadingAdvice || !!winner}
            className="flex-[1.5] py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-1 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            <BrainCircuit className="w-4 h-4" /> <span className="text-xs font-bold">{advice ? 'Advice' : 'AI Hint'}</span>
          </button>
        </div>

        {/* Advice Popover (conditional) */}
        {advice && (
          <div className="mt-2 p-3 bg-indigo-900/90 border border-indigo-500/50 rounded-lg text-xs text-indigo-100 w-full animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-start">
              <p className="pl-4">{advice}</p>
              <button onClick={() => setAdvice("")}><X className="w-3 h-3 text-indigo-400" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Profile & Controls Section - Second (Below Board) */}
      <div className="flex flex-col gap-4 w-full max-w-[600px] shrink-0">
        {/* Compact Profile Header */}
        <div className="bg-slate-800 rounded-xl p-3 md:p-4 shadow-lg border border-slate-700 flex flex-row items-center gap-3">
          <div className={`w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center border-2 border-white/10 shadow-inner overflow-hidden ${identityId ? 'from-emerald-500 to-teal-600' : 'from-indigo-500 to-purple-600'}`}>
            {userProfile.pfpUrl ? (
              <img src={userProfile.pfpUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="text-white w-6 h-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-1">
              <h2 className="font-bold text-white text-base truncate pl-2">
                {userProfile.username ? `@${userProfile.username}` : userProfile.rankTitle}
              </h2>
              <span className="text-xs text-slate-400 font-mono shrink-0">LVL {userProfile.level}</span>
            </div>

            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden mb-1.5">
              <div className={`h-full transition-all duration-1000 ${identityId ? 'bg-emerald-400' : 'bg-indigo-400'}`} style={{ width: `${(userProfile.xp / userProfile.nextLevelXp) * 100}%` }}></div>
            </div>

            <div className="flex gap-3 text-[10px] md:text-xs text-slate-400">
              <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-400" /> {userProfile.wins}</span>
              <span className="flex items-center gap-1"><X className="w-3 h-3 text-rose-400" /> {userProfile.losses}</span>
              {!farcasterUser && !identityId && (
                <button onClick={() => setShowConnectModal(true)} className="ml-auto text-orange-400 hover:underline flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Game Status & Controls */}
        <div className="bg-slate-800 rounded-xl p-3 md:p-6 shadow-lg border border-slate-700">
          {/* Mode Switcher */}
          <div className="flex bg-slate-900 p-1 rounded-lg mb-4 border border-slate-700 gap-1">
            <button onClick={() => toggleGameMode(GameMode.PVAI)} className={`flex-1 py-1.5 text-[10px] font-bold rounded flex justify-center items-center gap-1 ${gameMode === GameMode.PVAI ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Cpu className="w-3 h-3" /> Play AI</button>
            <button onClick={() => toggleGameMode(GameMode.ONLINE)} className={`flex-1 py-1.5 text-[10px] font-bold rounded flex justify-center items-center gap-1 ${gameMode === GameMode.ONLINE ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}><Globe className="w-3 h-3" /> Play Friend</button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-slate-400">Theme</span>
            <select value={boardTheme} onChange={(e) => setBoardTheme(e.target.value as any)} className="text-[10px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300">
              <option value="checkers">Checkers</option>
              <option value="classic">Classic</option>
              <option value="neon">Neon</option>
            </select>
          </div>

          {/* Turn Indicator */}
          <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
            <span className="text-slate-400 text-xs font-medium">Turn</span>
            <div className="flex items-center gap-2">
              {isAiThinking && <Cpu className="w-3 h-3 animate-pulse text-indigo-400" />}
              <span className={`px-3 py-0.5 rounded-full font-bold text-xs ${currentPlayer === Player.RED ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' : 'bg-slate-200/20 text-slate-200 border border-slate-200/50'}`}>
                {currentPlayer === Player.RED ? 'BLUE' : 'WHITE'}
                {gameMode === GameMode.ONLINE && currentPlayer === myOnlineColor && ' (YOU)'}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="mt-3 text-center min-h-[1.5em]">
            {winner ? (
              <span className="text-amber-400 font-bold animate-pulse text-sm">
                {winner === Player.RED ? 'Blue Wins!' : 'White Wins!'} {xpGained && `(+${xpGained} XP)`}
              </span>
            ) : mustCaptureFrom ? (
              <span className="text-orange-400 text-xs font-bold animate-pulse">Must Jump!</span>
            ) : (
              <span className="text-slate-500 text-xs">
                {gameMode === GameMode.ONLINE && !isConnected && !myPeerId ? 'Setting up game...' : (turnWarning || 'Make your move')}
              </span>
            )}
          </div>

          {/* Online Setup Panel (Deep Link & Copy) */}
          {gameMode === GameMode.ONLINE && !isConnected && (
            <div className="mt-3 flex flex-col gap-2">
              {/* Auto-Host waiting message if just clicked */}
              {!myPeerId ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span className="text-xs text-slate-400">Creating Room...</span>
                </div>
              ) : (
                <div className="animate-in fade-in zoom-in duration-300">
                  {farcasterUser ? (
                    <button onClick={shareInvite} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded flex items-center justify-center gap-2 mb-2 animate-pulse shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
                      {shareBtnLabel === 'Copied!' ? <CheckCheck className="w-4 h-4" /> : <Share2 className="w-4 h-4" />} {shareBtnLabel}
                    </button>
                  ) : (
                    <button onClick={() => setShowConnectModal(true)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded flex items-center justify-center gap-2 mb-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
                      <Link className="w-4 h-4" /> Connect Farcaster to Invite
                    </button>
                  )}

                  {farcasterUser && (
                    !showJoinInput ? (
                      <div className="text-center mt-2">
                        <button onClick={() => setShowJoinInput(true)} className="text-[10px] text-slate-400 underline hover:text-white flex items-center justify-center gap-1 w-full">
                          <Link className="w-3 h-3" /> Have a code? Enter it here
                        </button>
                      </div>
                    ) : (
                      <div className="text-center mt-2 animate-in fade-in slide-in-from-top-2">
                        <div className="flex gap-2">
                          <input
                            value={remotePeerIdInput}
                            onChange={(e) => setRemotePeerIdInput(e.target.value)}
                            placeholder="Paste Code"
                            className="flex-1 bg-black/30 border border-slate-600 rounded px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 text-left"
                          />
                          <button onClick={() => joinGame()} className="px-4 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded font-bold">Join</button>
                        </div>
                        <button onClick={() => setShowJoinInput(false)} className="text-[10px] text-slate-500 mt-2 hover:text-slate-400">Cancel</button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {gameMode === GameMode.ONLINE && isConnected && (
            <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded p-2 text-center">
              <span className="text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Connected
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 relative shadow-2xl">
            <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-400" /> Checkers Rules</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-300">
              <li>Pieces move <strong>forward</strong> or <strong>sideways</strong> (left/right) one square.</li>
              <li>No backward moves or diagonal moves for ordinary pieces.</li>
              <li><strong>Forced Capture:</strong> If you can capture, you MUST capture.</li>
              <li><strong>Multi-jumps:</strong> You must continue jumping if possible.</li>
              <li><strong>Kings (Flying Kings):</strong> Move any distance vertically or horizontally.</li>
            </ul>
            <button onClick={() => setShowRules(false)} className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold transition-colors">Close</button>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col relative shadow-2xl">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-amber-400" /> Leaderboard</h2>
              <button onClick={() => setShowLeaderboard(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-0">
              {leaderboardData.map((player, index) => {
                const isMe = player.username === userProfile.username;
                return (
                  <div key={index} className={`flex items-center gap-3 p-3 border-b border-slate-700/50 ${isMe ? 'bg-indigo-900/20' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${index < 3 ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300'}`}>
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? 'text-indigo-300' : 'text-slate-200'}`}>
                        {player.username || player.rankTitle}
                        {isMe && <span className="ml-2 text-[10px] bg-indigo-600 px-1 rounded text-white">YOU</span>}
                      </p>
                      <p className="text-[10px] text-slate-400">Level {player.level} • {player.rankTitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-emerald-400 font-bold">{player.wins} W</p>
                      <p className="text-[10px] text-slate-500">{player.xp.toLocaleString()} XP</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-900/30">
              <button onClick={() => setShowLeaderboard(false)} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar: Leaderboard & Rules */}
      <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center">
        <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-full px-3 py-2 shadow-xl flex gap-2">
          <button onClick={() => setShowLeaderboard(true)} className="px-3 py-2 rounded-full text-amber-300 hover:text-amber-200 hover:bg-slate-700/50 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs font-bold hidden sm:inline">Leaderboard</span>
          </button>
          <button onClick={() => setShowRules(true)} className="px-3 py-2 rounded-full text-slate-200 hover:text-white hover:bg-slate-700/50 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span className="text-xs font-bold hidden sm:inline">Checkers Rules</span>
          </button>
          <button onClick={() => setShowAddMiniApp(true)} className="px-3 py-2 rounded-full text-violet-300 hover:text-violet-200 hover:bg-slate-700/50 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <span className="text-xs font-bold hidden sm:inline">Add Mini App</span>
          </button>
        </div>
      </div>

      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden">
            <div className="p-5">
              <h3 className="text-xl font-bold text-center text-blue-500">Connect Your Wallet</h3>
              <p className="text-center text-slate-400 text-xs mt-1">Connect Wallet for the best experience</p>
              <div className="mt-4 space-y-3">
                <button onClick={() => { setSelectedWallet('farcaster'); setShowFcConfirm(true); }} className={`w-full px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 ${selectedWallet === 'farcaster' ? 'ring-4 ring-black' : ''}`}>
                  <span className="w-6 h-6 bg-white/20 rounded"></span> Farcaster
                </button>
                <button onClick={() => { setSelectedWallet('metamask'); setShowConnectModal(false); handleConnectMetaMask(); }} className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/20 rounded"></span> MetaMask
                </button>
                <button onClick={() => { setSelectedWallet('coinbase'); setShowConnectModal(false); handleConnectCoinbase(); }} className="w-full px-4 py-3 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-bold flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/20 rounded"></span> Coinbase Wallet
                </button>
                <button onClick={() => { setSelectedWallet('rabby'); setShowConnectModal(false); handleConnectWallet(); }} className="w-full px-4 py-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/20 rounded"></span> Rabby Wallet
                </button>
                <button onClick={() => { setSelectedWallet('haha'); }} className="w-full px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/20 rounded"></span> HaHa Wallet
                </button>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="mt-4 w-full py-2 text-slate-500">Close</button>
            </div>
          </div>
        </div>
      )}

      {showFcConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6">
              <div className="w-24 h-40 mx-auto bg-slate-800 rounded-xl mb-4"></div>
              <h3 className="text-white text-xl font-bold text-center">Confirm it's you</h3>
              <p className="text-slate-400 text-xs text-center mt-1">Click Continue below and tap Approve on your Farcaster mobile app to start using your wallet on web.</p>
              <button onClick={async () => { try { await initFarcaster(); const fcUser = await getFarcasterContext(); if (fcUser) { const fcId = `fc-${fcUser.fid}`; setFarcasterUser(fcUser); setIdentityId(fcId); setUserProfile(loadProfile(fcId)); setShowFcConfirm(false); setShowConnectModal(false); setShowAddMiniApp(true); } } catch { } }} className="mt-6 w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-full">Continue</button>
              <p className="text-slate-500 text-[10px] text-center mt-2">You'll stay signed in for 30 days on this browser.</p>
              <button onClick={() => { setShowFcConfirm(false); }} className="mt-2 w-full py-2 text-slate-500">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddMiniApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6">
              <div className="w-16 h-16 mx-auto rounded-xl overflow-hidden mb-3 relative">
                <img src="/checkers-logo.png" alt="Checkers Logo" className="w-full h-full object-cover" />
                <div className="absolute -top-1 -right-1 bg-violet-600 text-white rounded-full p-1 shadow">
                  <Plus className="w-3 h-3" />
                </div>
              </div>
              <h3 className="text-white text-lg font-bold text-center">Add Mini App: Checkers</h3>
              <div className="mt-3 space-y-2">
                <label className="flex items-center justify-between bg-slate-800 rounded-lg p-3 text-slate-200 text-sm"><span className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-violet-400" /> Add to Farcaster</span><input type="checkbox" checked={addToFarcaster} onChange={(e) => setAddToFarcaster(e.target.checked)} /></label>
                <label className="flex items-center justify-between bg-slate-800 rounded-lg p-3 text-slate-200 text-sm"><span className="flex items-center gap-2"><Bell className="w-4 h-4 text-violet-400" /> Enable notifications</span><input type="checkbox" checked={enableNotifications} onChange={(e) => setEnableNotifications(e.target.checked)} /></label>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setShowAddMiniApp(false); }} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold">Cancel</button>
                <button onClick={async () => { const res = await addMiniAppAndEnableNotifications(); if (res.added && enableNotifications) { await sendSelfNotification('Welcome', 'Checkers ready', window.location.href); } setShowAddMiniApp(false); }} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
