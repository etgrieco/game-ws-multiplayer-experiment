import { Canvas, useFrame } from "@react-three/fiber";
import React, { useRef } from "react";
import * as THREE from "three";
import { useGameSessionStore } from "../net/gameSession";

const useGame = () => {
  const game = useGameSessionStore((s) => s.game);
  if (!game) {
    throw new Error("The game is not yet initialized");
  }
  return game;
};
function GameUI() {
  const game = useGame();
  const sendEvent = useGameSessionStore((s) => s.sendEvent);

  return (
    <div className="w-full max-w-[1024px] max-h-[768px] h-full absolute">
      <div className="text-2xl">GAME ID: {game.gameData.id}</div>
      <button
        onClick={() => {
          sendEvent({
            type: "START_SESSION_GAME",
            data: { id: game.gameData.id },
          });
        }}
      >
        Start game
      </button>
    </div>
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

  useFrame((_s, delta) => {
    meshRef.current.rotation.x += delta;
    meshRefTwo.current.rotation.x += delta;
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
