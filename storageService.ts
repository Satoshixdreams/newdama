import { UserProfile } from "../types";

const STORAGE_KEY_PREFIX = 'checkers_profile_';
const DEFAULT_KEY = 'guest';

const INITIAL_PROFILE: UserProfile = {
  level: 1,
  xp: 0,
  wins: 0,
  losses: 0,
  rankTitle: "Novice",
  nextLevelXp: 100
};

export const getRankTitle = (level: number): string => {
  if (level >= 50) return "Grandmaster"; 
  if (level >= 30) return "Warlord"; 
  if (level >= 20) return "Master"; 
  if (level >= 10) return "Expert"; 
  if (level >= 5) return "Warrior"; 
  return "Novice"; 
};

const getStorageKey = (id?: string | null) => {
  return `${STORAGE_KEY_PREFIX}${id ? id.toLowerCase() : DEFAULT_KEY}`;
};

export const loadProfile = (id?: string | null): UserProfile => {
  try {
    const key = getStorageKey(id);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load profile", e);
  }
  // Return a fresh profile if none exists
  return { ...INITIAL_PROFILE };
};

export const saveProfile = (profile: UserProfile, id?: string | null) => {
  try {
    const key = getStorageKey(id);
    localStorage.setItem(key, JSON.stringify(profile));
  } catch (e) {
    console.error("Failed to save profile", e);
  }
};

export const calculateNewStats = (currentProfile: UserProfile, isWin: boolean): UserProfile => {
  const xpGain = isWin ? 50 : 10; // 50 XP for win, 10 for playing (loss)
  let newXp = currentProfile.xp + xpGain;
  let newLevel = currentProfile.level;
  let nextLevelXp = currentProfile.nextLevelXp;

  // Level Up Logic (Simple curve)
  while (newXp >= nextLevelXp) {
    newXp -= nextLevelXp;
    newLevel++;
    nextLevelXp = Math.floor(nextLevelXp * 1.2); // Next level is 20% harder
  }

  return {
    ...currentProfile,
    level: newLevel,
    xp: newXp,
    wins: currentProfile.wins + (isWin ? 1 : 0),
    losses: currentProfile.losses + (isWin ? 0 : 1),
    rankTitle: getRankTitle(newLevel),
    nextLevelXp
  };
};

export const getLeaderboard = (currentUser: UserProfile): UserProfile[] => {
  // Simulate a global leaderboard by mixing high-ranking "bots" with the current user
  const mockPlayers: UserProfile[] = [
    { level: 42, xp: 15400, wins: 312, losses: 98, rankTitle: "Grandmaster", nextLevelXp: 99999, username: "DamaKing" },
    { level: 35, xp: 12100, wins: 245, losses: 112, rankTitle: "Warlord", nextLevelXp: 99999, username: "Satoshi" },
    { level: 28, xp: 8500, wins: 180, losses: 60, rankTitle: "Master", nextLevelXp: 99999, username: "ProPlayer" },
    { level: 19, xp: 5200, wins: 120, losses: 85, rankTitle: "Expert", nextLevelXp: 99999, username: "BlueFalcon" },
    { level: 12, xp: 3100, wins: 65, losses: 40, rankTitle: "Expert", nextLevelXp: 99999, username: "Player_99" },
  ];

  // Add current user to list
  const allPlayers = [...mockPlayers, currentUser];

  // Sort by XP descending
  return allPlayers.sort((a, b) => {
    // Calculate total XP approximation for sorting (Level * 100 + current XP) - very rough
    const totalXpA = (a.level * 500) + a.xp;
    const totalXpB = (b.level * 500) + b.xp;
    return totalXpB - totalXpA;
  });
};
