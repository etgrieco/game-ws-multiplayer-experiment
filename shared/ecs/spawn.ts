import type { World } from "koota";
import { Landscape, OfPlayer, Position2, Velocity2, Collision2 } from "./trait";

export const spawnPlayer = (
  world: World,
  props: {
    pos: { x: number; z: number };
    player: { playerId: string; playerNumber: number; isMe?: boolean };
  }
) => {
  world.spawn(Position2(props.pos), Velocity2(), OfPlayer(props.player));
};

export function spawnTree(world: World, props: { x: number; z: number }) {
  world.spawn(
    Position2({ x: props.x, z: props.z }),
    Landscape({ type: "tree" }),
    // hard-coded width/depth for all trees
    Collision2({ width: 0.4, depth: 0.4 })
  );
}

export function spawnRandomGameLandscapeTreeObstacles(
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
    spawnTree(world, {
      x: normalizedRandX,
      z: normalizedRandZ,
    });
  }
}
