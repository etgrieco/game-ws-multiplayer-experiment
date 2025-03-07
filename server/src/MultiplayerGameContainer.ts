import {
  GameSimulation,
  GameSimulationBroadcaster,
} from "@shared/game/types.js";
import { WS } from "./wsSend.js";

export type MultiplayerGameContainer = {
  gameSim: GameSimulation;
  connections: [WS | undefined, WS | undefined];
  broadcaster: GameSimulationBroadcaster | undefined;
};
