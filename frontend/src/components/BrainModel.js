import React from 'react';
import { useGLTF } from "@react-three/drei";

export default function BrainModel({ sensors = [] }) {
  const { scene } = useGLTF("/models/brain.glb");

  return (
    // We manually push the entire group down by 28 units to center it perfectly on the screen
    <group position={[0, -28, 0]}>
      
      {/* 1. THE BRAIN (Locked in the group) */}
      <primitive 
        object={scene} 
        scale={50} 
        dispose={null} 
      />

      {/* 2. THE SENSORS (Locked in the exact same group) */}
      {sensors.map((sensor, index) => (
        <mesh key={index} position={sensor.position}>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshStandardMaterial 
            color={sensor.color} 
            emissive={sensor.color}
            emissiveIntensity={2} 
            // depthTest={false} is REMOVED so they don't shine through the brain anymore!
          />
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload("/models/brain.glb");

// import React from 'react';
// import { useGLTF, Center } from "@react-three/drei";

// export default function BrainModel({ sensors = [] }) {
//   const { scene } = useGLTF("/models/brain.glb");

//   return (
//     <group position={[0, -1, 0]}> {/* Lowers everything slightly so it fits in the box */}
      
//       {/* 1. THE BRAIN (Forced to center [0,0,0]) */}
//       <Center>
//         <primitive 
//           object={scene} 
//           scale={50} 
//           dispose={null} 
//         />
//       </Center>

//       {/* 2. THE SENSORS */}
//       {sensors.map((sensor, index) => (
//         <mesh key={index} position={sensor.position}>
//           <sphereGeometry args={[0.4, 32, 32]} />
//           <meshStandardMaterial 
//             color={sensor.color} 
//             emissive={sensor.color}
//             emissiveIntensity={2} 
//             depthTest={false}  // Forces it to render on top of the brain
//             transparent={true} 
//           />
//         </mesh>
//       ))}
//     </group>
//   );
// }

// useGLTF.preload("/models/brain.glb");

// import React from 'react';
// import { useGLTF, Center } from "@react-three/drei";

// export default function BrainModel({ sensors = [] }) {
//   const { scene } = useGLTF("/models/brain.glb");

//   return (
//     <Center>
//       <primitive 
//         object={scene} 
//         scale={50} 
//         dispose={null} 
//       />

//       {sensors.map((sensor, index) => (
//         <mesh key={index} position={sensor.position}>
//           {/* Make the glowing dots slightly larger (0.4) so they are easy to see */}
//           <sphereGeometry args={[0.4, 32, 32]} />
//           <meshStandardMaterial 
//             color={sensor.color} 
//             emissive={sensor.color}
//             emissiveIntensity={2} 
//           />
//         </mesh>
//       ))}
//     </Center>
//   );
// }

// useGLTF.preload("/models/brain.glb");

// import React from 'react';
// import { useGLTF, Center } from "@react-three/drei";

// export default function BrainModel({ sensors = [] }) {
//   const { scene } = useGLTF("/models/brain.glb");

//   // CLICK TRACKER: To find where to put the sensors
//   const handleBrainClick = (event) => {
//     event.stopPropagation(); 
//     const { x, y, z } = event.point;
//     const coordString = `[${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`;
//     console.log("📍 NEW SENSOR POSITION:", coordString);
//     alert(`Copy this into eegData.js: ${coordString}\n(Also printed in F12 Console)`);
//   };

//   return (
//     <Center>
//       <primitive 
//         object={scene} 
//         scale={50} 
//         dispose={null} 
//       />

//       {/* SENSORS */}
//       {sensors.map((sensor, index) => (
//         <mesh key={index} position={sensor.position}>
//           <sphereGeometry args={[0.3, 32, 32]} />
//           <meshStandardMaterial 
//             color={sensor.color} 
//             emissive={sensor.color}
//             emissiveIntensity={2} 
//           />
//         </mesh>
//       ))}
//     </Center>
//   );
// }

useGLTF.preload("/models/brain.glb");

// import React from 'react';
// import { useGLTF, Center } from "@react-three/drei";

// export default function BrainModel({ sensors = [] }) {
//   const { scene } = useGLTF("/models/brain.glb");

//   const handleBrainClick = (event) => {
//     event.stopPropagation(); 
//     const { x, y, z } = event.point;
//     const coordString = `[${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`;
//     console.log("📍 NEW SENSOR POSITION:", coordString);
//     alert(`Copy this into eegData.js: ${coordString}`);
//   };

//   return (
//     <Center top>
//       <primitive 
//         object={scene} 
//         scale={50} 
//         onClick={handleBrainClick} 
//         dispose={null} 
//       />

//       {sensors.map((sensor, index) => (
//         <mesh key={index} position={sensor.position}>
//           <sphereGeometry args={[0.3, 32, 32]} />
//           <meshStandardMaterial 
//             color={sensor.color} 
//             emissive={sensor.color}
//             emissiveIntensity={2} 
//           />
//         </mesh>
//       ))}
//     </Center>
//   );
// }

// useGLTF.preload("/models/brain.glb");

// import React from 'react';
// import { useGLTF, Center } from "@react-three/drei";

// export default function BrainModel({ sensors = [] }) {
//   const { scene } = useGLTF("/models/brain.glb");

//   // THE MAGIC TRICK: Click the brain to get the exact coordinates!
//   const handleBrainClick = (event) => {
//     event.stopPropagation(); // Prevents clicking through the model
    
//     // Get the exact X, Y, Z point where your mouse touched the 3D mesh
//     const { x, y, z } = event.point;
    
//     // Format the numbers to 2 decimal places
//     const coordString = `[${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`;
    
//     console.log("📍 NEW SENSOR POSITION:", coordString);
//     alert(`Coordinate found: ${coordString}\nPress F12 to see it in the console!`);
//   };

//   return (
//     <Center top>
//       {/* YOUR BRAIN MODEL */}
//       <primitive 
//         object={scene} 
//         scale={1.5} // Step 1: Adjust this number until the brain is the size you want
//         onClick={handleBrainClick} // Attaches our click tracker
//         dispose={null} 
//       />

//       {/* THE SENSORS */}
//       {sensors.map((sensor, index) => (
//         <mesh key={index} position={sensor.position}>
//           <sphereGeometry args={[0.2, 32, 32]} />
//           <meshStandardMaterial 
//             color={sensor.color} 
//             emissive={sensor.color}
//             emissiveIntensity={2} 
//           />
//         </mesh>
//       ))}
//     </Center>
//   );
// }

// useGLTF.preload("/models/brain.glb");

// import React from 'react';
// import { useGLTF, Center } from "@react-three/drei";

// export default function BrainModel({ sensors = [] }) {
//   // Load the actual 3D model from the public/models folder
//   const { scene } = useGLTF("/models/brain.glb");

//   return (
//     <Center top>
//       {/* THE ACTUAL BRAIN MODEL */}
//       <primitive 
//         object={scene} 
//         scale={2.0} // <--- IMPORTANT: Change this number if the brain is too tiny or too huge!
//         dispose={null} 
//       />

//       {/* THE GLOWING SENSORS RIDING ON TOP OF THE BRAIN */}
//       {sensors.map((sensor, index) => (
//         <mesh key={index} position={sensor.position}>
//           <sphereGeometry args={[0.3, 32, 32]} />
//           <meshStandardMaterial 
//             color={sensor.color} 
//             emissive={sensor.color}
//             emissiveIntensity={2} 
//           />
//         </mesh>
//       ))}
//     </Center>
//   );
// }

// // Preload the model so it loads faster
// useGLTF.preload("/models/brain.glb");

// import React from 'react';
// import { Center } from "@react-three/drei";

// export default function BrainModel({ sensors = [] }) {
//   return (
//     <Center top>
      
//       {/* FALLBACK SHAPE: A semi-transparent "Glass Head" */}
//       <mesh position={[0, 1.5, 0]}>
//         <sphereGeometry args={[3.8, 32, 32]} />
//         <meshPhysicalMaterial 
//           color="#1f2937" 
//           transparent={true} 
//           opacity={0.3} 
//           roughness={0.1}
//           transmission={0.9} // Gives it a cool glass/hologram look
//           wireframe={true}   // Makes it look like a tech/grid mesh
//         />
//       </mesh>

//       {/* THE SENSORS */}
//       {sensors.map((sensor, index) => (
//         <mesh key={index} position={sensor.position}>
//           <sphereGeometry args={[0.3, 32, 32]} />
//           <meshStandardMaterial 
//             color={sensor.color} 
//             emissive={sensor.color}
//             emissiveIntensity={2} 
//           />
//         </mesh>
//       ))}

//     </Center>
//   );
// }

// // File: src/components/BrainModel.js
// import React from 'react';
// import { useGLTF, Center } from "@react-three/drei";

// export default function BrainModel({ sensors = [] }) {
//   // Load the model from the public folder
//   const { scene } = useGLTF("/models/brain.glb");

//   return (
//     // <Center> automatically handles the math to put the brain at [0,0,0]
//     <Center top>
//       <primitive 
//         object={scene} 
//         scale={0.05} // Adjust this if the brain is too big/small
//         dispose={null} 
//       />

//       {/* Map through the sensor data and draw a glowing sphere for each */}
//       {sensors.map((sensor, index) => (
//         <mesh key={index} position={sensor.position}>
//           <sphereGeometry args={[0.2, 32, 32]} />
//           <meshStandardMaterial 
//             color={sensor.color} 
//             emissive={sensor.color}
//             emissiveIntensity={2} // Makes it glow
//           />
//         </mesh>
//       ))}
//     </Center>
//   );
// }

