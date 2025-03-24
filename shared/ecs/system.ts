import { Not, type World, type ExtractSchema } from "koota";
import { Collision2, Player, Position2, Velocity2 } from "./trait.js";

export function movePosition2ByVelocitySystem(world: World, deltaTime: number) {
  const movablesQuery = world.query(Position2, Velocity2, Collision2);
  const nonPlayerCollidables = world.query(Position2, Collision2, Not(Player));

  movablesQuery.updateEach(([pos, vel, col]) => {
    const newPosX = pos.x + vel.x * (deltaTime / 1000);
    const newPosZ = pos.z + vel.z * (deltaTime / 1000);

    let isColliding = false;
    for (const ent of nonPlayerCollidables) {
      const otherEntPos = ent.get(Position2)!;
      const otherEntCol = ent.get(Collision2)!;
      isColliding = checkAABBCollision(
        { x: newPosX, z: newPosZ },
        otherEntPos,
        col,
        otherEntCol
      );
      if (isColliding) break;
    }

    if (isColliding) {
      return;
    }

    pos.x = newPosX;
    pos.z = newPosZ;
  });
}

/**
 * Entity requirements -- Position2, Collision2
 */
function checkAABBCollision(
  aPos: ExtractSchema<typeof Position2>,
  bPos: ExtractSchema<typeof Position2>,
  aCol: ExtractSchema<typeof Collision2>,
  bCol: ExtractSchema<typeof Collision2>
) {
  return (
    aPos.x < bPos.x + bCol.width &&
    aPos.x + aCol.width > bPos.x &&
    aPos.z < bPos.z + bCol.depth &&
    aPos.z + aCol.depth > bPos.z
  );
}
