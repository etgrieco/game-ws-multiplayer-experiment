import React from "react";
import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { Terrain } from "./Terrain";
import { TerrainTrees } from "./TerrainTrees";
import { GamePlayers } from "./GamePlayers";
import { GameCamera } from "./GameCamera";
import { CollisionDebug } from "./CollisionDebug";

export function Game() {
  return (
    <div className="w-[640px] h-[480px] border-2 border-solid rounded-sm">
      <Canvas>
        <GameContents />
      </Canvas>
    </div>
  );
}

function GameContents() {
  return (
    <>
      <Stats />
      <directionalLight position={[1, 3, 1]} />
      <ambientLight intensity={0.8} />
      <GameCamera />
      {/* Offset y height by size */}
      <group position={[0, 0.25, 0]}>
        <GamePlayers />
      </group>
      {/* Group for relative to corner */}
      <group position={[-50, 0.5, -50]}>
        <CollisionDebug />
        <TerrainTrees />
      </group>
      <Terrain />
    </>
  );
}
