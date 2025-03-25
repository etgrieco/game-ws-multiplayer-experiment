import { Stats } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { DamageZone, IsEnemy, Landscape, Player } from "@shared/ecs/trait";
import React from "react";
import { BadGuys } from "./BadGuys";
import { CollisionDebug } from "./CollisionDebug";
import { GameCamera } from "./GameCamera";
import { GamePlayers } from "./GamePlayers";
import { Terrain } from "./Terrain";
import { TerrainTrees } from "./TerrainTrees";

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
      {/* Group for relative to corner */}
      <group position={[-50, 0.5, -50]}>
        <GameCamera />
        <CollisionDebug traitFilters={[Landscape]} />
        <TerrainTrees />
        <BadGuys />
        <CollisionDebug traitFilters={[IsEnemy]} trackMovement />
        {/* Offset y height by size */}
        <group position={[0, -0.25, 0]}>
          <CollisionDebug traitFilters={[Player]} trackMovement />
          <GamePlayers />
          <CollisionDebug traitFilters={[DamageZone]} trackMovement />
        </group>
      </group>
      <Terrain />
    </>
  );
}
