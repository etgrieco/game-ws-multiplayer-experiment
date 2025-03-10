import { World } from "koota";

export type GameData = {
  sessionId: string;
  world: World;
};

export type GameSimulation = {
  gameData: GameData;
  start: (cb: () => void) => void;
};
