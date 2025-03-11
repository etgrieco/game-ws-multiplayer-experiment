import { Canvas, useFrame } from "@react-three/fiber";
import React, { useRef } from "react";
import * as THREE from "three";
import { useWorld } from "koota/react";
import { OfPlayer, Position2 } from "@shared/ecs/trait";

function GameUI() {
  return (
    <div className="w-full max-w-[1024px] max-h-[768px] h-full absolute"></div>
  );
}

export function Game() {
  return (
    <div className="flex flex-col w-full max-w-[1024px] relative">
      <Canvas>
        <ambientLight intensity={Math.PI / 2} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.15}
          penumbra={1}
          decay={0}
          intensity={Math.PI}
        />
        <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
        <GameContents />
      </Canvas>
      <GameUI />
    </div>
  );
}
function GameContents() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const meshRefTwo = useRef<THREE.Mesh>(null!);
  const world = useWorld();

  useFrame((_s, _d) => {
    const playerPosQuery = world.query(Position2, OfPlayer);
    const playerOnePos = playerPosQuery
      .find((e) => e.get(OfPlayer)!.playerNumber === 1)!
      .get(Position2)!;
    const playerTwoPos = playerPosQuery
      .find((e) => e.get(OfPlayer)!.playerNumber === 2)!
      .get(Position2)!;

    meshRef.current.position.x = playerOnePos.x;
    meshRef.current.position.y = playerOnePos.y;

    meshRefTwo.current.position.x = playerTwoPos.x;
    meshRefTwo.current.position.y = playerTwoPos.y;
  });

  return (
    <>
      <mesh ref={meshRef} scale={1}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"orange"} />
      </mesh>
      <mesh ref={meshRefTwo} scale={1}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"green"} />
      </mesh>
    </>
  );
}
