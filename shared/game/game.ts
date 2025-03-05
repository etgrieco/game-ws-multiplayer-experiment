import { OfPlayer, Position2, Velocity2 } from "@shared/ecs/trait";
import { createWorld } from "koota";

export const createGameWorld = () => {
  const world = createWorld();

  // player 1 thing
  world.spawn(Position2(), Velocity2(), OfPlayer({ playerNumber: 1 }));

  // player 2 thing
  world.spawn(Position2(), Velocity2(), OfPlayer({ playerNumber: 2 }));

  return world;
};
