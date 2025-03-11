import { GameSimulation, MultiplayerGameStatus } from "@shared/game/types.js";
import { GameSimulationBroadcaster } from "./game-factory.js";
import { WebSocket as WS } from "ws";

export type MultiplayerGameContainer = {
  id: string;
  gameStatus: MultiplayerGameStatus;
  gameSim: GameSimulation;
  /** Connections to collect prior to game loop start */
  connections: [WS | null, WS | null];
  players: [string | null, string | null];
  /**
   * Handles arbitrary synchronization tasks in the game loop to our active connections.
   * Once established, connections can be re-established over time
   */
  broadcaster: GameSimulationBroadcaster | null;
};
