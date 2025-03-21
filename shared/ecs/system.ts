import type { World } from "koota";
import { IsLandscape, IsObstacle, Position2, Velocity2 } from "./trait.js";

export function movePosition2ByVelocitySystem(world: World, deltaTime: number) {
  const movablesQuery = world.query(Position2, Velocity2);
  movablesQuery.updateEach(([p, v]) => {
    p.x += v.x * (deltaTime / 1000);
    p.z += v.z * (deltaTime / 1000);
  });
}

export function addRandomGameLandscapeTreeObstacles(
  world: World,
  maxX: number,
  maxZ: number,
  numberOfEntities: number
) {
  const arrX = new Uint32Array(numberOfEntities);
  const arrZ = new Uint32Array(numberOfEntities);
  crypto.getRandomValues(arrX);
  crypto.getRandomValues(arrZ);

  for (let i = 0; i < numberOfEntities; i++) {
    const normalizedRandX = (arrX[i]! / (0xffffffff + 1)) * maxX;
    const normalizedRandZ = (arrZ[i]! / (0xffffffff + 1)) * maxZ;
    world.spawn(
      Position2({ x: normalizedRandX, z: normalizedRandZ }),
      IsObstacle(),
      IsLandscape({ type: "tree" })
    );
  }
}
