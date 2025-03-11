import { movePosition2ByVelocitySystem } from "@shared/ecs/system.js";
import { OfPlayer, Position2 } from "@shared/ecs/trait.js";
import { GameData, GameSimulation } from "@shared/game/types.js";
import { wsSend } from "./wsSend.js";
import { WebSocket as WS } from "ws";
import { createWorld } from "koota";

const TICK_RATE = 1000 / 10; // 60 updates per second (~16.67ms per frame)

/** First step to run to set up game logic + initial state */
export function setupGameSimulation(
  id: string,
  world = createWorld(),
): GameSimulation {
  const gameData: GameSimulation["gameData"] = {
    sessionId: id,
    world,
  };

  return {
    gameData: gameData,
    status: "PAUSED",
    start(syncCb) {
      this.status = "RUNNING";
      const loop = gameLoopFactory((deltaTime) => {
        gameLoop(gameData, deltaTime);
        syncCb();
      });
      // and just kick it off
      loop();
    },
  };
}

export type GameSimulationBroadcaster = {
  gameData: GameData;
  sync: () => void;
  readonly connections: [WS | null, WS | null];
  updateConnect(playerNumber: 1 | 2, ws: WS): void;
};

export function setupGameBroadcaster(
  gameData: GameData,
  wsConnections: [WS | null, WS | null],
): GameSimulationBroadcaster {
  const privConnections: typeof wsConnections = [
    wsConnections[0],
    wsConnections[1],
  ];

  return {
    gameData,
    /** Updates underlying connection pool */
    updateConnect(playerNumber, ws) {
      const playerIdx = playerNumber - 1;
      privConnections[playerIdx] = ws;
    },
    connections: privConnections,
    sync() {
      const playerPositionsQuery = gameData.world.query(Position2, OfPlayer);
      const entitiesOrdered = [
        playerPositionsQuery.filter(
          (v) => v.get(OfPlayer)!.playerNumber === 1,
        )[0]!,
        playerPositionsQuery.filter(
          (v) => v.get(OfPlayer)!.playerNumber === 2,
        )[0]!,
      ] as const;

      let idx = 0;
      for (const ws of privConnections) {
        if (!ws) {
          break;
        }
        if (ws.readyState === ws.CLOSED) {
          console.error(`Connection is closed for [${idx}]; skipping update`);
          break;
        }
        wsSend(ws, {
          type: "POSITIONS_UPDATE",
          data: {
            playerPositions: [
              entitiesOrdered[0].get(Position2)!,
              entitiesOrdered[1].get(Position2)!,
            ],
          },
        });
        idx++;
      }
    },
  };
}

function gameLoop(initGameData: GameData, deltaTime: number) {
  // do stuff
  movePosition2ByVelocitySystem(initGameData.world!, deltaTime);
}

function gameLoopFactory(mainMethod: (deltaTime: number) => void) {
  let frameDelta = 0;
  return function initGameLoop() {
    const startTime = performance.now();
    // Update game state here (e.g., physics, player positions, ball movement)
    mainMethod(frameDelta);
    const endTime = performance.now();
    const elapsed = endTime - startTime;
    const nextScheduledDelay = Math.max(0, TICK_RATE - elapsed);
    setTimeout(initGameLoop, nextScheduledDelay); // Schedule the next tick
    frameDelta = nextScheduledDelay;
  };
}
