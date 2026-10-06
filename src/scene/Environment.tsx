/**
 * Cell to Mind — su mikrohabitatı çevresi.
 *
 * Gerçekçilik katmanları (hepsi prosedürel, dış doku indirilmez):
 *  - Derin su sisi (exp2) — mesafe duyusu
 *  - Zeminde hareketli kaustik (ışık kırılımı benzeri) deseni
 *  - Yüzeyden inen ışık huzmeleri (god rays)
 *  - Deniz karı (marine snow) parçacıkları
 *  - Blender'dan üretilmiş normal haritalarıyla kum/kaya dokusu
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from 'three';
import { useStore } from '../engine/store.ts';

const PALETTE = {
  deep: '#071B22',
  panel: '#102B33',
  text: '#E9F0DF',
  life: '#A8D672',
  resource: '#F2BA72',
  damage: '#E58D81',
} as const;

/** Kaustik + kum deseni taşıyan zemin malzemesi. */
function useSedimentMaterial(): { material: MeshStandardMaterial; uniforms: Record<string, { value: number }> } {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uLight: { value: 0.62 } }), []);
  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: new Color('#1d434c'),
      roughness: 0.94,
      metalness: 0.0,
      side: DoubleSide,
    });
    const loader = new TextureLoader();
    loader.load('assets/textures/sediment_n.png', (tex: Texture) => {
      tex.wrapS = RepeatWrapping;
      tex.wrapT = RepeatWrapping;
      tex.repeat.set(6, 4);
      tex.colorSpace = SRGBColorSpace;
      mat.normalMap = tex;
      mat.normalScale = new Vector2(0.7, 0.7);
      mat.needsUpdate = true;
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvWorld = (modelMatrix * vec4(position, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uTime;
          uniform float uLight;
          varying vec3 vWorld;
          float causticLayer(vec2 p, float t) {
            // Üç etkileşen dalga bandı: su yüzeyinden süzülen ışığın
            // zeminde oluşturduğu hareketli ağ deseni.
            float v = 0.0;
            for (int i = 0; i < 3; i++) {
              float fi = float(i);
              vec2 dir = vec2(cos(fi * 2.1), sin(fi * 1.7));
              float w = sin(dot(p, dir) * (5.0 + fi * 2.3) + t * (0.7 + fi * 0.23));
              v += w;
            }
            v = v / 3.0;
            return pow(max(0.0, v), 3.0);
          }
          `,
        )
        .replace(
          '#include <dithering_fragment>',
          /* glsl */ `
          #include <dithering_fragment>
          float c = causticLayer(vWorld.xz * 0.55, uTime * 0.35);
          float c2 = causticLayer(vWorld.xz * 1.3 + 11.0, uTime * 0.22);
          float caust = clamp(c * 0.75 + c2 * 0.45, 0.0, 1.0);
          // Işık şiddeti oyuncu tarafından ayarlanır; karanlıkta kaybolur.
          gl_FragColor.rgb += vec3(0.22, 0.42, 0.42) * caust * uLight * 1.8;
          `,
        );
    };
    mat.customProgramCacheKey = () => 'ctm-sediment-v1';
    return mat;
  }, [uniforms]);
  return { material, uniforms };
}

export function HabitatFloor({
  size,
}: {
  size: { x: number; y: number; z: number };
}): React.ReactElement {
  const { material, uniforms } = useSedimentMaterial();
  const light = useStore((s) => s.settings.light);

  useFrame((state, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uLight.value = light;
    void state;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[size.x / 2, 0, size.z / 2]} receiveShadow>
      <planeGeometry args={[size.x, size.z, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Habitatın kapalı duvarları — dışarı çıkmayı engelleyen görsel sınır. */
export function HabitatWalls({
  size,
}: {
  size: { x: number; y: number; z: number };
}): React.ReactElement {
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#0b2029'),
        roughness: 1,
        metalness: 0,
        side: BackSide,
        transparent: true,
        opacity: 0.92,
      }),
    [],
  );
  return (
    <mesh position={[size.x / 2, size.y / 2, size.z / 2]} material={material}>
      <boxGeometry args={[size.x, size.y, size.z]} />
    </mesh>
  );
}

/** Yüzeyden süzülen ışık huzmeleri. */
export function LightShafts({
  size,
  count = 6,
}: {
  size: { x: number; y: number; z: number };
  count?: number;
}): React.ReactElement {
  const ref = useRef<Group>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const shafts = useMemo(() => {
    const out: { pos: [number, number, number]; rot: [number, number, number]; scale: [number, number, number] }[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        // Her huzme deterministik olarak konumlandırılır (kare başına yeniden
        // hesaplanmaz).
        pos: [size.x * (0.12 + 0.76 * ((i * 0.37) % 1)), size.y * 0.52, size.z * (0.12 + 0.76 * ((i * 0.61) % 1))],
        rot: [0.08 * Math.sin(i * 2.3), (i * 1.7) % Math.PI, 0.1 * Math.cos(i * 1.9)],
        scale: [1.1 + (i % 3) * 0.55, size.y * 1.15, 1.1 + ((i + 1) % 3) * 0.55],
      });
    }
    return out;
  }, [count, size]);

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: new Color('#8fd9d0'),
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vY;')
        .replace(
          '#include <dithering_fragment>',
          /* glsl */ `
          #include <dithering_fragment>
          float flicker = 0.72 + 0.28 * sin(uTime * 0.55 + vY * 1.7);
          gl_FragColor.a *= flicker;
          `,
        );
    };
    mat.customProgramCacheKey = () => 'ctm-shafts-v1';
    return mat;
  }, [uniforms]);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    if (ref.current && !useStore.getState().reducedMotion) {
      ref.current.rotation.y += delta * 0.004;
    }
  });

  return (
    <group ref={ref}>
      {shafts.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={s.rot} scale={s.scale} material={material}>
          <cylinderGeometry args={[1, 1.9, 1, 10, 1, true]} />
        </mesh>
      ))}
    </group>
  );
}

/** Deniz karı: suda asılı küçük parçacıklar. */
export function MarineSnow({
  size,
  count = 1400,
}: {
  size: { x: number; y: number; z: number };
  count?: number;
}): React.ReactElement {
  const ref = useRef<Points>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);

  const { geometry, material, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speedArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = Math.random() * size.x;
      positions[i * 3 + 1] = Math.random() * size.y;
      positions[i * 3 + 2] = Math.random() * size.z;
      speedArr[i] = 0.12 + Math.random() * 0.36;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const m = new PointsMaterial({
      color: new Color('#cfe6dd'),
      size: 0.028,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    return { geometry: g, material: m, speeds: speedArr };
  }, [count, size]);

  useFrame((state, delta) => {
    const points = ref.current;
    if (!points) return;
    const dt = reducedMotion ? delta * 0.2 : delta;
    const pos = geometry.getAttribute('position') as Float32BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      // Yavaşça aşağı süzülür, zemine değince yukarı döner.
      arr[i * 3 + 1] = (arr[i * 3 + 1] as number) - (speeds[i] as number) * dt;
      arr[i * 3] = (arr[i * 3] as number) + Math.sin(t * 0.3 + i) * dt * 0.05;
      arr[i * 3 + 2] = (arr[i * 3 + 2] as number) + Math.cos(t * 0.22 + i * 0.7) * dt * 0.04;
      if ((arr[i * 3 + 1] as number) < 0.02) arr[i * 3 + 1] = size.y;
      if ((arr[i * 3] as number) > size.x) arr[i * 3] = 0;
      if ((arr[i * 3] as number) < 0) arr[i * 3] = size.x;
      if ((arr[i * 3 + 2] as number) > size.z) arr[i * 3 + 2] = 0;
      if ((arr[i * 3 + 2] as number) < 0) arr[i * 3 + 2] = size.z;
    }
    pos.needsUpdate = true;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}

type Group = import('three').Group;

export const HABITAT_PALETTE = PALETTE;