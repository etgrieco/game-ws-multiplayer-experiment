import { Canvas, useFrame } from "@react-three/fiber";
import { OfPlayer, Position2 } from "@shared/ecs/trait";
import { useQuery, useWorld } from "koota/react";
import React, { useRef } from "react";
// biome-ignore lint/style/useImportType: Let this change over time...
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";

export function Game() {
  return (
    <div className="w-[1024px] h-[768px]">
      <Canvas>
        <GameContents />
      </Canvas>
    </div>
  );
}

const lerpFactor = 0.1;
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function GamePlayer(props: { playerId: string; color: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const world = useWorld();

  useFrame((_s, d) => {
    const myPlayer = world
      .query(Position2, OfPlayer)
      .find((p) => p.get(OfPlayer)!.playerId === props.playerId);
    if (!myPlayer) {
      console.error("Can't find player entity for component. huh?");
      return;
    }
    const myPlayerPos = myPlayer.get(Position2)!;

    meshRef.current.position.x = lerp(
      meshRef.current.position.x,
      myPlayerPos.x,
      lerpFactor
    );

    meshRef.current.position.y = lerp(
      meshRef.current.position.y,
      myPlayerPos.y,
      lerpFactor
    );

    meshRef.current.rotation.x += d;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={props.color} />
    </mesh>
  );
}

const playerColors = [0x00ff00, 0xff0000];

function GameContents() {
  const players = useQuery(Position2, OfPlayer);

  return (
    <>
      <OrbitControls />
      <directionalLight position={[1, 1, 1]} />
      {players.map((p, idx) => {
        return (
          <GamePlayer
            key={p.get(OfPlayer)!.playerId}
            color={playerColors[idx % playerColors.length]!}
            playerId={p.get(OfPlayer)!.playerId}
          />
        );
      })}
    </>
  );
}
