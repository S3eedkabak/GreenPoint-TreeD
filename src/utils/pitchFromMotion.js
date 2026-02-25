/**
 * Simple pitch (elevation angle) from gravity only.
 * 0° = horizontal, + = aim up, - = aim down.
 * Tap "Calibrate" when phone is level to set 0°.
 */

import { DeviceMotion, Accelerometer } from 'expo-sensors';

const DEFAULT_INTERVAL_MS = 50;

let subscription = null;
let lastPitchDeg = 0;
let calibrationOffsetDeg = 0;

/** Portrait: Z = out of screen. Tilt around X gives pitch = asin(Z/g). */
function pitchFromGravity(x, y, z) {
  const norm = Math.sqrt(x * x + y * y + z * z) || 1;
  const zClamped = Math.max(-1, Math.min(1, z / norm));
  return (Math.asin(zClamped) * 180) / Math.PI;
}

export function startPitchUpdates(callback, options = {}) {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  function onUpdate(acc) {
    if (!acc || typeof acc.x !== 'number') return;
    lastPitchDeg = Math.max(-89, Math.min(89, pitchFromGravity(acc.x, acc.y, acc.z)));
    callback(lastPitchDeg - calibrationOffsetDeg);
  }

  try {
    DeviceMotion.setUpdateInterval(intervalMs);
    subscription = DeviceMotion.addListener((data) => {
      const acc = data.accelerationIncludingGravity;
      if (acc) onUpdate(acc);
    });
  } catch (e) {
    Accelerometer.setUpdateInterval(intervalMs);
    subscription = Accelerometer.addListener(({ x, y, z }) => onUpdate({ x, y, z }));
  }

  return () => {
    if (subscription) {
      subscription.remove();
      subscription = null;
    }
  };
}

export function setCalibrationOffset() {
  calibrationOffsetDeg = lastPitchDeg;
}

export function getLastPitchDegrees() {
  return lastPitchDeg - calibrationOffsetDeg;
}
