import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OfPlayer, Position2 } from "@shared/ecs/trait";
import { useQuery } from "koota/react";
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

function GamePlayer(props: { posX: number; posY: number; color: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((_s, d) => {
    meshRef.current.position.x = lerp(
      meshRef.current.position.x,
      props.posX,
      lerpFactor
    );

    meshRef.current.position.y = lerp(
      meshRef.current.position.y,
      props.posY,
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

function GameContents() {
  const query = useQuery(Position2, OfPlayer);

  const playerOnePos = query
    .find((e) => e.get(OfPlayer)!.playerNumber === 1)
    ?.get(Position2);

  const playerTwoPos = query
    .find((e) => e.get(OfPlayer)!.playerNumber === 2)
    ?.get(Position2);

  return (
    <>
      <OrbitControls />
      <directionalLight position={[1, 1, 1]} />
      {playerOnePos ? (
        <GamePlayer
          posX={playerOnePos.x}
          posY={playerOnePos.y}
          color={0xff0000}
        />
      ) : null}
      {playerTwoPos ? (
        <GamePlayer
          posX={playerTwoPos.x}
          posY={playerTwoPos.y}
          color={0x00ff00}
        />
      ) : null}
    </>
  );
}
