/**
 * Cell to Mind — sahne kökü ve kamera.
 *
 * Kamera: döndürme, kaydırma, yakınlaştırma + isteğe bağlı canlı takibi.
 * Bir menü/panel etkileşimi sırasında kamera KASITLI OLARAK kilitlenir.
 */

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ACESFilmicToneMapping, Color, FogExp2, Group, SRGBColorSpace, Vector3 } from 'three';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Bonds, Cells, OuterShell, SelectionRing } from './Cells.tsx';
import { HabitatFloor, HabitatWalls, LightShafts, MarineSnow } from './Environment.tsx';
import { Predator, Resources, Rocks } from './Props.tsx';
import { useStore } from '../engine/store.ts';

const DEFAULT_SIZE = { x: 16, y: 8, z: 11 };

function Lights({ size }: { size: { x: number; y: number; z: number } }): React.ReactElement {
  const light = useStore((s) => s.settings.light);
  return (
    <>
      <ambientLight intensity={0.55 + light * 0.55} color="#8fbec6" />
      {/* Yukarıdan süzülen soğuk ışık */}
      <directionalLight
        position={[size.x * 0.35, size.y * 3.2, size.z * 0.4]}
        intensity={1.1 + light * 2.0}
        color="#cdeee6"
      />
      {/* Habitatin tabanından yükselen sıcak yansıma */}
      <pointLight position={[size.x * 0.5, 0.4, size.z * 0.5]} intensity={2.6} distance={size.x * 1.4} color="#2c6f6a" />
    </>
  );
}

/** Derin su sisi — mesafe duyusunun ana kaynağı. */
function WaterFog({ size }: { size: { x: number; y: number; z: number } }): React.ReactElement {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const fog = new FogExp2(new Color('#08202a'), 0.016);
    scene.fog = fog;
    scene.background = new Color('#05161d');
    return () => {
      scene.fog = null;
    };
  }, [scene]);
  void size;
  return <></>;
}

/** Canlı takibi: seçili organizmanın merkezine yumuşak takip. */
function FollowTarget({
  size,
  enabled,
  controlsRef,
}: {
  size: { x: number; y: number; z: number };
  enabled: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}): null {
  const selectedId = useStore((s) => s.selectedId);
  const organisms = useStore((s) => s.organisms);
  const target = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !enabled || selectedId === null) return;
    const org = organisms.find((o) => o.id === selectedId);
    if (!org) return;
    target.set(org.centroid.x, org.centroid.y, org.centroid.z);
    controls.target.lerp(target, Math.min(1, delta * 2.2));
    controls.update();
  });
  void size;
  return null;
}

/** Grafik bağımı kaybı durumunda kullanıcıya görünür bildirim verir. */
function ContextGuard(): React.ReactElement {
  const gl = useThree((s) => s.gl);
  const notify = useStore((s) => s.notify);
  const language = useStore((s) => s.language);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      notify(
        'error',
        language === 'tr'
          ? 'Grafik bağlamı kayboldu — sahne yeniden kuruluyor. Kayıt korunuyor.'
          : 'Graphics context lost — rebuilding the scene. Your record is preserved.',
      );
    };
    const onRestored = () => {
      notify('success', language === 'tr' ? 'Grafik bağlamı geri geldi.' : 'Graphics context restored.');
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, notify, language]);

  return <></>;
}

export function Scene(): React.ReactElement {
  const habitat = useStore((s) => s.habitat);
  const size = habitat?.size ?? DEFAULT_SIZE;
  const panel = useStore((s) => s.panel);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const [follow, setFollow] = useState(false);
  const followRef = useRef(follow);
  followRef.current = follow;
  const controlsRef = useRef<OrbitControlsImpl>(null);
  void setFollow;

  // Panel açıkken kamera kilitlenir: yanlışlıkla hareket etmesin.
  const cameraLocked = panel !== null;

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.outputColorSpace = SRGBColorSpace;
      }}
      camera={{ position: [size.x * 0.5 + size.x * 0.95, size.y * 1.35, size.z * 1.05], fov: 50, near: 0.05, far: 320 }}
    >
      <Lights size={size} />
      <WaterFog size={size} />
      <ContextGuard />

      <Suspense fallback={null}>
        <HabitatFloor size={size} />
        <HabitatWalls size={size} />
        <LightShafts size={size} />
        <Rocks />
        <Resources />
        <Predator />
        <Cells />
        <Bonds />
        <SelectionRing />
        <OuterShell size={size} />
      </Suspense>

      {!reducedMotion && <MarineSnow size={size} count={1200} />}

      <OrbitControls
        ref={controlsRef}
        enabled={!cameraLocked}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.2}
        maxDistance={size.x * 3.4}
        maxPolarAngle={Math.PI * 0.92}
        target={[size.x * 0.5, size.y * 0.45, size.z * 0.5]}
        makeDefault
      />
      <FollowTarget size={size} enabled={followRef.current} controlsRef={controlsRef} />
    </Canvas>
  );
}

export type { Group };
