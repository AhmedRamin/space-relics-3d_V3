import * as THREE from 'three';

/**
 * The shared planetary surface.
 *
 * Used by both the system view and the body view so a world looks identical at every zoom:
 * photographic map, normal map where NASA published one, a bump map for the procedural
 * worlds, roughness from Earth's specular map (inverted, so water is glossy), and Earth's
 * city lights on the night side.
 */
export function PlanetSphere({ textures, radius, segments = 96, isSun = false, ...meshProps }) {
  const profile = textures.profile || {};

  if (isSun) {
    return (
      <mesh {...meshProps}>
        <sphereGeometry args={[radius, segments, segments]} />
        <meshBasicMaterial map={textures.map} toneMapped={false} color="#fff3d6" />
      </mesh>
    );
  }

  return (
    <mesh {...meshProps}>
      <sphereGeometry args={[radius, segments, segments]} />
      <meshStandardMaterial
        map={textures.map}
        normalMap={textures.normalMap || undefined}
        normalScale={textures.normalMap ? new THREE.Vector2(0.85, 0.85) : undefined}
        bumpMap={textures.bumpMap || undefined}
        bumpScale={textures.bumpMap ? Math.max(0.015, (profile.bump || 0.5) * 0.05) : 0}
        roughnessMap={textures.roughnessMap || undefined}
        roughness={profile.bands ? 0.58 : 0.88}
        metalness={0.02}
        emissiveMap={textures.night || undefined}
        emissive={textures.night ? '#ffd9a0' : '#000000'}
        emissiveIntensity={textures.night ? 0.65 : 0}
      />
    </mesh>
  );
}

/** Clouds / Venus haze, drawn just above the surface. */
export function CloudLayer({ textures, radius, bodyId, segments = 64, innerRef }) {
  if (!textures.clouds) return null;
  const isEarth = bodyId === 'earth';
  return (
    <mesh ref={innerRef} scale={isEarth ? 1.008 : 1.02}>
      <sphereGeometry args={[radius, segments, segments]} />
      <meshStandardMaterial
        map={textures.clouds}
        alphaMap={textures.clouds}
        transparent
        opacity={isEarth ? 0.92 : 0.95}
        depthWrite={false}
        roughness={0.95}
        metalness={0.0}
      />
    </mesh>
  );
}
