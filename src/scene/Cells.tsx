/**
 * Cell to Mind — hücre sahnesi.
 *
 * Tek bir `InstancedMesh`; yüzlerce hücre için tek çizim çağrısı. Geometri ve
 * malzeme paylaşılır. Öznitelikler doğrudan kare paketinden yazılır.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { CELL, CELL_FLOATS, HEADER_FLOATS } from '../worker/protocol.ts';
import { getFrame } from '../engine/frame.ts';
import { createCellMaterial } from './materials/CellMaterial.ts';
import { useStore } from '../engine/store.ts';

const MAX_CELLS = 512;

export function Cells(): React.ReactElement {
  const meshRef = useRef<InstancedMesh>(null);
  const selectedId = useStore((s) => s.selectedId);
  const reducedMotion = useStore((s) => s.reducedMotion);

  const geometry = useMemo(() => new IcosahedronGeometry(1, 3), []);
  const { material, uniforms } = useMemo(() => createCellMaterial(), []);

  const attributes = useMemo(() => {
    const phase = new Float32Array(MAX_CELLS);
    const energy = new Float32Array(MAX_CELLS);
    const damage = new Float32Array(MAX_CELLS);
    const organism = new Float32Array(MAX_CELLS);
    for (let i = 0; i < MAX_CELLS; i++) {
      // Deterministik faz: her örnek farklı nefes döngüsüne sahip olsun.
      phase[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      energy[i] = 0.5;
    }
    return { phase, energy, damage, organism };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const set = (name: string, array: Float32Array, size: number) => {
      const attr = new InstancedBufferAttribute(array, size);
      attr.setUsage(DynamicDrawUsage);
      geometry.setAttribute(name, attr);
    };
    set('aPhase', attributes.phase, 1);
    set('aEnergy', attributes.energy, 1);
    set('aDamage', attributes.damage, 1);
    set('aOrganism', attributes.organism, 1);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
  }, [geometry, attributes]);

  useEffect(() => {
    uniforms.uSelectedId.value = selectedId ?? -1;
  }, [selectedId, uniforms]);

  const scratch = useMemo(() => new Object3D(), []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const data = getFrame();
    if (!mesh) return;
    uniforms.uTime.value += reducedMotion ? delta * 0.15 : delta;

    if (!data) return;
    const count = Math.min(MAX_CELLS, data[1] as number);
    mesh.count = count;

    const energyAttr = geometry.getAttribute('aEnergy') as BufferAttribute | undefined;
    const damageAttr = geometry.getAttribute('aDamage') as BufferAttribute | undefined;
    const organAttr = geometry.getAttribute('aOrganism') as BufferAttribute | undefined;

    for (let i = 0; i < count; i++) {
      const o = HEADER_FLOATS + i * CELL_FLOATS;
      const radius = data[o + CELL.RADIUS] as number;
      scratch.position.set(data[o + CELL.X] as number, data[o + CELL.Y] as number, data[o + CELL.Z] as number);
      // Yönelim: simülasyon başlığını hücrenin polar eksenine uygula.
      const hx = data[o + CELL.HEADING_X] as number;
      const hy = data[o + CELL.HEADING_Y] as number;
      const hz = data[o + CELL.HEADING_Z] as number;
      if (hx * hx + hy * hy + hz * hz > 1e-6) {
        const dir = new Vector3(hx, hy, hz).normalize();
        const up = Math.abs(dir.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
        scratch.quaternion.copy(q);
        void up;
      }
      scratch.scale.setScalar(radius);
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);

      if (energyAttr) (energyAttr.array as Float32Array)[i] = data[o + CELL.ENERGY_NORM] as number;
      if (damageAttr) (damageAttr.array as Float32Array)[i] = data[o + CELL.DAMAGE] as number;
      if (organAttr) (organAttr.array as Float32Array)[i] = data[o + CELL.ORGANISM] as number;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (energyAttr) energyAttr.needsUpdate = true;
    if (damageAttr) damageAttr.needsUpdate = true;
    if (organAttr) organAttr.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_CELLS]}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

/**
 * Seçili organizmanın etrafındaki seçim halkası — klavyeyle görünür odak
 * için de kullanılır.
 */
export function SelectionRing(): React.ReactElement | null {
  const ref = useRef<Mesh>(null);
  const selectedId = useStore((s) => s.selectedId);
  const organisms = useStore((s) => s.organisms);

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#E9F0DF'),
        transparent: true,
        opacity: 0.42,
        side: DoubleSide,
        depthWrite: false,
      }),
    [],
  );
  const geometry = useMemo(() => new SphereGeometry(1, 24, 16), []);

  const centroid = useMemo(() => {
    if (selectedId === null) return null;
    return organisms.find((o) => o.id === selectedId)?.centroid ?? null;
  }, [selectedId, organisms]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.visible = centroid !== null;
    if (!centroid) return;
    mesh.position.set(centroid.x, centroid.y, centroid.z);
    const pulse = reducedPulse(state.clock.elapsedTime);
    const r = 0.55 * pulse;
    mesh.scale.setScalar(r);
  });

  if (!centroid) return null;
  return (
    <mesh ref={ref} geometry={geometry} material={material} renderOrder={2}>
      <primitive object={new Matrix4()} attach="matrix" />
    </mesh>
  );
}

function reducedPulse(t: number): number {
  return 1 + 0.08 * Math.sin(t * 2.2);
}

/** Bağlantıları ince, organik görünen borular olarak çizer (instanced). */
const MAX_BONDS = 1024;

export function Bonds(): React.ReactElement {
  const ref = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 8, 6);
    g.scale(1, 1, 1);
    return g;
  }, []);

  const material = useMemo(() => {
    const m = new MeshBasicMaterial({
      color: new Color('#F2BA72'),
      transparent: true,
      opacity: 0.28,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    m.side = DoubleSide;
    return m;
  }, []);

  const scratch = useMemo(() => new Object3D(), []);

  useFrame(() => {
    const mesh = ref.current;
    const data = getFrame();
    if (!mesh) return;
    mesh.count = 0;
    if (!data) return;
    const cellCount = Math.min(MAX_CELLS, data[1] as number);

    // Hücreleri hızlıca eşleştirmek için basit dizin haritası.
    // (Bağlar kare paketinde yok; komşuluk çiftlerini hücre konumlarından kurarız.)
    let drawn = 0;
    const minDist = 1.35;
    const minDistSq = minDist * minDist;
    for (let i = 0; i < cellCount && drawn < MAX_BONDS; i++) {
      const oi = HEADER_FLOATS + i * CELL_FLOATS;
      const xi = data[oi + CELL.X] as number;
      const yi = data[oi + CELL.Y] as number;
      const zi = data[oi + CELL.Z] as number;
      const oi2 = data[oi + CELL.ORGANISM] as number;
      for (let j = i + 1; j < cellCount && drawn < MAX_BONDS; j++) {
        const oj = HEADER_FLOATS + j * CELL_FLOATS;
        if (data[oj + CELL.ORGANISM] !== oi2) continue;
        const dx = (data[oj + CELL.X] as number) - xi;
        const dy = (data[oj + CELL.Y] as number) - yi;
        const dz = (data[oj + CELL.Z] as number) - zi;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > minDistSq || d2 < 1e-6) continue;
        scratch.position.set(xi + dx * 0.5, yi + dy * 0.5, zi + dz * 0.5);
        scratch.scale.setScalar(Math.sqrt(d2) * 0.5 * 0.28 + 0.02);
        scratch.quaternion.setFromUnitVectors(
          new Vector3(0, 1, 0),
          new Vector3(dx, dy, dz).normalize(),
        );
        scratch.updateMatrix();
        mesh.setMatrixAt(drawn++, scratch.matrix);
      }
    }
    mesh.count = drawn;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geometry, material, MAX_BONDS]} frustumCulled={false} />;
}

/** Habitatın dış yüzeyi: koyu, yansımasız bir kabuk (arka plan hissi). */
export function OuterShell({ size }: { size: { x: number; y: number; z: number } }): React.ReactElement {
  const geometry = useMemo(() => new SphereGeometry(1, 24, 16), []);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#04121a'),
        side: BackSide,
        fog: true,
      }),
    [],
  );
  return (
    <mesh scale={[size.x * 2.4, size.x * 2.4, size.x * 2.4]} geometry={geometry} material={material} />
  );
}