/**
 * Cell to Mind — organik hücre zarı malzemesi.
 *
 * Gerçekçilik yaklaşımı:
 *  - Tek bir `InstancedMesh` (yüzlerce hücre → tek çizim çağrısı).
 *  - Vertex shader'da prosedürel zar deformasyonu: hücre "solur", her hücre
 *    kendi fazına sahip. Dönen bir sprite DEĞİLDİR; tam 3B yüzey deformasyonudur.
 *  - Fragment shader'da Fresnel kenar aydınlanması + görüş yönüne bağlı
 *    yarı saydamlık (subsurface benzeri) + enerji/hasar durumuna bağlı renk.
 *  - Durum ayrımı yalnız renkle değil: enerji düşünce zar şişer/çöker,
 *    hasarlı hücrede desen (pattern) belirginleşir. (Renk körlüğü için ayrıca
 *    klavye/arayüz metinleri vardır.)
 */

import {

  Color,
  DoubleSide,
  MeshStandardMaterial,

  type IUniform,
} from 'three';

export const CELL_PALETTE = {
  deep: new Color('#071B22'),
  panel: new Color('#102B33'),
  text: new Color('#E9F0DF'),
  life: new Color('#A8D672'),
  resource: new Color('#F2BA72'),
  damage: new Color('#E58D81'),
  membrane: new Color('#7FD4C1'),
} as const;

/** GLSL: ucuz, hash tabanlı 3B değer gürültüsü + fBm. */
const NOISE_GLSL = /* glsl */ `
float ctmHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ctmNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(ctmHash(i + vec3(0,0,0)), ctmHash(i + vec3(1,0,0)), f.x),
        mix(ctmHash(i + vec3(0,1,0)), ctmHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(ctmHash(i + vec3(0,0,1)), ctmHash(i + vec3(1,0,1)), f.x),
        mix(ctmHash(i + vec3(0,1,1)), ctmHash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float ctmFbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * ctmNoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}
`;

export interface CellMaterialHandle {
  material: MeshStandardMaterial;
  uniforms: Record<string, IUniform>;
}

/**
 * Hücre malzemesi üretir.
 * `onBeforeCompile` ile eklenen shader, temel PBR ışıklandırmayı korur.
 */
export function createCellMaterial(): CellMaterialHandle {
  const material = new MeshStandardMaterial({
    color: CELL_PALETTE.membrane,
    roughness: 0.42,
    metalness: 0.0,
    side: DoubleSide,
  });

  const uniforms: Record<string, IUniform> = {
    uTime: { value: 0 },
    uLifeColor: { value: CELL_PALETTE.life.clone() },
    uDamageColor: { value: CELL_PALETTE.damage.clone() },
    uMembraneColor: { value: CELL_PALETTE.membrane.clone() },
    uDeepColor: { value: CELL_PALETTE.deep.clone() },
    uSelectedId: { value: -1 },
    uRimPower: { value: 2.6 },
    uDeform: { value: 0.16 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        attribute float aPhase;
        attribute float aEnergy;
        attribute float aDamage;
        attribute float aOrganism;
        uniform float uTime;
        uniform float uDeform;
        uniform float uSelectedId;
        varying float vPhase;
        varying float vEnergy;
        varying float vDamage;
        varying float vSelected;
        varying vec3 vLocalPos;
        varying vec3 vWorldNormal;
        ${NOISE_GLSL}
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>

        vPhase = aPhase;
        vEnergy = aEnergy;
        vDamage = aDamage;
        vSelected = (abs(aOrganism - uSelectedId) < 0.5) ? 1.0 : 0.0;
        vLocalPos = position;

        // --- Organik zar deformasyonu -------------------------------------
        // Yuvarlak bir küre yerine canlı, soluk bir yüzey. Deformasyon miktarı
        // enerjiye bağlıdır: yorgun hücre daha sönük ve düzensiz görünür.
        float t = uTime * 1.15 + aPhase * 6.2831;
        float breathe = sin(t) * 0.5 + 0.5;
        vec3 n = normalize(position);
        float organic = ctmFbm(n * 2.3 + aPhase * 3.1 + vec3(0.0, uTime * 0.06, 0.0));
        float amp = uDeform * (0.45 + 0.55 * breathe) * (0.55 + 0.45 * aEnergy);
        transformed += n * (organic - 0.5) * amp;
        // Seçili hücre hafifçe şişer (yumuşak vurgu, oyun kuralı DEĞİLDİR).
        transformed += n * vSelected * 0.06;
        vWorldNormal = normalize(normalMatrix * n);
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform vec3 uLifeColor;
        uniform vec3 uDamageColor;
        uniform vec3 uMembraneColor;
        uniform vec3 uDeepColor;
        uniform float uRimPower;
        varying float vPhase;
        varying float vEnergy;
        varying float vDamage;
        varying float vSelected;
        varying vec3 vLocalPos;
        varying vec3 vWorldNormal;
        ${NOISE_GLSL}
        `,
      )
      .replace(
        '#include <dithering_fragment>',
        /* glsl */ `
        #include <dithering_fragment>

        // --- Yarı saydam zar görünümü ---------------------------------------
        vec3 viewDir = normalize(vViewPosition);
        float fres = pow(1.0 - clamp(dot(normalize(vNormal), viewDir), 0.0, 1.0), uRimPower);

        // Enerji → renk: sağlıklı hücre canlık yeşili, tükenen soluk.
        vec3 base = mix(uMembraneColor, uLifeColor, clamp(vEnergy, 0.0, 1.0));
        base = mix(base, uDeepColor, (1.0 - clamp(vEnergy, 0.0, 1.0)) * 0.55);
        // Hasar → düz kırmızımsı
        base = mix(base, uDamageColor, clamp(vDamage, 0.0, 1.0) * 0.85);

        // Zar iç dokusu: hücre içinde yumuşak damarlar
        float veins = ctmFbm(vLocalPos * 5.5 + vPhase * 9.0);
        // Hasarlı hücrede desen BELIRGINLEŞIR — durum yalnız renkle anlatılmaz.
        // Başlık bu iddiayı taşıyordu ama vDamage yalnız RENK karışımına
        // giriyordu; yani renk körlüğü için önerilen ayrım uygulanmıyordu.
        // Hasarda damarların kontrastı artar: abs(veins - 0.5) * 2 daha keskin
        // bir doku verir.
        float dmg = clamp(vDamage, 0.0, 1.0);
        veins = mix(veins, abs(veins - 0.5) * 2.0, dmg * 0.75);
        base *= 0.86 + 0.28 * veins;

        // Fresnel kenar aydınlanması — sulu zarın imzası
        gl_FragColor.rgb = mix(gl_FragColor.rgb, base * 1.55, 0.42);
        gl_FragColor.rgb += fres * base * 0.85;
        gl_FragColor.rgb += fres * vec3(0.10, 0.22, 0.24);

        // Seçili hücre: ince parlak halka (durum ayrımı renk + desen)
        if (vSelected > 0.5) {
          gl_FragColor.rgb += vec3(0.22, 0.34, 0.30) * fres * 1.2;
        }
        `,
      );

    material.userData.shader = shader;
  };

  // Farklı anahtarlarla yeniden derlenmesini sağla.
  material.customProgramCacheKey = () => 'ctm-cell-v1';

  return { material, uniforms };
}

/** Işık huzmesi (god ray) için additive malzeme. */

