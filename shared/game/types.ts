import { World } from "koota";

export type GameData = {
  sessionId: string;
  world: World;
};

export type GameSimulation = {
  gameData: GameData;
  status: "RUNNING" | "PAUSED";
  start: (cb: () => void) => void;
};

export type MultiplayerGameStatus =
  | "PAUSED_AWAITING_START"
  | "PAUSED_AWAITING_PLAYERS"
  | "PLAYING";
