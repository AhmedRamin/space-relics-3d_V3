import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Flies the camera to a subject.
 *
 * Deliberately independent of OrbitControls' readiness: a fresh PerspectiveCamera looks
 * down -Z, so the subject ends up below the frame if nothing aims it. This rig aims the
 * camera itself, then runs a time-based flight (not a per-frame lerp) so it still arrives
 * on a slow GPU. It yields immediately when the visitor grabs the controls.
 */
export function CameraRig({ target = [0, 0, 0], distance = 20, trigger = 'default', offsetRatio = 0.45, disabled = false }) {
  const { camera, controls, gl } = useThree();
  const targetVec = useMemo(() => new THREE.Vector3(target[0], target[1], target[2]), [target[0], target[1], target[2]]);
  const flight = useRef(null);
  const aimUntil = useRef(0);

  const desired = useMemo(() => {
    const dir = targetVec.lengthSq() > 0.001 ? targetVec.clone().normalize() : new THREE.Vector3(0, 0.2, 1);
    return new THREE.Vector3()
      .copy(targetVec)
      .add(dir.multiplyScalar(distance * offsetRatio))
      .add(new THREE.Vector3(0, distance * 0.42, distance * 0.72));
  }, [targetVec, distance, offsetRatio]);

  // Aim on mount and whenever the subject changes.
  useEffect(() => {
    aimUntil.current = performance.now() + 2400;
    camera.lookAt(targetVec);
    if (controls) {
      controls.target.copy(targetVec);
      controls.update();
    }
    if (disabled) {
      flight.current = null;
      return;
    }
    flight.current = {
      from: camera.position.clone(),
      fromTarget: (controls ? controls.target : targetVec).clone(),
      to: desired.clone(),
      start: performance.now(),
      duration: 1000,
    };
  }, [camera, controls, targetVec, desired, trigger, disabled]);

  // Yielding to the visitor must work even before OrbitControls registers itself.
  useEffect(() => {
    const element = gl && gl.domElement;
    if (!element) return undefined;
    const stop = () => {
      flight.current = null;
      aimUntil.current = 0;
    };
    element.addEventListener('pointerdown', stop);
    element.addEventListener('wheel', stop, { passive: true });
    return () => {
      element.removeEventListener('pointerdown', stop);
      element.removeEventListener('wheel', stop);
    };
  }, [gl]);

  useFrame(() => {
    const current = flight.current;
    if (!current) {
      if (performance.now() < aimUntil.current) camera.lookAt(targetVec);
      return;
    }

    const t = Math.min(1, (performance.now() - current.start) / current.duration);
    const ease = 1 - (1 - t) ** 3;
    camera.position.lerpVectors(current.from, current.to, ease);
    camera.lookAt(targetVec);

    if (controls) {
      controls.target.lerpVectors(current.fromTarget, targetVec, ease);
      controls.update();
    }

    if (t >= 1) {
      flight.current = null;
      aimUntil.current = performance.now() + 400;
    }
  });

  return null;
}
