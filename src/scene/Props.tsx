/**
 * Cell to Mind — Blender'dan üretilen varlıklar (kaya, kaynak, avcı).
 *
 * Tüm GLB'ler `scripts/blender/make_assets.py` ile PROSEDÜREL olarak üretilir;
 * hiçbir dış model indirilmez (bkz. docs/ASSETS.md).
 */

import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  TextureLoader,
  Vector2,
} from 'three';
import { H, RES, RESOURCE_FLOATS } from '../worker/protocol.ts';
import { getFrame } from '../engine/frame.ts';
import { useStore } from '../engine/store.ts';

const ROCK_PATHS = [
  'assets/rocks/rock_01.glb',
  'assets/rocks/rock_02.glb',
  'assets/rocks/rock_03.glb',
  'assets/rocks/rock_04.glb',
] as const;

/** Kayalar: varyant başına bir instanced mesh. */
export function Rocks(): React.ReactElement | null {
  const rocks = useStore((s) => s.habitat?.rocks);
  const variants = useMemo(() => ROCK_PATHS.map((p) => useGLTF(p)), []);
  const scratch = useMemo(() => new Object3D(), []);

  const groups = useMemo(() => {
    if (!rocks) return [];
    const byVariant = new Map<number, typeof rocks>();
    for (const rock of rocks) {
      const list = byVariant.get(rock.variant) ?? [];
      list.push(rock);
      byVariant.set(rock.variant, list);
    }
    return [...byVariant.entries()].sort((a, b) => a[0] - b[0]);
  }, [rocks]);

  if (!rocks) return null;

  return (
    <>
      {groups.map(([variant, list]) => (
        <RockBatch
          key={variant}
          scene={variants[variant]?.scene}
          items={list}
          scratch={scratch}
        />
      ))}
    </>
  );
}

function RockBatch({
  scene,
  items,
  scratch,
}: {
  scene: Group | undefined;
  items: { id: number; pos: { x: number; y: number; z: number }; radius: number }[];
  scratch: Object3D;
}): React.ReactElement | null {
  const ref = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => scene && findMesh(scene)?.geometry, [scene]);
  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: new Color('#4a5f63'),
      roughness: 0.95,
      metalness: 0.02,
    });
    const loader = new TextureLoader();
    loader.load('assets/textures/rock_n.png', (tex) => {
      tex.wrapS = RepeatWrapping;
      tex.wrapT = RepeatWrapping;
      tex.repeat.set(2, 2);
      tex.colorSpace = SRGBColorSpace;
      mat.normalMap = tex;
      mat.normalScale = new Vector2(1.1, 1.1);
      mat.needsUpdate = true;
    });
    return mat;
  }, []);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || !items.length) return;
    for (let i = 0; i < items.length; i++) {
      const rock = items[i]!;
      scratch.position.set(rock.pos.x, rock.radius * 0.42, rock.pos.z);
      scratch.rotation.set(rock.id * 0.7, rock.id * 1.3, rock.id * 0.41);
      scratch.scale.setScalar(rock.radius);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
    }
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!geometry) return null;
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, items.length)]} castShadow receiveShadow />;
}

function findMesh(group: Group): { geometry: InstancedMesh['geometry'] } | null {
  let found: { geometry: InstancedMesh['geometry'] } | null = null;
  group.traverse((child) => {
    if (found) return;
    const mesh = child as unknown as InstancedMesh;
    if (mesh.isMesh && mesh.geometry) found = { geometry: mesh.geometry };
  });
  return found;
}

/**
 * Kaynak düğümleri: A = yumuşak biyofilm kümesi, B = keskin mineral.
 * Rezerv dolduğunda görsel olarak da söner (durum yalnız renkle değil,
 * parlaklık ve ölçekle de ayrılır).
 */
export function Resources(): React.ReactElement | null {
  const aRef = useRef<InstancedMesh>(null);
  const bRef = useRef<InstancedMesh>(null);
  const fieldARef = useRef<InstancedMesh>(null);
  const fieldBRef = useRef<InstancedMesh>(null);
  const fieldGeo = useMemo(() => new SphereGeometry(1, 20, 14), []);
  const fieldMatA = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#F2BA72'),
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );
  const fieldMatB = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#7FB6D9'),
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );
  const scratch = useMemo(() => new Object3D(), []);
  const noduleA = useGLTF('assets/props/nodule_a.glb');
  const noduleB = useGLTF('assets/props/nodule_b.glb');

  const geoA = useMemo(() => findMesh(noduleA.scene)?.geometry, [noduleA]);
  const geoB = useMemo(() => findMesh(noduleB.scene)?.geometry, [noduleB]);

  const matA = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#F2BA72'),
        emissive: new Color('#8a5a20'),
        emissiveIntensity: 0.55,
        roughness: 0.55,
        metalness: 0.0,
      }),
    [],
  );
  const matB = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#7FB6D9'),
        emissive: new Color('#1d4f6b'),
        emissiveIntensity: 0.5,
        roughness: 0.35,
        metalness: 0.1,
      }),
    [],
  );

  useFrame((state) => {
    const data = getFrame();
    const a = aRef.current;
    const b = bRef.current;
    const fieldA = fieldARef.current;
    const fieldB = fieldBRef.current;
    if (!data || !a || !b) return;
    const count = data[H.RESOURCE_COUNT] as number;
    const base = H.CELL_COUNT as number;
    const cellCount = data[H.CELL_COUNT] as number;
    const offset = 16 + cellCount * 12;
    void base;

    let ai = 0;
    let bi = 0;
    const t = state.clock.elapsedTime;
    const maxA = a.instanceMatrix.count;
    const maxB = b.instanceMatrix.count;
    const maxField = fieldGeo.attributes.position.count > 0 ? 64 : 64;
    void maxField;

    for (let i = 0; i < count; i++) {
      const o = offset + i * RESOURCE_FLOATS;
      const kindB = (data[o + RES.KIND] as number) > 0.5;
      const reserve = data[o + RES.RESERVE_FRAC] as number;
      const radius = data[o + RES.RADIUS] as number;
      const pulse = 1 + 0.05 * Math.sin(t * 1.1 + i);
      const px = data[o + RES.X] as number;
      const py = data[o + RES.Y] as number;
      const pz = data[o + RES.Z] as number;

      // Besin alanı küresi GERÇEK etki yarıçapında çizilir; oyuncu
      // dokunulabilir alanı görebilsin.
      if ((kindB ? fieldB : fieldA) && (kindB ? bi : ai) < 64) {
        scratch.position.set(px, py, pz);
        scratch.rotation.set(0, 0, 0);
        scratch.scale.setScalar(radius);
        scratch.updateMatrix();
        (kindB ? fieldB : fieldA)?.setMatrixAt(kindB ? bi : ai, scratch.matrix);
      }

      // Görsel çekirdek, simülasyondaki besin alanından KÜÇÜK çizilir.
      const scale = radius * 0.4 * (0.55 + 0.45 * reserve) * pulse;
      scratch.position.set(px, py, pz);
      scratch.rotation.set(i * 0.7, t * 0.08 + i, i * 0.3);
      scratch.scale.setScalar(scale);
      scratch.updateMatrix();
      if (kindB) {
        if (bi < maxB) b.setMatrixAt(bi, scratch.matrix);
        bi++;
      } else {
        if (ai < maxA) a.setMatrixAt(ai, scratch.matrix);
        ai++;
      }
    }
    a.count = Math.min(ai, maxA);
    b.count = Math.min(bi, maxB);
    if (fieldA) {
      fieldA.count = Math.min(ai, 64);
      fieldA.instanceMatrix.needsUpdate = true;
    }
    if (fieldB) {
      fieldB.count = Math.min(bi, 64);
      fieldB.instanceMatrix.needsUpdate = true;
    }
    a.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    matA.emissiveIntensity = 0.2 + 0.45 * (state.clock.elapsedTime % 1) * 0.5;
  });

  if (!geoA || !geoB) return null;
  return (
    <>
      <instancedMesh ref={aRef} args={[geoA, matA, 64]} frustumCulled={false} />
      <instancedMesh ref={bRef} args={[geoB, matB, 64]} frustumCulled={false} />
      <instancedMesh ref={fieldARef} args={[fieldGeo, fieldMatA, 64]} frustumCulled={false} />
      <instancedMesh ref={fieldBRef} args={[fieldGeo, fieldMatB, 64]} frustumCulled={false} />
    </>
  );
}

/** Avcı: seçilim baskısının görsel aracı. Öğrenen bir tür DEĞİLDİR. */
export function Predator(): React.ReactElement | null {
  const ref = useRef<Group>(null);
  const gltf = useGLTF('assets/critters/predator.glb');
  const geometry = useMemo(() => findMesh(gltf.scene)?.geometry, [gltf]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#E58D81'),
        emissive: new Color('#4a1f1c'),
        emissiveIntensity: 0.5,
        roughness: 0.38,
        metalness: 0.05,
      }),
    [],
  );

  useFrame((state, delta) => {
    const group = ref.current;
    const data = getFrame();
    if (!group || !data) return;
    const active = (data[H.PREDATOR_ACTIVE] as number) > 0.5;
    group.visible = active;
    if (!active) return;
    group.position.set(data[H.PREDATOR_X] as number, data[H.PREDATOR_Y] as number, data[H.PREDATOR_Z] as number);
    const radius = data[H.PREDATOR_RADIUS] as number;
    group.scale.setScalar(radius * 1.6);
    group.rotation.y += delta * 0.35;
    group.rotation.x = Math.sin(state.clock.elapsedTime * 0.6) * 0.18;
    const energy = data[H.PREDATOR_ENERGY] as number;
    material.emissiveIntensity = 0.3 + 0.6 * Math.min(1, energy * 2);
  });

  if (!geometry) return null;
  return (
    <group ref={ref}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

useGLTF.preload('assets/rocks/rock_01.glb');
useGLTF.preload('assets/rocks/rock_02.glb');
useGLTF.preload('assets/rocks/rock_03.glb');
useGLTF.preload('assets/rocks/rock_04.glb');
useGLTF.preload('assets/props/nodule_a.glb');
useGLTF.preload('assets/props/nodule_b.glb');
useGLTF.preload('assets/critters/predator.glb');
