import type { World, ExtractSchema } from "koota";
import {
  Collision2,
  Damage,
  DamageZone,
  IsEnemy,
  IsObstacle,
  Player,
  Position2,
  Velocity2,
} from "./trait.js";

export function movePosition2ByVelocitySystem(world: World, deltaTime: number) {
  const movablesQuery = world.query(Position2, Velocity2, Collision2);
  const obstacles = world.query(Position2, Collision2, IsObstacle);

  movablesQuery.updateEach(([pos, vel, col]) => {
    const newPosX = pos.x + vel.x * (deltaTime / 1000);
    const newPosZ = pos.z + vel.z * (deltaTime / 1000);

    let isColliding = false;
    for (const ent of obstacles) {
      const otherEntPos = ent.get(Position2)!;
      const otherEntCol = ent.get(Collision2)!;
      isColliding = checkAABBCollision(
        { x: newPosX, z: newPosZ },
        otherEntPos,
        col,
        otherEntCol
      );
      if (isColliding) {
        break;
      }
    }

    if (isColliding) {
      return;
    }

    pos.x = newPosX;
    pos.z = newPosZ;
  });
}

export function moveDamageZoneFollowPlayer(world: World) {
  const damageZones = world.query(Position2, DamageZone);
  const players = world.query(Position2, Player).map((p) => ({
    playerId: p.get(Player)!.playerId,
    pos: p.get(Position2)!,
  }));

  damageZones.updateEach(([pos, dmg]) => {
    const matchingPlayer = players.find((p) => p.playerId === dmg.playerId);
    if (!matchingPlayer) {
      console.warn(
        "Cannot find existing player for given damage zone. moving on."
      );
      return;
    }
    pos.x = matchingPlayer.pos.x;
    pos.z = matchingPlayer.pos.z;
  });
}

export function triggerDamageBeingDamagedByCollisionWithEnemy(world: World) {
  const damageZones = world
    .query(DamageZone, Position2, Collision2)
    .map((d) => ({
      pos: d.get(Position2)!,
      col: d.get(Collision2)!,
    }));
  const enemiesQuery = world.query(IsEnemy, Position2, Collision2);

  const alreadyDamagedSet = new Set<number>();
  for (const zone of damageZones) {
    enemiesQuery.forEach((e) => {
      const pos = e.get(Position2)!;
      const col = e.get(Collision2)!;
      const isColliding = checkAABBCollision(pos, zone.pos, col, zone.col);
      if (isColliding) {
        e.add(Damage);
        alreadyDamagedSet.add(e);
      } else {
        if (!alreadyDamagedSet.has(e)) {
          e.remove(Damage);
        }
      }
    });
  }
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
