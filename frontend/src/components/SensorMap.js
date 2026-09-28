import React, { Suspense, useMemo } from 'react';
import { Activity, AlertCircle, Brain, GitCompareArrows, ShieldCheck } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import BrainModel from './BrainModel';
import { getChannelColor, SENSOR_DATA } from './eegData';

const featureChannels = (features = {}) => (
  [...new Set(
    Object.keys(features)
      .filter((key) => key !== 'Alpha_Asymmetry' && key.includes('_'))
      .map((key) => key.substring(0, key.indexOf('_')))
  )]
);

const SensorMap = ({ data }) => {
  const availableChannels = useMemo(() => {
    if (Array.isArray(data?.available_channels) && data.available_channels.length) {
      return data.available_channels;
    }
    return featureChannels(data?.features);
  }, [data]);

  const isClinicalMontage = availableChannels.some((channel) => channel.includes('-'));

  const sensorGroups = useMemo(() => {
    const analyticalNames = ['T7', 'F8', 'F3', 'F4'];
    const monitoringNames = ['Cz', 'P4'];

    return {
      analytical: SENSOR_DATA.filter(
        (sensor) => availableChannels.includes(sensor.name) && analyticalNames.includes(sensor.name)
      ),
      monitoring: SENSOR_DATA.filter(
        (sensor) => availableChannels.includes(sensor.name) && monitoringNames.includes(sensor.name)
      ),
      missing: SENSOR_DATA.filter((sensor) => !availableChannels.includes(sensor.name)),
    };
  }, [availableChannels]);

  if (isClinicalMontage) {
    return (
      <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
          <div>
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2">
              <GitCompareArrows size={20} className="text-primary" /> Clinical EEG montage
            </h5>
            <p className="text-muted small mb-0">Real bipolar derivations detected from the EDF labels.</p>
          </div>
          <span className="badge bg-success-subtle text-success border">
            {availableChannels.length} active
          </span>
        </div>

        <div className="alert alert-light border small">
          A label such as <strong>C4-A1</strong> is the voltage difference between two
          electrodes. It is therefore listed as a derivation and is not drawn as one
          fake dot on the 3D brain.
        </div>

        <div className="d-flex flex-wrap gap-2">
          {availableChannels.map((channel) => (
            <span
              key={channel}
              className="badge px-3 py-2 shadow-sm"
              style={{ backgroundColor: getChannelColor(channel), color: 'white' }}
            >
              {channel}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const allActive = [...sensorGroups.analytical, ...sensorGroups.monitoring];

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
          <Brain size={20} className="text-primary" /> 3D Live Sensor Map
        </h5>
        <span className={`badge border ${allActive.length ? 'bg-success-subtle text-success' : 'bg-light text-muted'}`}>
          {allActive.length} Active
        </span>
      </div>

      <div
        className="d-flex justify-content-center align-items-center rounded-3 mb-4 overflow-hidden shadow-inner"
        style={{ minHeight: '300px', background: '#111827' }}
      >
        <Canvas camera={{ position: [0, 5, 100], fov: 45 }} style={{ height: 300, width: '100%' }}>
          <ambientLight intensity={0.4} />
          <Environment preset="city" />
          <Suspense fallback={null}>
            <BrainModel sensors={allActive} />
          </Suspense>
          <OrbitControls enableZoom enablePan={false} autoRotate autoRotateSpeed={0.5} />
        </Canvas>
      </div>

      <div className="d-flex flex-column gap-3">
        <div>
          <p className="text-muted small mb-2 fw-bold text-uppercase d-flex align-items-center gap-1">
            <Activity size={14} className="text-primary" /> FAA-related channels
          </p>
          <div className="d-flex flex-wrap gap-2">
            {sensorGroups.analytical.map((sensor) => (
              <span key={sensor.name} className="badge shadow-sm px-3 py-2" style={{ backgroundColor: sensor.color }}>
                {sensor.name}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-2 border-top">
          <p className="text-muted small mb-2 fw-bold text-uppercase d-flex align-items-center gap-1">
            <ShieldCheck size={14} className="text-success" /> Active monitoring
          </p>
          <div className="d-flex flex-wrap gap-2">
            {sensorGroups.monitoring.map((sensor) => (
              <span key={sensor.name} className="badge shadow-sm px-3 py-2" style={{ backgroundColor: sensor.color }}>
                {sensor.name}
              </span>
            ))}
          </div>
        </div>

        {sensorGroups.missing.length > 0 && (
          <div className="pt-2 border-top">
            <p className="text-muted small mb-2 fw-bold text-uppercase d-flex align-items-center gap-1 opacity-50">
              <AlertCircle size={14} /> Not present in this file
            </p>
            <div className="d-flex flex-wrap gap-2 opacity-50">
              {sensorGroups.missing.map((sensor) => (
                <span key={sensor.name} className="badge bg-light text-muted border px-2 py-1">
                  {sensor.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorMap;
