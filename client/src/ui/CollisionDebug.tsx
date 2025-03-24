import React from "react";
import * as THREE from "three";
import { Collision2, Position2 } from "@shared/ecs/trait";
import { useQuery } from "koota/react";
import { useControls } from "leva";

const boxHelperMaterial = new THREE.MeshStandardMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.5,
});
const boxGeometry = new THREE.BoxGeometry(1, 1, 1); // a 'unit' box (all 1 dimensions)
/** Adds a visible bounding box helper around all collidables */
export function CollisionDebug() {
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
