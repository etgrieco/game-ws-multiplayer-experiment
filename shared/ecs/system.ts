import type { ExtractSchema, World } from "koota";
import {
  Collision2,
  Damage,
  DamageZone,
  Health,
  IsObstacle,
  Player,
  Position2,
  Velocity2,
} from "./trait.js";

export function movePosition2ByVelocitySystem(world: World, deltaTime: number) {
  const movablesQuery = world.query(Position2, Velocity2, Collision2);
  const obstacles = world.query(Position2, IsObstacle, Collision2).map((e) => ({
    id: e.id(),
    pos: e.get(Position2)!,
    col: e.get(Collision2)!,
  }));

  movablesQuery.updateEach(([pos, vel, col]) => {
    const newPosX = pos.x + vel.x * (deltaTime / 1000);
    const newPosZ = pos.z + vel.z * (deltaTime / 1000);

    let isColliding = false;
    for (const { pos: otherEntPos, col: otherEntCol } of obstacles) {
      isColliding = checkAABBCollision(
        { x: newPosX, z: newPosZ },
        otherEntPos,
        col,
        otherEntCol,
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
        "Cannot find existing player for given damage zone. moving on.",
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
      dps: d.get(DamageZone)!.dps,
    }));

  const damageablesQuery = world.query(Damage, Position2, Collision2);
  damageablesQuery.updateEach(([damage, pos, col]) => {
    // Reset per-frame computations back to zero
    damage.dps = 0;
    // Then, accumulate via collisions with zones
    for (const { pos: zonePos, col: zoneCol, dps: zoneDps } of damageZones) {
      const isColliding = checkAABBCollision(pos, zonePos, col, zoneCol);
      if (isColliding) {
        damage.dps += zoneDps;
      }
    }
  });
}

/**
 * Entity requirements -- Position2, Collision2
 */
function checkAABBCollision(
  aPos: ExtractSchema<typeof Position2>,
  bPos: ExtractSchema<typeof Position2>,
  aCol: ExtractSchema<typeof Collision2>,
  bCol: ExtractSchema<typeof Collision2>,
) {
  return (
    aPos.x < bPos.x + bCol.width &&
    aPos.x + aCol.width > bPos.x &&
    aPos.z < bPos.z + bCol.depth &&
    aPos.z + aCol.depth > bPos.z
  );
}

export function takeDamageOverTimeSystem(world: World, deltaTime: number) {
  const damagedHealthEntities = world.query(Health, Damage);
  damagedHealthEntities.updateEach(([health, damage]) => {
    health.hp -= damage.dps * (deltaTime / 1000);
  });
}

export function destroyHealthZeroSystem(world: World) {
  const damagedHealthEntities = world.query(Health, Damage);
  for (const entity of damagedHealthEntities) {
    if (entity.get(Health)!.hp <= 0) {
      entity.destroy();
    }
  }
}
