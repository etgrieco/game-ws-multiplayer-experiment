import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Player, Position2 } from "game-shared/ecs/trait";
import { useQuery } from "koota/react";
import { useControls } from "leva";
import * as React from "react";
import * as THREE from "three";

const CAMERA_LERP_FACTOR = 0.01;
export function GameCamera() {
  const players = useQuery(Position2, Player);

  const { zoom, orbitControls } = useControls("Camera", {
    zoom: 40,
    orbitControls: false,
  });
  const cameraRef = React.useRef<THREE.OrthographicCamera>(null!);
  const isCameraMoving = React.useRef(false);

  useFrame(() => {
    if (!cameraRef.current) return;
    const playerPosData = players
      .find((p) => p.get(Player)?.isMe)
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
    </>
  );
}
