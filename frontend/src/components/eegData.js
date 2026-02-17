// File: src/components/eegData.js

export const SENSOR_DATA = [
  // T7 (Left Temporal) - Far left side
  { name: "T7", position: [-27.0, 24.0, 0.0], color: "#2a00c2" },   
  
  // F8 (Right Frontal) - Front right forehead
  { name: "F8", position: [21.0, 20.0, 13.0], color: "#00670a" }, 
  
  // Cz (Vertex) - The very top of the head
  { name: "Cz", position: [0.0, 56.5, 0.0], color: "#8f0505" },    
  
  // P4 (Right Parietal) - Back right side
  { name: "P4", position: [16.0, 44.0, -20.0], color: "#ff0000" } 
];

// export const SENSOR_DATA = [
//   // T7: Pushed way out to the far Left edge
//   { name: "T7", position: [-27.0, -2.0, 0.0], color: "#3b82f6" },   
  
//   // F8: Pushed to the Right and Front forehead
//   { name: "F8", position: [21.0, -5.0, 26.0], color: "#10b981" }, 
  
//   // Cz: Pushed all the way to the Top of the skull
//   { name: "Cz", position: [0.0, 28.5, 0.0], color: "#ef4444" },    
  
//   // P4: Pushed to the Right, Top, and Back
//   { name: "P4", position: [16.0, 16.0, -20.0], color: "#ef4444" } 
// ];

// export const SENSOR_DATA = [
//   // T7 (Left Temporal) - Far left side
//   { name: "T7", position: [-3.8, 0.0, 0.0], color: "#3b82f6" },   
  
//   // F8 (Right Frontal) - Front right forehead
//   { name: "F8", position: [2.8, -0.5, 2.2], color: "#10b981" }, 
  
//   // Cz (Vertex) - Top center of the head
//   { name: "Cz", position: [0.0, 2.4, 0.0], color: "#ef4444" },    
  
//   // P4 (Right Parietal) - Back right side
//   { name: "P4", position: [2.0, 1.0, -2.0], color: "#ef4444" } 
// ];

// export const SENSOR_DATA = [
//   // THE ACTIVE CHANNELS (Clean)
//   { name: "T7", position: [-3.5, 0, 0], color: "#3b82f6" },   // Left Temporal (Blue)
//   { name: "F8", position: [2.5, 1.0, 2.5], color: "#10b981" }, // Right Frontal (Green)

//   // THE REJECTED CHANNELS (High Impedance / Hair Noise)
//   { name: "Cz", position: [0, 3.5, 0], color: "#ef4444" },    // Top Center (Red)
//   { name: "P4", position: [1.5, 1.5, -2.5], color: "#ef4444" } // Back Right (Red)
// ];