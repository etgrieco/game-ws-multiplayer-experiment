import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait";
import { createWorld, World } from "koota";

/** Creates a new world, or spawns initial game entities from a given world */
export const createInitialGameWorld = (world: World = createWorld()) => {
  // player 1 thing
  world.spawn(Position2(), Velocity2(), OfPlayer({ playerNumber: 1 }));

  // player 2 thing
  world.spawn(Position2(), Velocity2(), OfPlayer({ playerNumber: 2 }));

  return world;
};
