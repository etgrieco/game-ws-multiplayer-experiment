import type { World } from "koota";

export type GameData = {
  sessionId: string;
  world: World;
};

export type GameSimulation = {
  gameData: GameData;
  status: "RUNNING" | "PAUSED";
  start: (cb?: () => void) => void;
  pause: () => void;
};

export type MultiplayerGameStatus =
  | "PAUSED_AWAITING_START"
  | "PAUSED_AWAITING_PLAYERS"
  | "PLAYING";
