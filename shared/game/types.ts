import { World } from "koota";

export type GameData = {
  id: string;
  world?: World;
};

export type GameSimulation = {
  data: GameData;
  tick: () => void;
};
