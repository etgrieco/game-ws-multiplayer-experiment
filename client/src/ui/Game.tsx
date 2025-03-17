import { Canvas, useFrame } from "@react-three/fiber";
import React, { useRef } from "react";
import * as THREE from "three";
import { useWorld } from "koota/react";
import { OfPlayer, Position2 } from "@shared/ecs/trait";
import { useGameStore } from "@/game/game";

function GameUI() {
  return <div className="w-full max-w-[1024px] max-h-[768px] h-full"></div>;
}

export function Game() {
  return (
    <div className="flex flex-col w-full max-w-[1024px]">
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

const lerpFactor = 0.1;
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function GameContents() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const meshRefTwo = useRef<THREE.Mesh>(null!);
  const world = useWorld();
  const gameStatus = useGameStore((s) => s.game?.status);

  const memoizedQuery = React.useMemo(() => {
    return world.query(Position2, OfPlayer);
  }, [gameStatus]);

  useFrame((_s, _d) => {
    const playerOnePos = memoizedQuery
      .find((e) => e.get(OfPlayer)!.playerNumber === 1)!
      .get(Position2)!;
    const playerTwoPos = memoizedQuery
      .find((e) => e.get(OfPlayer)!.playerNumber === 2)!
      .get(Position2)!;

    meshRef.current.position.x = lerp(
      meshRef.current.position.x,
      playerOnePos.x,
      lerpFactor,
    );

    meshRef.current.position.y = lerp(
      meshRef.current.position.y,
      playerOnePos.y,
      lerpFactor,
    );

    meshRefTwo.current.position.x = lerp(
      meshRefTwo.current.position.x,
      playerTwoPos.x,
      lerpFactor,
    );
    meshRefTwo.current.position.y = lerp(
      meshRefTwo.current.position.y,
      playerTwoPos.y,
      lerpFactor,
    );
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
