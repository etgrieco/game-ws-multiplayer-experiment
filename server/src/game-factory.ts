import { movePosition2ByVelocitySystem } from "@shared/ecs/system.js";
import { DamageZone, IsEnemy, Player, Position2 } from "@shared/ecs/trait.js";
import type { GameData, GameSimulation } from "@shared/game/types.js";
import { createWorld } from "koota";
import type { WebSocket as WS } from "ws";
import { wsSend } from "./wsSend.js";

const TICK_RATE = 1000 / 10; // 60 updates per second (~16.67ms per frame)

/** First step to run to set up game logic + initial state */
export function setupGameSimulation(
  id: string,
  world = createWorld(),
  lastUpdated?: number
): GameSimulation {
  const gameData: GameSimulation["gameData"] = {
    sessionId: id,
    world,
  };

  const simulation: GameSimulation = {
    lastUpdated: lastUpdated ?? Date.now(),
    gameData: gameData,
    status: "PAUSED",
    pause() {
      this.status = "PAUSED";
    },
    start(syncCb) {
      this.status = "RUNNING";
      const { initGameLoop, destroy } = gameLoopFactory((deltaTime) => {
        if (this.status !== "RUNNING") {
          destroy();
          return;
        }
        gameLoop(gameData, deltaTime);
        syncCb?.();
        simulation.lastUpdated = Date.now();
      });
      // and just kick it off
      initGameLoop();
    },
  };
  return simulation;
}

export type GameSimulationBroadcaster = {
  gameData: GameData;
  sync: () => void;
  updateConnect(playerNumber: 1 | 2, ws: WS): void;
  readonly connections: [WS | null, WS | null];
};

export function createGameBroadcaster(
  gameData: GameData,
  wsConnections: [WS | null, WS | null]
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
      const playerPositionsQuery = gameData.world.query(Position2, Player);
      const playersOrdered = playerPositionsQuery.slice().sort((a, b) => {
        return a.get(Player)!.playerNumber - b.get(Player)!.playerNumber;
      });
      const damages = gameData.world.query(Position2, DamageZone);

      let idx = 0;
      for (const ws of privConnections) {
        if (!ws) {
          break;
        }
        if (ws.readyState === ws.CLOSED) {
          console.debug(`Connection is closed for [${idx}]; skipping update`);
          break;
        }
        wsSend(ws, {
          id: crypto.randomUUID(),
          type: "POSITIONS_UPDATE",
          data: {
            playerPositions: playersOrdered.map((p) => ({
              playerId: p.get(Player)!.playerId,
              x: p.get(Position2)!.x,
              z: p.get(Position2)!.z,
            })),
            damagePositions: damages.map((d) => ({
              playerId: d.get(DamageZone)!.playerId,
              x: d.get(Position2)!.x,
              z: d.get(Position2)!.z,
            })),
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
  let timeout: NodeJS.Timeout;
  let isDestroyed = false;
  const gameLoop = {
    initGameLoop() {
      if (isDestroyed) return;
      const startTime = performance.now();
      // Update game state here (e.g., physics, player positions, ball movement)
      mainMethod(frameDelta);
      const endTime = performance.now();
      const elapsed = endTime - startTime;
      const nextScheduledDelay = Math.max(0, TICK_RATE - elapsed);
      timeout = setTimeout(gameLoop.initGameLoop, nextScheduledDelay); // Schedule the next tick
      frameDelta = nextScheduledDelay;
    },
    destroy() {
      isDestroyed = true;
      clearTimeout(timeout);
    },
  };
  return gameLoop;
}
