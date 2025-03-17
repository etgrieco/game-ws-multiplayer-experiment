import type {
  GameSimulation,
  MultiplayerGameStatus,
} from "@shared/game/types.js";
import type { GameSimulationBroadcaster } from "./game-factory.js";

export type MultiplayerGameContainer = {
  id: string;
  gameStatus: MultiplayerGameStatus;
  gameSim: GameSimulation;
  broadcaster: GameSimulationBroadcaster;
};
