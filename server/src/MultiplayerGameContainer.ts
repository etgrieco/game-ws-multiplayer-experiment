import {
  GameSimulation,
  GameSimulationBroadcaster,
} from "@shared/game/types.js";
import { WebSocket as WsWebSocketInstance } from "ws";

export type MultiplayerGameContainer = {
  gameSim: GameSimulation;
  connections: [
    WsWebSocketInstance | undefined,
    WsWebSocketInstance | undefined,
  ];
  broadcaster: GameSimulationBroadcaster | undefined;
};
