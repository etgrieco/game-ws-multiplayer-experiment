import React from "react";
import * as THREE from "three";
import { Landscape, Position2 } from "@shared/ecs/trait";
import { useQuery } from "koota/react";

export function TerrainTrees() {
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
