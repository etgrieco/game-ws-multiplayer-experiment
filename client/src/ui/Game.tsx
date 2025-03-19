import { Canvas, useFrame } from "@react-three/fiber";
import { OfPlayer, Position2 } from "@shared/ecs/trait";
import { useQuery, useWorld } from "koota/react";
import React, { useRef } from "react";
// biome-ignore lint/style/useImportType: Let this change over time...
import * as THREE from "three";
import { OrbitControls, Stats } from "@react-three/drei";
import { folder, useControls } from "leva";

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

function Terrain(props: { width: number; height: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color={0x50a000} />
      <planeGeometry args={[props.width, props.height]} />
    </mesh>
  );
}

const trees: { id: string; posX: number; posZ: number }[] = [
  {
    id: window.crypto.randomUUID(),
    posX: 0,
    posZ: 0,
  },
  {
    id: window.crypto.randomUUID(),
    posX: 1,
    posZ: 1,
  },
];

function Tree(props: { posX: number; posZ: number }) {
  return (
    <mesh position={[props.posX, 0.5, props.posZ]}>
      <coneGeometry args={[0.2, 1, 8]} />
      <meshStandardMaterial color={0x305010} flatShading />
    </mesh>
  );
}

const playerColors = [0x00ff00, 0xff0000];

function GameContents() {
  const players = useQuery(Position2, OfPlayer);
  const { width: terrainWidth, height: terrainHeight } = useControls(
    "Terrain",
    { width: 10, height: 10 }
  );

  return (
    <>
      <ControlledOrbitControl />
      <Stats />
      <directionalLight position={[1, 1, 1]} />
      <ambientLight intensity={0.8} />
      <scene>
        {players.map((p, idx) => {
          return (
            <GamePlayer
              key={p.get(OfPlayer)!.playerId}
              color={playerColors[idx % playerColors.length]!}
              playerId={p.get(OfPlayer)!.playerId}
            />
          );
        })}
        <Terrain width={terrainWidth} height={terrainHeight} />
        {trees.map((t) => {
          return <Tree key={t.id} posX={t.posX} posZ={t.posZ} />;
        })}
      </scene>
    </>
  );
}

function ControlledOrbitControl() {
  const [_cameraVals, setCamera] = useControls(() => {
    return {
      Camera: folder({
        posX: 0,
        posY: 0,
        posZ: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
      }),
    };
  });

  return (
    <OrbitControls
      onChange={(self) => {
        const pos = self?.target.object.position;
        const rot = self?.target.object.rotation;
        if (!pos || !rot) return;
        setCamera({
          posX: pos.x,
          posY: pos.y,
          posZ: pos.z,
          rotX: rot.x,
          rotY: rot.y,
          rotZ: rot.z,
        });
      }}
    />
  );
}
