import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Starfield } from '../three/Starfield';
import { CameraRig } from '../three/CameraRig';
import { Atmosphere } from '../three/Atmosphere';
import { SunGlow } from '../three/SunGlow';
import { GalaxyBackdrop } from '../three/GalaxyBackdrop';
import { HardwareNode } from './HardwareNode';
import { ATMOSPHERES, RINGS } from '../../lib/constants';
import { bodyRadius } from '../../lib/scale';
import { bodyTextures, moonTextures, ringTexture } from '../../lib/textures';
import { PlanetSphere, CloudLayer } from '../three/BodySurface';
import { PlanetRings } from '../three/PlanetRings';
import { placeHardware } from '../../lib/position';

const TEXTURE_SIZE = 1024;
const MAX_SHELLS = 3; // published orbits drawn at once — more than this was unreadable

/** Layer 2 + 3 — one body with its real hardware placed on it and around it. */

function Moon({ moon, index, parentRadius, parentDiameterKm }) {
  const ref = useRef();
  const spin = useRef();
  const textures = useMemo(() => moonTextures(moon, 512), [moon]);

  const radius = Math.max(0.055, Math.min(0.52, (moon.meanRadiusKm || 60) / 4300));
  const bodyRadiusKm = (parentDiameterKm || 12000) / 2;
  const ratio = (moon.semiMajorAxisKm || 400000) / bodyRadiusKm;
  const distance = Math.max(
    parentRadius * 1.85 + radius,
    parentRadius * (1.55 + Math.min(3.1, Math.log10(1 + ratio) * 1.5))
  );
  const period = moon.orbitalPeriodDays || 20;
  const speed = 0.16 / Math.max(1, Math.pow(period / 10, 0.55));
  const inclination = ((moon.inclinationDeg || 0) * Math.PI) / 180;
  const phase = index * 1.7;

  useFrame((state, delta) => {
    if (ref.current) {
      const t = state.clock.elapsedTime * speed + phase;
      ref.current.position.set(
        Math.cos(t) * distance,
        Math.sin(t) * distance * Math.sin(inclination) * 0.85,
        Math.sin(t) * distance * Math.cos(inclination)
      );
      // Tidally locked: the same face always points at the parent.
      ref.current.rotation.y = -t + Math.PI;
    }
    if (spin.current) spin.current.rotation.y += delta * 0.02;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2 + inclination, 0, 0]}>
        <ringGeometry args={[distance - 0.006, distance + 0.006, 160]} />
        <meshBasicMaterial color="#8fb4e0" transparent opacity={0.09} side={2} depthWrite={false} />
      </mesh>
      <group ref={ref}>
        <PlanetSphere textures={textures} radius={radius} segments={64} />
        <mesh scale={1.03}>
          <sphereGeometry args={[radius, 32, 32]} />
          <meshBasicMaterial color="#9fb0c6" transparent opacity={0.05} depthWrite={false} side={1} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Orbit shells: at most three, brightest for the selected object, and exactly one label.
 * Earlier every distinct altitude got its own ring and DOM label, which stacked into an
 * unreadable pile of text over the planet.
 */
function OrbitShells({ shells, selectedKey }) {
  return (
    <>
      {shells.map((shell) => {
        const isSelected = shell.key === selectedKey;
        return (
          <group key={shell.key} rotation={[shell.inclination || 0, 0, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[shell.radius - 0.012, shell.radius + 0.012, 200]} />
              <meshBasicMaterial
                color={isSelected ? '#a8d0ff' : '#89b6ea'}
                transparent
                opacity={isSelected ? 0.5 : 0.16}
                side={2}
                depthWrite={false}
              />
            </mesh>
            {isSelected ? (
              <Html position={[shell.radius * 0.74, 0, shell.radius * 0.74]} style={{ pointerEvents: 'none' }}>
                <div className="orbit-label orbit-label--selected">{shell.label}</div>
              </Html>
            ) : null}
          </group>
        );
      })}
    </>
  );
}

export function BodyScene({
  body,
  hardware,
  moons,
  selectedId,
  onSelect,
  kindFilter,
  workingOnly,
  onClearSelection,
}) {
  const { size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const radius = bodyRadius(body.diameterKm, body.isDwarf);
  const textures = useMemo(() => bodyTextures(body, TEXTURE_SIZE), [body]);
  const tilt = ((body.axialTiltDeg || 0) * Math.PI) / 180;
  const spin = useRef();
  const clouds = useRef();

  const filtered = useMemo(() => {
    let list = hardware;
    if (kindFilter) list = list.filter((item) => item.visualKind === kindFilter);
    if (workingOnly) list = list.filter((item) => item.workingNow);
    return list;
  }, [hardware, kindFilter, workingOnly]);

  const rendered = filtered; // nothing is hidden

  const selected = filtered.find((item) => item.id === selectedId) || null;

  const placedById = useMemo(() => {
    const map = new Map();
    rendered.forEach((item, index) => map.set(item.id, placeHardware(item, index, rendered.length, body)));
    return map;
  }, [rendered, body]);

  const selectedPlace = selected ? placedById.get(selected.id) || null : null;

  const shells = useMemo(() => {
    const seen = new Map();
    rendered.forEach((item) => {
      const place = placedById.get(item.id);
      if (!place || place.mode !== 'orbit' || !item.orbit || typeof item.orbit.altitudeKm !== 'number') return;
      const key = `${place.radius.toFixed(2)}-${(place.inclination || 0).toFixed(3)}`;
      const entry = seen.get(key) || {
        key,
        radius: place.radius,
        inclination: place.inclination,
        label: item.orbit.label || `${item.orbit.altitudeKm} km`,
        count: 0,
      };
      entry.count += 1;
      seen.set(key, entry);
    });

    const all = [...seen.values()].sort((a, b) => b.count - a.count);
    const selectedShell = selectedPlace && selectedPlace.mode === 'orbit'
      ? all.find((shell) => shell.radius === selectedPlace.radius)
      : null;

    const picked = all.slice(0, MAX_SHELLS);
    if (selectedShell && !picked.includes(selectedShell)) picked[picked.length - 1] = selectedShell;
    return picked;
  }, [rendered, placedById, selectedPlace]);

  const showMoons = useMemo(
    () =>
      moons && moons.length
        ? moons.slice().sort((a, b) => (b.meanRadiusKm || 0) - (a.meanRadiusKm || 0)).slice(0, 8)
        : [],
    [moons]
  );

  useFrame((state, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.01;
    if (clouds.current) clouds.current.rotation.y += delta * 0.014;
  });

  return (
    <>
      <directionalLight position={[radius * 4, radius * 2.2, radius * 3]} intensity={2.2} color="#fff8ee" />
      <directionalLight position={[-radius * 3, radius * 1.2, -radius * 2]} intensity={0.45} color="#7f9fe0" />
      <ambientLight intensity={0.32} color="#9db4e8" />
      <hemisphereLight intensity={0.2} color="#d5e4ff" groundColor="#241a12" />
      <Starfield radius={300} count={4000} factor={5} />
      <GalaxyBackdrop radius={560} />

      <group rotation={[0, 0, tilt]}>
        <group ref={spin}>
          <PlanetSphere
            textures={textures}
            radius={radius}
            segments={128}
            isSun={body.id === 'sun'}
            onClick={(event) => {
              event.stopPropagation();
              if (onClearSelection) onClearSelection();
            }}
          />
          <CloudLayer textures={textures} radius={radius} bodyId={body.id} innerRef={clouds} segments={96} />
        </group>

        {body.id === 'sun' ? <SunGlow radius={radius} /> : null}
        {ATMOSPHERES[body.id] ? (
          <Atmosphere
            radius={radius}
            color={ATMOSPHERES[body.id].color}
            intensity={ATMOSPHERES[body.id].intensity * 1.15}
            power={ATMOSPHERES[body.id].power}
          />
        ) : null}
        {RINGS[body.id] ? (
          <PlanetRings
            radius={radius}
            inner={RINGS[body.id].inner}
            outer={RINGS[body.id].outer}
            color={RINGS[body.id].color}
            opacity={body.id === 'saturn' ? 0.95 : RINGS[body.id].opacity}
            texture={body.id === 'saturn' ? ringTexture() : null}
          />
        ) : null}
      </group>

      {showMoons.map((moon, index) => (
        <Moon key={moon.id} moon={moon} index={index} parentRadius={radius} parentDiameterKm={body.diameterKm} />
      ))}

      <OrbitShells shells={shells} selectedKey={selectedPlace && selectedPlace.mode === 'orbit' ? shells.find((s) => s.radius === selectedPlace.radius)?.key : null} />

      {rendered.map((item, index) => (
        <HardwareNode
          key={item.id}
          item={item}
          index={index}
          total={rendered.length}
          body={body}
          selected={selectedId === item.id}
          onSelect={onSelect}
        />
      ))}

      <CameraRig
        target={selectedPlace ? selectedPlace.position : [0, 0, 0]}
        distance={
          (selectedPlace ? Math.max(radius * 2.1, 3.2) : radius * 7.6) * Math.max(1, 0.72 / aspect)
        }
        trigger={selectedId || `${body.id}-${rendered.length}`}
      />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={radius * 1.25}
        maxDistance={radius * 26}
        rotateSpeed={0.45}
        zoomSpeed={0.75}
        maxPolarAngle={Math.PI * 0.95}
      />
    </>
  );
}
