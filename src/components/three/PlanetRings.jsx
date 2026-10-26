import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Ring systems with a radial texture.
 *
 * A THREE.RingGeometry has planar UVs, which stretch an equirectangular ring strip into a
 * smear. The UVs are rewritten here so u runs from the inner edge to the outer edge and v
 * stays at the middle of the strip — that is what makes Saturn's Cassini division and
 * Encke gap line up at the right radii.
 */
function makeRingGeometry(inner, outer, segments = 320) {
  const geometry = new THREE.RingGeometry(inner, outer, segments, 4);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const radius = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y);
    const t = Math.min(1, Math.max(0, (radius - inner) / (outer - inner)));
    uv.setXY(i, t, 0.5);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * One lit-looking ring plane. `texture` is the Saturn strip; when it has not loaded yet the
 * flat `color` still reads as a ring.
 */
export function PlanetRings({
  radius,
  inner = 1.35,
  outer = 2.3,
  texture = null,
  color = '#d9c9a3',
  opacity = 0.95,
  tilt = 0.02,
  segments = 320,
}) {
  const geometry = useMemo(
    () => makeRingGeometry(radius * inner, radius * outer, segments),
    [radius, inner, outer, segments]
  );

  return (
    <group rotation={[-Math.PI / 2 + tilt, 0, 0]}>
      <mesh geometry={geometry} renderOrder={2}>
        <meshBasicMaterial
          map={texture}
          color={texture ? '#d8c3a0' : color}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* A soft, untextured halo under the rings gives them thickness from a low angle. */}
      <mesh rotation={[0, 0, 0.001]} renderOrder={1}>
        <ringGeometry args={[radius * inner, radius * outer, segments]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
