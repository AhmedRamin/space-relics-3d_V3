import { useMemo } from 'react';
import * as THREE from 'three';
import { solarPanelTexture, foilTexture } from '../../lib/textures';

/**
 * Procedural hardware, built from three.js primitives with physical materials
 * (metalness / roughness / emissive) so the fleet reads as engineered hardware rather
 * than coloured blocks.
 *
 * The two texture maps that matter for realism are generated once and shared: a
 * monocrystalline solar-cell grid (with busbars and hinge) and crinkled MLI gold foil.
 * `simple` drops the small greebles for crowded scenes.
 */

const MAT = {
  aluminium: { color: '#c4ccd7', metalness: 0.86, roughness: 0.32 },
  titanium: { color: '#98a1b0', metalness: 0.92, roughness: 0.26 },
  white: { color: '#e6ebf2', metalness: 0.22, roughness: 0.52 },
  dark: { color: '#1b1f27', metalness: 0.5, roughness: 0.58 },
  gold: { color: '#c9a227', metalness: 0.95, roughness: 0.24 },
  solar: { color: '#0d1b36', metalness: 0.55, roughness: 0.24, emissive: '#0b2c58', emissiveIntensity: 0.28 },
  radiator: { color: '#eef1f6', metalness: 0.15, roughness: 0.7 },
  glass: { color: '#8fd0ff', metalness: 1.0, roughness: 0.06, emissive: '#2b6fa8', emissiveIntensity: 0.2 },
  regolith: { color: '#6d6255', metalness: 0.08, roughness: 0.95 },
  carbon: { color: '#2a2f38', metalness: 0.6, roughness: 0.42 },
};

/** One place where every material decision is made. */
function Pbr({ kind = 'aluminium', wireframe = false, ...rest }) {
  const m = MAT[kind] || MAT.aluminium;
  return (
    <meshStandardMaterial
      color={m.color}
      metalness={m.metalness}
      roughness={m.roughness}
      emissive={m.emissive || '#000000'}
      emissiveIntensity={m.emissiveIntensity || 0}
      wireframe={wireframe}
      {...rest}
    />
  );
}

/** Gold MLI blanket: uses the crinkled foil map, so the bus reads as wrapped hardware. */
function Foil({ wireframe }) {
  const map = useMemo(() => foilTexture(), []);
  return (
    <meshStandardMaterial
      map={map}
      color="#e6c56a"
      metalness={0.9}
      roughness={0.36}
      wireframe={wireframe}
    />
  );
}

/**
 * A solar wing: gold Kapton backing, a dark cell face with printed busbars, an aluminium
 * frame and a hinge at the root. This is the part that used to read as a plain blue slab.
 */
function SolarWing({ w = 1, d = 0.5, y = 0, x = 0, tilt = 0, wireframe, facing = 1 }) {
  const tex = useMemo(() => solarPanelTexture(), []);
  const thick = 0.016;

  return (
    <group position={[x, y, 0]} rotation={[0, 0, tilt]}>
      {/* Kapton back + structure */}
      <mesh>
        <boxGeometry args={[w, thick, d]} />
        <Pbr kind="gold" wireframe={wireframe} />
      </mesh>
      {/* cell face */}
      <mesh position={[0, thick * 0.55 * facing, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.965, d * 0.945]} />
        <meshStandardMaterial
          map={tex}
          color="#dbe8ff"
          metalness={0.6}
          roughness={0.22}
          emissive="#0b2c58"
          emissiveIntensity={0.22}
          side={THREE.DoubleSide}
          wireframe={wireframe}
        />
      </mesh>
      {/* frame rails */}
      {[-1, 1].map((s) => (
        <mesh key={`ez${s}`} position={[s * (w / 2 - 0.008), 0, 0]}>
          <boxGeometry args={[0.012, thick * 1.4, d]} />
          <Pbr kind="aluminium" wireframe={wireframe} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`ex${s}`} position={[0, 0, s * (d / 2 - 0.008)]}>
          <boxGeometry args={[w, thick * 1.4, 0.012]} />
          <Pbr kind="aluminium" wireframe={wireframe} />
        </mesh>
      ))}
      {/* hinge / root boom */}
      <mesh position={[-w / 2 - 0.012, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, d * 0.92, 10]} />
        <Pbr kind="titanium" />
      </mesh>
    </group>
  );
}

function Dish({ r = 0.28, position = [0, 0, 0], rotation = [0, 0, 0], wireframe, feed = true }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <sphereGeometry args={[r, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
        <Pbr kind="white" side={THREE.DoubleSide} wireframe={wireframe} />
      </mesh>
      {/* rim + mesh overlay */}
      <mesh>
        <sphereGeometry args={[r * 1.004, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
        <meshBasicMaterial color="#9fb0c4" wireframe transparent opacity={0.22} />
      </mesh>
      {feed ? (
        <>
          <mesh position={[0, r * 0.34, 0]}>
            <cylinderGeometry args={[0.012, 0.012, r * 0.55, 8]} />
            <Pbr kind="titanium" />
          </mesh>
          {[0, 1, 2].map((i) => {
            const a = (i / 3) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * r * 0.5, r * 0.06, Math.sin(a) * r * 0.5]}
                rotation={[0, -a, 0.6]}
              >
                <boxGeometry args={[0.006, r * 0.62, 0.006]} />
                <Pbr kind="titanium" />
              </mesh>
            );
          })}
          <mesh position={[0, r * 0.6, 0]}>
            <sphereGeometry args={[0.016, 8, 8]} />
            <Pbr kind="gold" />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

/** A cluster of small thruster nozzles. */
function Thrusters({ count = 2, radius = 0.06, color = 'titanium' }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * radius, -0.055, Math.sin(a) * radius]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.014, 0.028, 10, 1, true]} />
            <meshStandardMaterial color="#4a505c" metalness={0.9} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </>
  );
}

/* ------------------------------- rover ------------------------------- */
function Rover({ simple, wireframe }) {
  const wheel = (x, z) => (
    <group key={`${x}-${z}`} position={[x * 0.34, 0.115, z]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.115, 0.115, 0.078, 18]} />
        <meshStandardMaterial color="#2c3038" metalness={0.55} roughness={0.55} />
      </mesh>
      {!simple ? (
        <>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.088, 0.088, 0.08, 16]} />
            <Pbr kind="titanium" />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} rotation={[(i / 6) * Math.PI, 0, 0]}>
              <boxGeometry args={[0.02, 0.2, 0.01]} />
              <Pbr kind="aluminium" />
            </mesh>
          ))}
        </>
      ) : null}
    </group>
  );

  return (
    <group>
      {/* chassis + warm-electronics box */}
      <mesh position={[0, 0.245, 0]}>
        <boxGeometry args={[0.42, 0.13, 0.3]} />
        <Pbr kind="white" wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 0.245, 0]}>
        <boxGeometry args={[0.44, 0.03, 0.32]} />
        <Pbr kind="gold" wireframe={wireframe} />
      </mesh>
      {/* rocker-bogie */}
      {[-0.135, 0.135].map((z) => (
        <mesh key={z} position={[0, 0.19, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.5, 10]} />
          <Pbr kind="titanium" />
        </mesh>
      ))}
      {[-0.19, 0, 0.19].map((x) => [wheel(x, -0.145), wheel(x, 0.145)])}

      {/* mast with stereo cameras */}
      <mesh position={[-0.06, 0.36, 0.07]}>
        <cylinderGeometry args={[0.013, 0.013, 0.2, 12]} />
        <Pbr kind="titanium" />
      </mesh>
      <mesh position={[-0.06, 0.47, 0.07]}>
        <boxGeometry args={[0.11, 0.045, 0.04]} />
        <Pbr kind="white" />
      </mesh>
      {[-0.03, 0.03].map((dx) => (
        <mesh key={dx} position={[-0.06 + dx, 0.47, 0.093]}>
          <cylinderGeometry args={[0.013, 0.013, 0.014, 12]} />
          <Pbr kind="glass" />
        </mesh>
      ))}

      {!simple ? (
        <>
          <SolarWing w={0.4} d={0.27} y={0.335} x={0} />
          {/* instrument arm + turret */}
          <mesh position={[0.2, 0.22, 0.08]} rotation={[0, 0.5, -0.5]}>
            <boxGeometry args={[0.22, 0.02, 0.024]} />
            <Pbr kind="titanium" />
          </mesh>
          <mesh position={[0.32, 0.15, 0.14]}>
            <cylinderGeometry args={[0.024, 0.024, 0.032, 12]} />
            <Pbr kind="gold" />
          </mesh>
          {/* RTG + low-gain antenna */}
          <mesh position={[-0.24, 0.25, -0.02]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.038, 0.038, 0.14, 12]} />
            <Pbr kind="carbon" />
          </mesh>
          <mesh position={[0.14, 0.33, -0.1]}>
            <sphereGeometry args={[0.036, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Pbr kind="white" side={THREE.DoubleSide} />
          </mesh>
          <Thrusters count={0} />
        </>
      ) : null}
    </group>
  );
}

/* ---------------------------- helicopter ---------------------------- */
function Helicopter({ simple, wireframe }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.11, 0.06, 0.11]} />
        <Pbr kind="gold" wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.17, 0.16]} />
        <meshStandardMaterial map={solarPanelTexture()} color="#dbe8ff" metalness={0.6} roughness={0.22} side={2} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.1, 8]} />
        <Pbr kind="titanium" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`u${i}`} position={[0, 0.26, 0]} rotation={[0, (i * Math.PI) / 2, 0]}>
          <boxGeometry args={[0.46, 0.004, 0.014]} />
          <Pbr kind="carbon" />
        </mesh>
      ))}
      {!simple
        ? [
            [-0.07, -0.07],
            [0.07, -0.07],
            [-0.07, 0.07],
            [0.07, 0.07],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.045, z]} rotation={[0.18, 0, x > 0 ? -0.18 : 0.18]}>
              <cylinderGeometry args={[0.006, 0.006, 0.09, 6]} />
              <Pbr kind="titanium" />
            </mesh>
          ))
        : null}
    </group>
  );
}

/* ------------------------------- lander ------------------------------- */
function Lander({ simple, wireframe }) {
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.11, 0.125, 0.14, 10]} />
        <Foil wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.115, 0.13, 0.03, 10]} />
        <Pbr kind="aluminium" />
      </mesh>
      <mesh position={[0, 0.235, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 0.05, 10]} />
        <Pbr kind="titanium" />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[0.095, 0.09, 0]} rotation={[0, 0, -0.4]}>
              <boxGeometry args={[0.018, 0.2, 0.018]} />
              <Pbr kind="titanium" />
            </mesh>
            <mesh position={[0.145, 0.008, 0]}>
              <cylinderGeometry args={[0.04, 0.044, 0.012, 14]} />
              <Pbr kind="dark" />
            </mesh>
          </group>
        );
      })}
      {!simple ? (
        <>
          <Dish r={0.085} position={[0, 0.22, 0.08]} rotation={[-0.6, 0, 0]} />
          <SolarWing w={0.24} d={0.17} x={-0.19} y={0.15} tilt={0.06} />
          <mesh position={[0.16, 0.2, -0.02]}>
            <cylinderGeometry args={[0.01, 0.01, 0.16, 8]} />
            <Pbr kind="titanium" />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

/* ---------------------------- space station ---------------------------- */
function Station({ simple, wireframe }) {
  return (
    <group>
      {/* main truss with bays */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.009, 0.009, 0.62, 10]} />
        <Pbr kind="titanium" />
      </mesh>
      {!simple
        ? [-0.24, -0.08, 0.08, 0.24].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.028, 0.005, 6, 12]} />
              <Pbr kind="aluminium" />
            </mesh>
          ))
        : null}

      {/* pressurised modules */}
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.034, 0.034, 0.18, 18]} />
          <Pbr kind="white" wireframe={wireframe} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 0.22, 18]} />
        <Pbr kind="white" />
      </mesh>
      {/* docking port */}
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.028, 0.04, 12]} />
        <Pbr kind="titanium" />
      </mesh>

      {!simple ? (
        <>
          {/* solar wings on both ends of the truss, cell face up */}
          {[-1, 1].map((dir) => (
            <group key={dir} position={[dir * 0.44, 0, 0]}>
              <SolarWing w={0.34} d={0.19} />
              <mesh position={[-dir * 0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.008, 0.008, 0.14, 8]} />
                <Pbr kind="titanium" />
              </mesh>
            </group>
          ))}
          {/* radiators */}
          {[-1, 1].map((dir) => (
            <mesh key={`r${dir}`} position={[0, dir * 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.26, 0.005, 0.1]} />
              <Pbr kind="radiator" />
            </mesh>
          ))}
          {[-0.2, 0.2].map((x) => (
            <mesh key={`t${x}`} position={[x, 0.05, 0]}>
              <sphereGeometry args={[0.016, 10, 8]} />
              <Pbr kind="white" />
            </mesh>
          ))}
        </>
      ) : null}
    </group>
  );
}

/* --------------------- orbiter / satellite / telescope / probe --------------------- */
function Orbiter({ simple, wireframe, variant }) {
  const bus = variant === 'satellite' ? [0.1, 0.1, 0.1] : [0.13, 0.12, 0.13];
  return (
    <group>
      <mesh>
        <boxGeometry args={bus} />
        <Pbr kind="white" wireframe={wireframe} />
      </mesh>
      {/* MLI blanket on the shaded side */}
      <mesh position={[0, 0, -bus[2] * 0.502]}>
        <boxGeometry args={[bus[0] * 0.96, bus[1] * 0.9, 0.004]} />
        <Foil wireframe={wireframe} />
      </mesh>
      <mesh>
        <boxGeometry args={[bus[0] * 1.02, bus[1] * 0.18, bus[2] * 1.02]} />
        <Pbr kind="gold" />
      </mesh>

      {[-1, 1].map((dir) => (
        <group key={dir} position={[dir * 0.06, 0, 0]}>
          <mesh position={[dir * 0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.1, 8]} />
            <Pbr kind="titanium" />
          </mesh>
          <SolarWing
            w={0.24}
            d={variant === 'satellite' ? 0.15 : 0.17}
            x={dir * (0.2 + bus[0] / 2)}
            tilt={variant === 'telescope' ? 0.12 : 0.03}
          />
        </group>
      ))}

      <Dish r={variant === 'orbiter' ? 0.09 : 0.065} position={[0, bus[1] * 0.55, -0.055]} rotation={[-0.9, 0, 0]} />

      {!simple ? (
        <>
          <Thrusters count={4} radius={0.05} />
          {/* star tracker */}
          <mesh position={[0.055, bus[1] * 0.54, 0.02]}>
            <cylinderGeometry args={[0.012, 0.012, 0.02, 8]} />
            <Pbr kind="carbon" />
          </mesh>
          <mesh position={[0.055, bus[1] * 0.56, 0.02]}>
            <boxGeometry args={[0.016, 0.008, 0.016]} />
            <Pbr kind="glass" />
          </mesh>
          {/* magnetometer boom */}
          <mesh position={[0.18, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.003, 0.003, 0.26, 6]} />
            <Pbr kind="titanium" />
          </mesh>
        </>
      ) : null}

      {!simple && variant === 'telescope' ? (
        <>
          <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.062, 0.062, 0.16, 26]} />
            <Pbr kind="aluminium" wireframe={wireframe} />
          </mesh>
          <mesh position={[0, 0, 0.21]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.068, 0.068, 0.012, 26]} />
            <Pbr kind="glass" />
          </mesh>
          <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.045, 0.006, 8, 18]} />
            <Pbr kind="titanium" />
          </mesh>
        </>
      ) : null}

      {!simple && variant === 'probe' ? (
        <>
          <mesh position={[-0.14, -0.045, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 0.1, 12]} />
            <Pbr kind="titanium" />
          </mesh>
          <mesh position={[0.22, 0.02, 0]}>
            <boxGeometry args={[0.36, 0.007, 0.007]} />
            <Pbr kind="titanium" />
          </mesh>
          <mesh position={[-0.28, 0.02, 0]}>
            <sphereGeometry args={[0.024, 12, 10]} />
            <Pbr kind="gold" />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function Impactor({ simple, wireframe }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 0.14, 22]} />
        <Pbr kind="white" wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 0, -0.11]}>
        <boxGeometry args={[0.09, 0.09, 0.08]} />
        <Pbr kind="gold" />
      </mesh>
      {!simple ? (
        <>
          <SolarWing w={0.18} d={0.11} y={0.085} />
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.068, 0.004, 6, 20]} />
            <Pbr kind="titanium" />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

export function HardwareMesh({ kind, simple = false, wireframe = false }) {
  const node = useMemo(() => {
    switch (kind) {
      case 'rover':
        return <Rover simple={simple} wireframe={wireframe} />;
      case 'helicopter':
        return <Helicopter simple={simple} wireframe={wireframe} />;
      case 'lander':
        return <Lander simple={simple} wireframe={wireframe} />;
      case 'station':
        return <Station simple={simple} wireframe={wireframe} />;
      case 'orbiter':
        return <Orbiter simple={simple} wireframe={wireframe} variant="orbiter" />;
      case 'satellite':
        return <Orbiter simple={simple} wireframe={wireframe} variant="satellite" />;
      case 'telescope':
        return <Orbiter simple={simple} wireframe={wireframe} variant="telescope" />;
      case 'probe':
        return <Orbiter simple={simple} wireframe={wireframe} variant="probe" />;
      case 'impactor':
        return <Impactor simple={simple} wireframe={wireframe} />;
      default:
        return <Orbiter simple={simple} wireframe={wireframe} variant="probe" />;
    }
  }, [kind, simple, wireframe]);

  return node;
}

export const SURFACE_KINDS = ['rover', 'helicopter', 'lander', 'impactor'];
