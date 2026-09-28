import React from 'react';
import { useGLTF } from "@react-three/drei";

export default function BrainModel({ sensors = [] }) {
  const { scene } = useGLTF("/models/brain.glb");

  return (
    <group position={[0, -28, 0]}>
      
      {/* 1. THE BRAIN (Locked in the group) */}
      <primitive 
        object={scene} 
        scale={50} 
        dispose={null} 
      />

      {/* 2. THE SENSORS (Locked in the exact same group) */}
      {sensors.map((sensor) => (
        <mesh key={sensor.name} position={sensor.position}>
          <sphereGeometry args={[1.8, 32, 32]} />
          <meshBasicMaterial color={sensor.color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload("/models/brain.glb");
