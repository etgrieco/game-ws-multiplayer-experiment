import React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuery, useWorld } from "koota/react";
import { Player, Position2 } from "@shared/ecs/trait";

const MOVEMENT_LERP_FACTOR = 0.08;
export function GamePlayer(props: { playerId: string; color: number }) {
  const meshRef = React.useRef<THREE.Mesh>(null!);
  const world = useWorld();

  useFrame((_s) => {
    const myPlayer = world
      .query(Position2, Player)
      .find((p) => p.get(Player)!.playerId === props.playerId);
    if (!myPlayer) {
      console.error("Can't find player entity for component. huh?");
      return;
    }
    const myPlayerPos = myPlayer.get(Position2)!;
    meshRef.current.position.lerp(
      new THREE.Vector3(
        myPlayerPos.x,
        meshRef.current.position.y,
        myPlayerPos.z
      ),
      MOVEMENT_LERP_FACTOR
    );
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial flatShading color={props.color} />
    </mesh>
  );
}

const PLAYER_COLORS = [0x00ff00, 0xff0000];
export function GamePlayers() {
  const players = useQuery(Position2, Player);
  return players.map((p, idx) => {
    return (
      <GamePlayer
        key={p.get(Player)!.playerId}
        color={PLAYER_COLORS[idx % PLAYER_COLORS.length]!}
        playerId={p.get(Player)!.playerId}
      />
    );
  });
}
