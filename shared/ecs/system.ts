import type { World } from "koota";
import { Position2, Velocity2 } from "./trait.js";

export function movePosition2ByVelocitySystem(world: World, deltaTime: number) {
  const movablesQuery = world.query(Position2, Velocity2);
  movablesQuery.updateEach(([p, v]) => {
    p.x += v.x * (deltaTime / 1000);
    p.z += v.z * (deltaTime / 1000);
  });
}
