import { Canvas, useFrame } from "@react-three/fiber";
import { Landscape, OfPlayer, Position2 } from "@shared/ecs/trait";
import { useQuery, useWorld } from "koota/react";
import React, { useRef } from "react";
import * as THREE from "three";
import { OrbitControls, OrthographicCamera, Stats } from "@react-three/drei";
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

const MOVEMENT_LERP_FACTOR = 0.08;
const CAMERA_LERP_FACTOR = 0.01;
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
  const landscape = useQuery(Position2, Landscape);
  const trees = landscape.filter((l) => l.get(Landscape)!.type === "tree");

  return trees.map((t) => {
    const treePos = t.get(Position2)!;
    return (
      <mesh position={[treePos.x, 0, treePos.z]} key={t.id()}>
        <coneGeometry args={[0.2, 1, 8]} />
        <meshStandardMaterial color={0x305010} flatShading />
      </mesh>
    );
  });
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

  const { zoom, orbitControls } = useControls("Camera", {
    zoom: 40,
    orbitControls: false,
  });
  const cameraRef = React.useRef<THREE.OrthographicCamera>(null!);
  const isCameraMoving = React.useRef(false);

  useFrame(() => {
    if (!cameraRef.current) return;
    const playerPosData = players
      .find((p) => p.get(OfPlayer)?.isMe)
      ?.get(Position2);
    if (!playerPosData) return;

    const targetPos = new THREE.Vector3(playerPosData.x!, 0, playerPosData.z!);
    if (!isCameraMoving.current) {
      const distance = targetPos.distanceTo(cameraRef.current.position);
      isCameraMoving.current = distance > (5 * 40) / zoom;
    }
    if (isCameraMoving.current) {
      cameraRef.current.position.lerp(targetPos, CAMERA_LERP_FACTOR);
      // re-evaluate whether we should stop moving
      if (targetPos.distanceTo(cameraRef.current.position) < 0.5) {
        isCameraMoving.current = false;
      }
    }
  });

  return (
    <>
      <Stats />
      <directionalLight position={[1, 3, 1]} />
      <ambientLight intensity={0.8} />
      {orbitControls && <OrbitControls makeDefault />}
      {!orbitControls && (
        <OrthographicCamera
          rotation={[-Math.atan(1 / Math.sqrt(2)), Math.PI / 4, 0, "YXZ"]}
          ref={cameraRef}
          makeDefault={!orbitControls}
          near={-20 * zoom}
          far={2000}
          zoom={zoom}
        />
      )}
      {/* Game objects on the proper y-axis */}
      <group position={[0, 0.25, 0]}>
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
        <group position={[-50, 0, -50]}>
          <DebugPoint posX={0} posZ={0} color={"hotpink"} />
          <DebugPoint posX={0} posZ={10} color={"hotpink"} />
          <DebugPoint posX={10} posZ={0} color={"hotpink"} />
          <DebugPoint posX={10} posZ={10} color={"hotpink"} />
          <DebugPoint posX={5} posZ={5} color={"hotpink"} />
          <TerrainTrees />
        </group>
      </group>
      <Terrain />
    </>
  );
}
