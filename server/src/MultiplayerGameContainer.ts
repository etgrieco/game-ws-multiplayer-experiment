import { GameSimulation, MultiplayerGameStatus } from "@shared/game/types.js";
import { GameSimulationBroadcaster } from "./game-factory.js";

export type MultiplayerGameContainer = {
  id: string;
  gameStatus: MultiplayerGameStatus;
  gameSim: GameSimulation;
  players: [string | null, string | null];
  broadcaster: GameSimulationBroadcaster;
};
