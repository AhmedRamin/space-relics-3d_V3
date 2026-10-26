import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Starfield } from '../three/Starfield';
import { CameraRig } from '../three/CameraRig';
import { Atmosphere } from '../three/Atmosphere';
import { SunGlow } from '../three/SunGlow';
import { PlanetGlow } from '../three/PlanetGlow';
import { GalaxyBackdrop } from '../three/GalaxyBackdrop';
import { AsteroidBelt } from './AsteroidBelt';
import { EclipticGlow } from './EclipticGlow';
import { KINDS, KIND_ORDER, ATMOSPHERES, RINGS, ORBITAL_INCLINATION, bodyColor } from '../../lib/constants';
import { bodyRadius, orbitRadius, sunRadius, layoutOrbits, hash01 } from '../../lib/scale';
import { bodyTextures, ringTexture } from '../../lib/textures';
import { PlanetSphere, CloudLayer } from '../three/BodySurface';
import { PlanetRings } from '../three/PlanetRings';

/**
 * Layer 1 — the Solar System.
 *
 * Layout guarantees live in `lib/scale.js` (`layoutOrbits`), not here: the Sun is capped, the
 * inner zone is linear so the first four planets are well separated, and a minimum gap is
 * enforced between every pair. This component only draws.
 */

/** Orrery scale: real radii would make Mercury a pixel. Every world is drawn ~2.35× larger. */
const PLANET_SCALE = 2.4;
const displayRadius = (body) =>
  body.id === 'sun' ? sunRadius() : Math.max(1.05, bodyRadius(body.diameterKm, body.isDwarf) * PLANET_SCALE);

function ClusterNode({ body, kind, count, max, onFocus }) {
  const [hovered, setHovered] = useState(false);
  const meta = KINDS[kind] || KINDS.probe;
  const size = 0.14 + (count / Math.max(1, max)) * 0.26;
  const angle = (KIND_ORDER.indexOf(kind) / KIND_ORDER.length) * Math.PI * 2;
  const row = KIND_ORDER.indexOf(kind);

  return (
    <group
      position={[Math.cos(angle) * 1.15, 0.26 + row * 0.13, Math.sin(angle) * 1.15]}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(event) => {
        event.stopPropagation();
        onFocus(body);
      }}
    >
      <mesh>
        <sphereGeometry args={[size, 16, 12]} />
        <meshStandardMaterial
          color={meta.color}
          emissive={meta.color}
          emissiveIntensity={hovered ? 1.1 : 0.42}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2.1, 0, 0]}>
        <ringGeometry args={[size * 1.5, size * 1.85, 24]} />
        <meshBasicMaterial color={meta.color} transparent opacity={hovered ? 0.85 : 0.35} side={2} depthWrite={false} />
      </mesh>
      {hovered ? (
        <Html center distanceFactor={30} style={{ pointerEvents: 'none' }}>
          <div className="scene-chip" style={{ borderColor: meta.color }}>
            {count}× {meta.label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function Body({ body, angle, onFocus, selected, showLabel, textureSize, orbit }) {
  const spin = useRef();
  const clouds = useRef();
  const [hovered, setHovered] = useState(false);

  const isSun = body.id === 'sun';
  // Orrery scaling: the true size ratio would make Mercury a pixel. Bodies are drawn ~2×
  // larger than scale so every world stays legible at the framed distance.
  const radius = isSun ? sunRadius() : displayRadius(body);
  const inclination = ((ORBITAL_INCLINATION[body.id] || 0) * Math.PI) / 180;
  const tilt = ((body.axialTiltDeg || 0) * Math.PI) / 180;

  const textures = useMemo(() => bodyTextures(body, textureSize), [body, textureSize]);
  const position = useMemo(() => {
    const x = Math.cos(angle) * orbit;
    const z = Math.sin(angle) * orbit;
    return [x, z * Math.sin(inclination), z * Math.cos(inclination)];
  }, [angle, orbit, inclination]);

  const counts = body.counts || {};
  const max = Math.max(1, ...Object.values(counts));
  const rings = RINGS[body.id];
  const tint = isSun ? '#ffcf8a' : bodyColor(body.id);

  useFrame((state, delta) => {
    if (spin.current) spin.current.rotation.y += delta * (isSun ? 0.015 : 0.05);
    if (clouds.current) clouds.current.rotation.y += delta * 0.012;
  });

  return (
    <group position={isSun ? [0, 0, 0] : position}>
      {!isSun ? <PlanetGlow radius={radius} color={tint} intensity={selected || hovered ? 0.7 : 0.42} /> : null}

      <group rotation={[0, 0, tilt]}>
        <group ref={spin}>
          <PlanetSphere
            textures={textures}
            radius={radius}
            segments={96}
            isSun={isSun}
            onClick={(event) => {
              event.stopPropagation();
              onFocus(body);
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHovered(true);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHovered(false);
              document.body.style.cursor = 'auto';
            }}
          />
        </group>

        <CloudLayer textures={textures} radius={radius} bodyId={body.id} innerRef={clouds} segments={64} />

        {isSun ? <SunGlow radius={radius} /> : null}
        {ATMOSPHERES[body.id] ? (
          <Atmosphere
            radius={radius}
            color={ATMOSPHERES[body.id].color}
            intensity={ATMOSPHERES[body.id].intensity}
            power={ATMOSPHERES[body.id].power}
          />
        ) : null}

        {rings ? (
          <PlanetRings
            radius={radius}
            inner={rings.inner}
            outer={rings.outer}
            color={rings.color}
            opacity={body.id === 'saturn' ? 0.95 : rings.opacity}
            texture={body.id === 'saturn' ? ringTexture() : null}
          />
        ) : null}
      </group>

      {hovered || selected ? (
        <mesh scale={1.28}>
          <sphereGeometry args={[radius, 24, 24]} />
          <meshBasicMaterial color={tint} transparent opacity={0.08} wireframe depthWrite={false} />
        </mesh>
      ) : null}

      {!isSun && body.total > 0
        ? Object.entries(counts).map(([kind, count]) => (
            <ClusterNode key={kind} body={body} kind={kind} count={count} max={max} onFocus={onFocus} />
          ))
        : null}

      {showLabel || hovered ? (
        <Html
          center
          position={[0, -(RINGS[body.id] ? radius * (RINGS[body.id].outer + 0.25) : radius + 0.9), 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`scene-label${hovered ? ' scene-label--on' : ''}${
              (body.orderFromSun || 99) <= 4 ? ' scene-label--minor' : ''
            }`}
            style={{
              transform: `translate(${
                (body.orderFromSun || 0) === 3 ? -24 : (body.orderFromSun || 0) === 4 ? 24 : 0
              }px, ${(body.orderFromSun || 0) % 2 ? 12 : -10}px)`,
            }}
          >
            {body.name}
            {hovered && body.total ? <span className="scene-label__count"> · {body.total}</span> : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

export function SolarSystemScene({ bodies, onFocusBody, selectedBodyId, showDwarfs, textureSize = 384 }) {
  const { size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const visible = useMemo(
    () => bodies.filter((body) => body.id !== 'moon' && (showDwarfs || !body.isDwarf) && body.id !== 'asteroids'),
    [bodies, showDwarfs]
  );
  const rocks = bodies.find((b) => b.id === 'asteroids');
  const earth = visible.find((b) => b.id === 'earth');
  const moon = bodies.find((b) => b.id === 'moon');

  const angles = useMemo(
    () =>
      visible.map((body) =>
        body.heliocentricLongitudeDeg ? (body.heliocentricLongitudeDeg * Math.PI) / 180 : hash01(body.id) * Math.PI * 2
      ),
    [visible]
  );

  const layout = useMemo(() => layoutOrbits(visible), [visible]);
  const orbits = useMemo(() => visible.map((body) => layout.get(body.id) ?? 0), [visible, layout]);
  const moonTextures = useMemo(() => (moon ? bodyTextures(moon, 256) : null), [moon]);
  const earthDisplayRadius = earth ? displayRadius(earth) : 2;
  const moonOrbit = earthDisplayRadius * 2.95;
  const moonRadius = Math.max(0.6, Math.min(1.35, earthDisplayRadius * 0.28));
  const outer = useMemo(() => Math.max(...orbits, 100), [orbits]);
  // Frame the classical planets, not the Kuiper cliff: dwarfs sit off-screen until the
  // visitor zooms out or enables them, which keeps Mercury legible on first load.
  const fitOuter = useMemo(() => {
    const planets = visible.filter((b) => !b.isDwarf && b.id !== 'sun');
    const values = planets.map((b) => layout.get(b.id) ?? 0);
    return values.length ? Math.max(...values, 80) : outer;
  }, [visible, layout, outer]);

  return (
    <>
      <pointLight position={[0, 0, 0]} intensity={2.1} decay={0} color="#fff6e8" />
      <ambientLight intensity={0.36} color="#9db4e8" />
      <hemisphereLight intensity={0.22} color="#cfe0ff" groundColor="#241a12" />
      <directionalLight position={[0, 40, 0]} intensity={0.22} color="#8fb0ff" />

      <GalaxyBackdrop />
      <Starfield radius={560} count={9000} factor={7.5} speed={0.25} />
      <EclipticGlow radius={outer * 1.08} />

      <AsteroidBelt inner={orbitRadius(2.15)} outer={orbitRadius(3.3)} count={1400} />

      {visible.map((body, index) => (
        <group key={body.id}>
          {body.id !== 'sun' && body.id !== 'asteroids' ? (
            <mesh rotation={[-Math.PI / 2 + ((ORBITAL_INCLINATION[body.id] || 0) * Math.PI) / 180, 0, 0]}>
              <ringGeometry args={[orbits[index] - 0.025, orbits[index] + 0.025, 240]} />
              <meshBasicMaterial
                color={body.total > 0 ? '#7aa8e8' : '#33456e'}
                transparent
                opacity={body.total > 0 ? 0.3 : 0.16}
                side={2}
                depthWrite={false}
              />
            </mesh>
          ) : null}
          <Body
            body={body}
            angle={angles[index]}
            orbit={orbits[index]}
            onFocus={onFocusBody}
            selected={selectedBodyId === body.id}
            showLabel={body.id !== 'sun' && body.id !== 'asteroids' && (body.orderFromSun || 0) >= 3}
            textureSize={textureSize}
          />
        </group>
      ))}

      {earth && moon && moonTextures ? (
        <group
          position={[
            Math.cos(angles[visible.indexOf(earth)]) * orbits[visible.indexOf(earth)],
            0,
            Math.sin(angles[visible.indexOf(earth)]) * orbits[visible.indexOf(earth)],
          ]}
        >
          {/* the Moon's orbit, drawn around Earth so it reads as a moon and not a planet */}
          <mesh rotation={[-Math.PI / 2 + 0.09, 0, 0]}>
            <ringGeometry args={[moonOrbit - 0.02, moonOrbit + 0.02, 128]} />
            <meshBasicMaterial color="#9db8d8" transparent opacity={0.4} side={2} depthWrite={false} />
          </mesh>
          <group
            position={[-moonOrbit, 0, 0]}
            onClick={(event) => {
              event.stopPropagation();
              onFocusBody(moon);
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto';
            }}
          >
            <mesh>
              <sphereGeometry args={[moonRadius, 48, 48]} />
              <meshStandardMaterial
                map={moonTextures.map}
                bumpMap={moonTextures.bumpMap}
                bumpScale={0.05}
                roughness={0.94}
              />
            </mesh>
            <PlanetGlow radius={moonRadius} color="#cfd6e4" intensity={0.34} />
          </group>
        </group>
      ) : null}

      {rocks && showDwarfs ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[orbitRadius(2.2), orbitRadius(3.2), 180]} />
          <meshBasicMaterial color="#6b5a44" transparent opacity={0.16} side={2} depthWrite={false} />
        </mesh>
      ) : null}

      <CameraRig
        target={[0, 0, 0]}
        distance={Math.max(225, fitOuter * 2.15 * Math.max(1, 1.4 / aspect))}
        trigger={`system-${aspect.toFixed(2)}`}
        offsetRatio={0.2}
      />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={26}
        maxDistance={640}
        rotateSpeed={0.45}
        zoomSpeed={0.75}
        maxPolarAngle={Math.PI * 0.92}
      />
    </>
  );
}
