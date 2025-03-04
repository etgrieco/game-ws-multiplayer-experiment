import { movePosition2System } from "@shared/ecs/system";
import { GameData } from "@shared/game/types";

// START TRAITS

const TICK_RATE = 1000 / 60; // 60 updates per second (~16.67ms per frame)

function gameLoop(initGameData: GameData) {
  if (!initGameData.world) {
    throw new Error("Expects workd to be already initailzied");
  }
  // do stuff
  movePosition2System(initGameData.world);
}

function setupGame(id: string) {
  const initGameData: GameData = {
    id,
    world,
  };

  const initGameLoop = gameLoopFactory(() => gameLoop(initGameData));
}

function gameLoopFactory(mainMethod: () => void) {
  return function initGameLoop() {
    const startTime = Date.now();

    // Update game state here (e.g., physics, player positions, ball movement)
    console.log("Game tick at", startTime);

    const endTime = Date.now();
    const elapsed = endTime - startTime;
    const delay = Math.max(0, TICK_RATE - elapsed);

    // DO STUFF
    mainMethod();

    setTimeout(initGameLoop, delay); // Schedule the next tick
  };
}
