import { World } from "koota";
import { Position2, Velocity2 } from "./trait.js";

export function movePosition2ByVelocitySystem(world: World, deltaTime: number) {
  const movablesQuery = world.query(Position2, Velocity2);
  movablesQuery.updateEach(([p, v]) => {
    p.x += v.x * deltaTime;
    p.y += v.y * deltaTime;
  });
}

export function moveVelocityUpDown(world: World, minY: number, maxY: number) {
  world.query(Velocity2, Position2).updateEach(([v, p]) => {
    if (p.y >= maxY || p.y <= minY) {
      v.y *= -1;
    }
  });
}
