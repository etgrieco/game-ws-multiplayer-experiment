import { movePosition2ByVelocitySystem } from "@shared/ecs/system.js";
import { OfPlayer, Position2 } from "@shared/ecs/trait.js";
import { createInitialGameWorld } from "@shared/game/game.js";
import {
  GameData,
  GameSimulation,
  GameSimulationBroadcaster,
} from "@shared/game/types.js";
import { WebSocket } from "ws";
import { wsSend } from "./wsSend.js";

// START TRAITS

const TICK_RATE = 1000 / 60; // 60 updates per second (~16.67ms per frame)

/** First step to run to set up game logic + initial state */
export function setupGameSimulation(id: string): GameSimulation {
  const gameData: GameSimulation["gameData"] = {
    id,
    world: createInitialGameWorld(),
  };

  return {
    gameData: gameData,
    start(syncCb) {
      const loop = gameLoopFactory((deltaTime) => {
        gameLoop(gameData, deltaTime);
        syncCb();
      });
      // and just kick it off
      loop();
    },
  };
}

export function setupGameBroadcaster(
  gameData: GameData,
  wsConnections: WebSocket[],
): GameSimulationBroadcaster {
  return {
    gameData,
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

      wsConnections.forEach((ws) => {
        wsSend(ws, {
          type: "POSITIONS_UPDATE",
          data: {
            playerPositions: [
              entitiesOrdered[0].get(Position2)!,
              entitiesOrdered[1].get(Position2)!,
            ],
          },
        });
      });
    },
  };
}

function gameLoop(initGameData: GameData, deltaTime: number) {
  // do stuff
  movePosition2ByVelocitySystem(initGameData.world!, deltaTime);
  // moveVelocityUpDown(initGameData.world!, 0, 100);
}

function gameLoopFactory(mainMethod: (deltaTime: number) => void) {
  let frameDelta = 0;
  return function initGameLoop() {
    const startTime = performance.now();
    // Update game state here (e.g., physics, player positions, ball movement)
    // console.log("Game tick at", startTime);
    mainMethod(frameDelta);
    const endTime = performance.now();
    const elapsed = endTime - startTime;
    const nextScheduledDelay = Math.max(0, TICK_RATE - elapsed);
    setTimeout(initGameLoop, nextScheduledDelay); // Schedule the next tick
    frameDelta = nextScheduledDelay;
  };
}
