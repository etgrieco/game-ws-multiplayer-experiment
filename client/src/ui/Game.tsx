import { Canvas, useFrame } from "@react-three/fiber";
import { Collision2, Landscape, OfPlayer, Position2 } from "@shared/ecs/trait";
import { useQuery, useWorld } from "koota/react";
import React from "react";
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
  const meshRef = React.useRef<THREE.Mesh>(null!);
  const world = useWorld();

  // naive client-side check for collisions with any collidable object

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
  const treeDefs = React.useMemo(() => {
    const trees = landscape.filter((l) => l.get(Landscape)!.type === "tree");
    return trees.map((t) => {
      const pos = t.get(Position2)!;
      return {
        id: t.id(),
        x: pos.x,
        z: pos.z,
      };
    }) satisfies TreeDefs;
  }, [landscape]);

  return <TreeInstances treeDefs={treeDefs} />;
}

const boxHelperMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
const boxGeometry = new THREE.BoxGeometry(1, 1, 1); // a 'unit' box (all 1 dimensions)
/** Adds a visible bounding box helper around all collidables */
function HandleCollission2DebugInstancedStrategy() {
  const instancedMeshRef = React.useRef<THREE.InstancedMesh>(null!);

  const { collisionDebug } = useControls({ collisionDebug: false });
  const collidables = useQuery(Position2, Collision2);

  React.useEffect(() => {
    // existence of the instancedRef implicitly depends upon whether collisionDebug is enabled
    if (!collisionDebug) return;

    const tempMatrix = new THREE.Matrix4();
    for (let i = 0; i < collidables.length; i++) {
      const e = collidables[i]!;
      const collision = e.get(Collision2)!;
      const position = e.get(Position2)!;
      tempMatrix.identity();
      tempMatrix.compose(
        new THREE.Vector3(position.x, 0, position.z),
        new THREE.Quaternion(),
        new THREE.Vector3(collision.width, 1, collision.depth)
      );
      instancedMeshRef.current.setMatrixAt(i, tempMatrix);
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [collidables, collisionDebug]);

  if (!collisionDebug) return null;

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[boxGeometry, boxHelperMaterial, collidables.length]}
    />
  );
}

const treeGeometry = new THREE.ConeGeometry(0.2, 1, 8);
const treeMaterial = new THREE.MeshStandardMaterial({
  color: 0x305010,
  flatShading: true,
});
type TreeDefs = { id: string | number; x: number; z: number }[];
function TreeInstances({ treeDefs }: { treeDefs: TreeDefs }) {
  const instancedMeshRef = React.useRef<THREE.InstancedMesh>(null!);
  React.useEffect(() => {
    const tempMatrix = new THREE.Matrix4();
    for (let i = 0; i < treeDefs.length; i++) {
      tempMatrix.compose(
        new THREE.Vector3(treeDefs[i]!.x, 0, treeDefs[i]!.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1)
      );
      instancedMeshRef.current.setMatrixAt(i, tempMatrix);
    }
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [treeDefs]);

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[treeGeometry, treeMaterial, treeDefs.length]}
    />
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
      {/* Offset y height by size */}
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
      </group>
      {/* Group for relative to corner */}
      <group position={[-50, 0.5, -50]}>
        {/* <HandleCollission2Debug /> */}
        <HandleCollission2DebugInstancedStrategy />
        <TerrainTrees />
      </group>
      <Terrain />
    </>
  );
}
