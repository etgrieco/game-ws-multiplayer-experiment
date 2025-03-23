import type {
  GameSimulation,
  MultiplayerSessionStatus,
} from "@shared/game/types.js";
import type { GameSimulationBroadcaster } from "./game-factory.js";

export type MultiplayerGameContainer = {
  id: string;
  gameStatus: MultiplayerSessionStatus;
  gameSim: GameSimulation;
  broadcaster: GameSimulationBroadcaster;
};
