import { Canvas, useFrame } from "@react-three/fiber";
import { IsLandscape, OfPlayer, Position2 } from "@shared/ecs/trait";
import { useQuery, useWorld } from "koota/react";
import React, { useRef } from "react";
// biome-ignore lint/style/useImportType: Let this change over time...
import * as THREE from "three";
import { OrthographicCamera, Stats } from "@react-three/drei";
import { useControls } from "leva";
import { levelConfig } from "@config/levelConfig";

export function Game() {
  return (
    <div className="w-[640px] h-[480px] border-2 border-solid rounded-sm">
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

  useFrame((_s) => {
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

    meshRef.current.position.z = lerp(
      meshRef.current.position.z,
      myPlayerPos.z,
      lerpFactor
    );
  });

  return (
    <mesh ref={meshRef} position={[0, 0.25, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color={props.color} />
    </mesh>
  );
}

const TERRAIN_ROTATION = [-Math.PI / 2, 0, 0] as const;
function Terrain() {
  return (
    <mesh rotation={TERRAIN_ROTATION}>
      <meshStandardMaterial color={levelConfig.terrain.color} />
      <planeGeometry
        args={[levelConfig.terrain.maxX, levelConfig.terrain.maxZ]}
      />
    </mesh>
  );
}

function TerrainTrees() {
  const landscape = useQuery(Position2, IsLandscape);
  const trees = landscape.filter((l) => l.get(IsLandscape)!.type === "tree");

  return trees.map((t) => {
    const treePos = t.get(Position2)!;
    return <Tree key={t.id()} posX={treePos.x} posZ={treePos.z} />;
  });
}

function Tree(props: { posX: number; posZ: number }) {
  return (
    <mesh position={[props.posX, 0.5, props.posZ]}>
      <coneGeometry args={[0.2, 1, 8]} />
      <meshStandardMaterial color={0x305010} flatShading />
    </mesh>
  );
}

function DebugPoint(props: {
  posX: number;
  posZ: number;
  color?: string | number;
}) {
  const { debugMode } = useControls({ debugMode: true });
  if (!debugMode) {
    return null;
  }
  return (
    <mesh position={[props.posX, 0.5, props.posZ]}>
      <cylinderGeometry args={[0.1, 0.1, 1]} />
      <meshStandardMaterial color={props.color ?? 0xff0000} transparent />
    </mesh>
  );
}

const playerColors = [0x00ff00, 0xff0000];

function GameContents() {
  const players = useQuery(Position2, OfPlayer);

  const { zoom } = useControls("Camera", {
    zoom: 40,
  });

  return (
    <>
      <Stats />
      <OrthographicCamera
        makeDefault
        position={[0, 0, 0]}
        near={-20 * zoom}
        far={2000}
        zoom={zoom}
      >
        <directionalLight position={[1, 1, 1]} />
        <ambientLight intensity={0.8} />
        <scene rotation={[Math.atan(1 / Math.sqrt(2)), Math.PI / 4, 0]}>
          {players.map((p, idx) => {
            return (
              <GamePlayer
                key={p.get(OfPlayer)!.playerId}
                color={playerColors[idx % playerColors.length]!}
                playerId={p.get(OfPlayer)!.playerId}
              />
            );
          })}
          {/* Group for relative to corner */}
          <group position={[-5, 0, -5]}>
            <DebugPoint posX={0} posZ={0} color={"hotpink"} />
            <DebugPoint posX={0} posZ={10} color={"hotpink"} />
            <DebugPoint posX={10} posZ={0} color={"hotpink"} />
            <DebugPoint posX={10} posZ={10} color={"hotpink"} />
            <DebugPoint posX={5} posZ={5} color={"hotpink"} />
            <TerrainTrees />
          </group>
          <Terrain />
        </scene>
      </OrthographicCamera>
    </>
  );
}
