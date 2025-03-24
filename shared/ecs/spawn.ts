import type { World } from "koota";
import {
  Landscape,
  Player,
  Position2,
  Velocity2,
  Collision2,
  IsEnemy,
} from "./trait";

export const spawnPlayer = (
  world: World,
  props: {
    pos: { x: number; z: number };
    player: { playerId: string; playerNumber: number; isMe?: boolean };
  }
) => {
  world.spawn(
    Position2(props.pos),
    Velocity2(),
    Player(props.player),
    // hard-coded width/depth for all players
    Collision2({ depth: 0.5, width: 0.5 })
  );
};

export function spawnTree(world: World, props: { x: number; z: number }) {
  world.spawn(
    Position2({ x: props.x, z: props.z }),
    Landscape({ type: "tree" }),
    // hard-coded width/depth for all trees
    Collision2({ width: 0.4, depth: 0.4 })
  );
}

export function spawnBadGuy(world: World, props: { x: number; z: number }) {
  world.spawn(
    Position2({ x: props.x, z: props.z }),
    IsEnemy(),
    // hard-coded width/depth for all bad guys
    Collision2({ width: 0.85, depth: 0.85 })
  );
}

export function spawnRandomGameLandscapeTreeObstacles(
  world: World,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  numberOfEntities: number
) {
  const arrX = new Uint32Array(numberOfEntities);
  const arrZ = new Uint32Array(numberOfEntities);
  crypto.getRandomValues(arrX);
  crypto.getRandomValues(arrZ);

  for (let i = 0; i < numberOfEntities; i++) {
    const normalizedRandX =
      (arrX[i]! / (0xffffffff + 1)) * (maxX - minX) + minX;
    const normalizedRandZ =
      (arrZ[i]! / (0xffffffff + 1)) * (maxZ - minZ) + minZ;

    spawnTree(world, {
      x: normalizedRandX,
      z: normalizedRandZ,
    });
  }
}

export function spawnBadGuys(
  world: World,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  numberOfEntities: number
) {
  const arrX = new Uint32Array(numberOfEntities);
  const arrZ = new Uint32Array(numberOfEntities);
  crypto.getRandomValues(arrX);
  crypto.getRandomValues(arrZ);

  for (let i = 0; i < numberOfEntities; i++) {
    const normalizedRandX =
      (arrX[i]! / (0xffffffff + 1)) * (maxX - minX) + minX;
    const normalizedRandZ =
      (arrZ[i]! / (0xffffffff + 1)) * (maxZ - minZ) + minZ;
    spawnBadGuy(world, {
      x: normalizedRandX,
      z: normalizedRandZ,
    });
  }
}
