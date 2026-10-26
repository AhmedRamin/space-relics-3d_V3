import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Shared react-three-fiber canvas.
 *
 * Tone mapping is set here: ACES Filmic with a deliberate exposure of 1.15, which keeps
 * saturated planet colours from clipping while leaving the corona bright.
 */
export function SceneHost({ children, camera, ...rest }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={camera}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor('#03050d', 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        // A tiny procedural environment (dark space with a warm sun and a cool earthshine)
        // gives the metals something to reflect. Built from a 512×256 equirect canvas and
        // prefiltered once per canvas — the heavyweight RoomEnvironment scene was enough
        // to exhaust a software WebGL context.
        const envCanvas = document.createElement('canvas');
        envCanvas.width = 512;
        envCanvas.height = 256;
        const ctx = envCanvas.getContext('2d');
        const sky = ctx.createLinearGradient(0, 0, 0, 256);
        sky.addColorStop(0, '#050912');
        sky.addColorStop(0.55, '#0a1224');
        sky.addColorStop(1, '#04060d');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 512, 256);
        const sunGlow = ctx.createRadialGradient(150, 90, 2, 150, 90, 110);
        sunGlow.addColorStop(0, 'rgba(255,246,224,1)');
        sunGlow.addColorStop(0.18, 'rgba(255,206,140,0.7)');
        sunGlow.addColorStop(1, 'rgba(255,180,90,0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, 512, 256);
        const earthShine = ctx.createRadialGradient(356, 168, 4, 356, 168, 90);
        earthShine.addColorStop(0, 'rgba(120,176,255,0.55)');
        earthShine.addColorStop(1, 'rgba(80,130,220,0)');
        ctx.fillStyle = earthShine;
        ctx.fillRect(0, 0, 512, 256);
        const envSource = new THREE.CanvasTexture(envCanvas);
        envSource.mapping = THREE.EquirectangularReflectionMapping;
        envSource.colorSpace = THREE.SRGBColorSpace;
        const pmrem = new THREE.PMREMGenerator(gl);
        const env = pmrem.fromEquirectangular(envSource).texture;
        scene.environment = env;
        scene.environmentIntensity = 0.55;
        envSource.dispose();
        pmrem.dispose();
      }}
      {...rest}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
