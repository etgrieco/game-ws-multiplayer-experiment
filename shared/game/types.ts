import { World } from "koota";

export type GameData = {
  id: string;
  world: World;
};

export type GameSimulation = {
  gameData: GameData;
  start: (cb: () => void) => void;
};

export type GameSimulationBroadcaster = {
  gameData: GameData;
  sync: () => void;
};
