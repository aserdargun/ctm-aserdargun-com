"""
Cell to Mind — prosedürel varlık üretimi (Blender, headless).

KURALLAR
  * Hiçbir dış model indirilmez. Tüm geometri ve dokular bu betikle üretilir;
    dolayısıyla varlık lisansı riski yoktur (bkz. docs/ASSETS.md).
  * Üretilen dosyalar `public/assets/` altına yazılır ve Three.js tarafından
    GLB olarak yüklenir.

ÜRETİLEN VARLIKLAR
  rocks/rock_01..04.glb   Kaya çeşitleri (gürültüyle yer değiştirilmiş ikosfer)
  props/nodule_a.glb      A kaynağı biyofilm düğümü
  props/nodule_b.glb      B kaynağı mineral düğümü
  critters/predator.glb   Avcı gövdesi (seçilim baskısı, öğrenen tür DEĞİL)
  critters/spore.glb      Serbest yüzden tomurcuk/spor
  textures/sediment_n.png Zemin normal haritası
  textures/rock_n.png     Kaya normal haritası

ÇALIŞTIRMA
  npm run assets:build
"""

import math
import os
import random
import sys

import bpy  # type: ignore
import numpy as np
from mathutils import Matrix, Vector  # type: ignore

OUT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
)


# --------------------------------------------------------------------- yardımcılar

def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def value_noise_3d(shape, scale, seed):
    """Basit, tekil (smooth) değer gürültüsü — numpy ile üretilir."""
    rng = np.random.default_rng(seed)
    res = np.zeros(shape, dtype=np.float32)
    amp = 1.0
    total = 0.0
    freq = scale
    for _ in range(5):
        grid = rng.random((freq, freq, freq), dtype=np.float32)
        # Küresel örnekleme için modülo indeksler
        nx, ny, nz = shape
        xs = np.linspace(0, grid.shape[0], nx, endpoint=False, dtype=np.float32)
        ys = np.linspace(0, grid.shape[1], ny, endpoint=False, dtype=np.float32)
        zs = np.linspace(0, grid.shape[2], nz, endpoint=False, dtype=np.float32)
        # Basit üç boyutlu trilineer örnekleme
        xi = xs.astype(np.int32) % grid.shape[0]
        yi = ys.astype(np.int32) % grid.shape[1]
        zi = zs.astype(np.int32) % grid.shape[2]
        xf = xs - xi
        yf = ys - yi
        zf = zs - zi
        # yumuşatma
        sx = xf * xf * (3 - 2 * xf)
        sy = yf * yf * (3 - 2 * yf)
        sz = zf * zf * (3 - 2 * zf)

        def lerp(a, b, t):
            return a + (b - a) * t

        c000 = grid[np.ix_(zi, yi, xi)]
        c001 = grid[np.ix_(zi, yi, (xi + 1) % grid.shape[0])]
        c010 = grid[np.ix_(zi, (yi + 1) % grid.shape[1], xi)]
        c011 = grid[np.ix_(zi, (yi + 1) % grid.shape[1], (xi + 1) % grid.shape[0])]
        c100 = grid[np.ix_((zi + 1) % grid.shape[2], yi, xi)]
        c101 = grid[np.ix_((zi + 1) % grid.shape[2], yi, (xi + 1) % grid.shape[0])]
        c110 = grid[np.ix_((zi + 1) % grid.shape[2], (yi + 1) % grid.shape[1], xi)]
        c111 = grid[np.ix_((zi + 1) % grid.shape[2], (yi + 1) % grid.shape[1], (xi + 1) % grid.shape[0])]

        c00 = lerp(c000, c001, sx)
        c01 = lerp(c010, c011, sx)
        c10 = lerp(c100, c101, sx)
        c11 = lerp(c110, c111, sx)
        c0 = lerp(c00, c01, sy)
        c1 = lerp(c10, c11, sy)
        val = lerp(c0, c1, sz) - 0.5
        res += val * amp
        total += amp
        amp *= 0.5
        freq *= 2
    return res / max(total, 1e-6)


def displacement_field(coords, seed, octaves=5, lacunarity=2.0, gain=0.5, scale=6.0):
    """Koordinat dizisinden fraktal gürültü alanı üretir."""
    mn = coords.min(axis=0)
    mx = coords.max(axis=0)
    norm = (coords - mn) / np.maximum(mx - mn, 1e-6)
    rng = np.random.default_rng(seed)
    total = np.zeros(len(coords), dtype=np.float32)
    amp = 1.0
    freq = scale
    acc = 0.0
    for _ in range(octaves):
        freq_i = max(2, int(freq))
        grid = rng.random((freq_i, freq_i, freq_i), dtype=np.float32)
        gx = np.clip((norm[:, 0] * (freq_i - 1)).astype(np.int32), 0, freq_i - 1)
        gy = np.clip((norm[:, 1] * (freq_i - 1)).astype(np.int32), 0, freq_i - 1)
        gz = np.clip((norm[:, 2] * (freq_i - 1)).astype(np.int32), 0, freq_i - 1)
        fx = norm[:, 0] * (freq_i - 1) - gx
        fy = norm[:, 1] * (freq_i - 1) - gy
        fz = norm[:, 2] * (freq_i - 1) - gz
        sx = fx * fx * (3 - 2 * fx)
        sy = fy * fy * (3 - 2 * fy)
        sz = fz * fz * (3 - 2 * fz)

        def lerp(a, b, t):
            return a + (b - a) * t

        c000 = grid[gz, gy, gx]
        c001 = grid[gz, gy, np.minimum(gx + 1, freq_i - 1)]
        c010 = grid[gz, np.minimum(gy + 1, freq_i - 1), gx]
        c011 = grid[gz, np.minimum(gy + 1, freq_i - 1), np.minimum(gx + 1, freq_i - 1)]
        c100 = grid[np.minimum(gz + 1, freq_i - 1), gy, gx]
        c101 = grid[np.minimum(gz + 1, freq_i - 1), gy, np.minimum(gx + 1, freq_i - 1)]
        c110 = grid[np.minimum(gz + 1, freq_i - 1), np.minimum(gy + 1, freq_i - 1), gx]
        c111 = grid[
            np.minimum(gz + 1, freq_i - 1),
            np.minimum(gy + 1, freq_i - 1),
            np.minimum(gx + 1, freq_i - 1),
        ]
        c00 = lerp(c000, c001, sx)
        c01 = lerp(c010, c011, sx)
        c10 = lerp(c100, c101, sx)
        c11 = lerp(c110, c111, sx)
        total += lerp(lerp(c00, c01, sy), lerp(c10, c11, sy), sz) * amp
        acc += amp
        amp *= gain
        freq *= lacunarity
    return total / max(acc, 1e-6)


def displace_icosphere(name, radius, seed, amp, squash, subdiv=4, ridged=False):
    """Gürültüyle yer değiştirilmiş ikosfer üretir ve mesh nesnesini döndürür."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1.0, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    me = obj.data
    n = len(me.vertices)
    coords = np.empty(n * 3, dtype=np.float64)
    me.vertices.foreach_get("co", coords)
    coords = coords.reshape(n, 3)

    field = displacement_field(coords, seed, octaves=5, scale=3.0 + seed % 3)
    if ridged:
        field = 1.0 - np.abs(field) * 2.0
        field = np.clip(field, -1.0, 1.0)

    dirs = coords / np.maximum(np.linalg.norm(coords, axis=1, keepdims=True), 1e-9)
    scale = radius * (1.0 + field * amp)
    new_coords = dirs * scale[:, np.newaxis]

    # Alt kısmı düzleştir: kaya zeminin üzerinde otursun.
    flat = new_coords[:, 1] < -radius * squash
    new_coords[flat, 1] = -radius * squash

    me.vertices.foreach_set("co", new_coords.ravel())
    me.update()
    bpy.ops.object.shade_smooth()
    return obj


def add_subsurf(obj, level=1):
    mod = obj.modifiers.new(name="Subdivision", type="SUBSURF")
    mod.levels = level
    mod.render_levels = level


def export_glb(obj, path, apply_modifiers=True):
    ensure_dir(os.path.dirname(path))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=apply_modifiers,
        export_materials="EXPORT",
        export_yup=True,
    )
    size = os.path.getsize(path)
    print(f"  ✔ {os.path.relpath(path, OUT_ROOT)}  ({size/1024:.1f} KiB)")


def clear_objects():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


# ------------------------------------------------------------------ kaya üretimi

def build_rocks():
    print("Kayalar üretiliyor…")
    out = ensure_dir(os.path.join(OUT_ROOT, "rocks"))
    specs = [
        # (ad, yarıçap, tohum, genlik, ezme, ridged, subdiv)
        ("rock_01", 1.00, 11, 0.34, 0.55, True, 4),
        ("rock_02", 1.00, 29, 0.28, 0.42, False, 4),
        ("rock_03", 1.00, 47, 0.40, 0.70, True, 3),
        ("rock_04", 1.00, 83, 0.22, 0.35, False, 4),
    ]
    for name, radius, seed, amp, squash, ridged, subdiv in specs:
        clear_objects()
        main = displace_icosphere(name, radius, seed, amp, squash, subdiv=subdiv, ridged=ridged)
        # Kayaya birkaç uydu bloğu ekle: tek parça düzgün küre görünmesin.
        rng = random.Random(seed)
        satellites = []
        for _ in range(3):
            sub = displace_icosphere(
                f"{name}_sat{rng.randint(0, 9999)}",
                radius * rng.uniform(0.22, 0.46),
                seed + rng.randint(1, 500),
                amp * 1.2,
                squash,
                subdiv=2,
                ridged=ridged,
            )
            sub.location = (
                Vector(main.data.vertices[0].co) * rng.uniform(0.45, 0.8)
                + Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.3, 0.1), rng.uniform(-0.25, 0.25)))
            )
            satellites.append(sub)
        # Uydu blokları ana bloğa katı: tek bir yüzey olarak dışa aktarılır.
        for sub in satellites:
            bpy.ops.object.select_all(action="DESELECT")
            main.select_set(True)
            sub.select_set(True)
            bpy.context.view_layer.objects.active = main
            bpy.ops.object.join()
            main = bpy.context.active_object
        bpy.ops.object.shade_smooth()
        export_glb(main, os.path.join(out, f"{name}.glb"))
        clear_objects()


# --------------------------------------------------------- kaynak düğümleri

def build_nodules():
    print("Kaynak düğümleri üretiliyor…")
    out = ensure_dir(os.path.join(OUT_ROOT, "props"))

    # A: yumuşak biyofilm kümesi — birleşik düğümler
    clear_objects()
    rng = random.Random(7)
    core = displace_icosphere("nodule_a", 1.0, 5, 0.18, 0.25, subdiv=3)
    blobs = []
    for _ in range(5):
        sub = displace_icosphere(
            f"nodule_a_b{rng.randint(0, 9999)}", rng.uniform(0.28, 0.55), rng.randint(1, 900), 0.16, 0.2, subdiv=2
        )
        theta = rng.uniform(0, math.tau)
        phi = math.acos(rng.uniform(-1, 1))
        d = rng.uniform(0.55, 0.85)
        sub.location = (
            d * math.sin(phi) * math.cos(theta),
            d * math.cos(phi) * 0.7,
            d * math.sin(phi) * math.sin(theta),
        )
        blobs.append(sub)
    for sub in blobs:
        bpy.ops.object.select_all(action="DESELECT")
        core.select_set(True)
        sub.select_set(True)
        bpy.context.view_layer.objects.active = core
        bpy.ops.object.join()
        core = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    export_glb(core, os.path.join(out, "nodule_a.glb"))
    clear_objects()

    # B: keskin mineral kristal kümesi
    crystal = bpy.data.meshes.new("nodule_b")
    crystal.from_pydata(
        [
            (0, 1.15, 0),
            (0.42, 0.28, 0.22),
            (0.12, 0.28, 0.40),
            (-0.38, 0.28, 0.18),
            (-0.16, 0.28, -0.36),
            (0, 0.10, 0),
        ],
        [],
        [
            (0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1),
            (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4),
        ],
    )
    crystal.update()
    crystal.calc_loop_triangles()
    obj = bpy.data.objects.new("nodule_b", crystal)
    bpy.context.collection.objects.link(obj)
    export_glb(obj, os.path.join(out, "nodule_b.glb"))
    clear_objects()


# -------------------------------------------------------------------- canlılar

def build_predator():
    print("Avcı üretiliyor…")
    out = ensure_dir(os.path.join(OUT_ROOT, "critters"))
    clear_objects()

    # Uzamış, sivri uçlu bir gövde: seçilim baskısının görsel aracı.
    rings = 26
    segs = 18
    verts = []
    faces = []
    for i in range(rings):
        t = i / (rings - 1)
        # Burulmuş profille su damlası biçimi
        r = math.sin(math.pi * t) ** 0.62 * (1.0 - 0.25 * t)
        y = (t - 0.5) * 2.0
        twist = t * math.pi * 1.6
        for j in range(segs):
            a = math.tau * j / segs + twist
            verts.append((r * math.cos(a), y, r * math.sin(a)))
    for i in range(rings - 1):
        for j in range(segs):
            a = i * segs + j
            b = i * segs + (j + 1) % segs
            c = (i + 1) * segs + j
            d = (i + 1) * segs + (j + 1) % segs
            faces.append((a, c, d))
            faces.append((a, d, b))
    me = bpy.data.meshes.new("predator")
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new("predator", me)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.shade_smooth()
    add_subsurf(obj, 1)
    export_glb(obj, os.path.join(out, "predator.glb"))
    clear_objects()


def build_spore():
    print("Spor üretiliyor…")
    out = ensure_dir(os.path.join(OUT_ROOT, "critters"))
    clear_objects()
    obj = displace_icosphere("spore", 1.0, 202, 0.12, 0.0, subdiv=3)
    # Yüzeyi hafifçe çukurlaştır: hücre zarı hissi.
    bpy.ops.object.shade_smooth()
    export_glb(obj, os.path.join(out, "spore.glb"))
    clear_objects()


# -------------------------------------------------------------------- dokular

def save_normal_map(path, height, strength=2.0):
    """Yükseklik alanından tangent uzayında normal haritası üretir."""
    ensure_dir(os.path.dirname(path))
    h = np.asarray(height, dtype=np.float32)
    # Merkezi farkla yükseklik gradyanı
    gy, gx = np.gradient(h)
    nx = -gx * strength
    ny = -gy * strength
    nz = np.ones_like(h)
    n = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / n, ny / n, nz / n
    h_img, w_img = h.shape
    rgba = np.zeros((h_img, w_img, 4), dtype=np.float32)
    rgba[..., 0] = nx * 0.5 + 0.5
    rgba[..., 1] = ny * 0.5 + 0.5
    rgba[..., 2] = nz * 0.5 + 0.5
    rgba[..., 3] = 1.0

    img = bpy.data.images.new(
        os.path.basename(path), width=w_img, height=h_img, alpha=True, float_buffer=True
    )
    # Blender görüntü pikseli satır-öncelikli soldan sağa.
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    print(f"  ✔ {os.path.relpath(path, OUT_ROOT)}  ({w_img}x{h_img})")


def upsample(arr, factor):
    """Düşük çözünürlüklü gürültüyü bilineer enterpolasyonla büyütür."""
    h, w = arr.shape
    ys = np.linspace(0, h - 1, h * factor)
    xs = np.linspace(0, w - 1, w * factor)
    y0 = np.floor(ys).astype(np.int32)
    x0 = np.floor(xs).astype(np.int32)
    y1 = np.minimum(y0 + 1, h - 1)
    x1 = np.minimum(x0 + 1, w - 1)
    fy = (ys - y0)[:, None]
    fx = (xs - x0)[None, :]
    a00 = arr[np.ix_(y0, x0)]
    a01 = arr[np.ix_(y0, x1)]
    a10 = arr[np.ix_(y1, x0)]
    a11 = arr[np.ix_(y1, x1)]
    top = a00 + (a01 - a00) * fx
    bot = a10 + (a11 - a10) * fx
    return top + (bot - top) * fy


def build_textures():
    print("Dokular üretiliyor…")
    out = ensure_dir(os.path.join(OUT_ROOT, "textures"))
    size = 512
    rng = np.random.default_rng(1234)
    # Zemin: ince kum dalgacıkları + ara sıra çakıl kabartması
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    field = np.sin((xx * 9.0 + np.sin(yy * 5.0) * 0.9) * math.tau) * 0.5
    field += np.sin((yy * 14.0 + np.cos(xx * 7.0) * 0.7) * math.tau) * 0.32
    field += (rng.random((size, size), dtype=np.float32) - 0.5) * 0.55
    field += upsample(rng.random((size // 8, size // 8), dtype=np.float32) - 0.5, 8) * 1.1
    save_normal_map(os.path.join(out, "sediment_n.png"), field.astype(np.float32), strength=3.4)

    # Kaya: keskin, pürüzlü çok ölçekli yüzey
    rock = (rng.random((size, size), dtype=np.float32) - 0.5) * 1.6
    rock += upsample(rng.random((size // 4, size // 4), dtype=np.float32) - 0.5, 4) * 1.4
    rock += upsample(rng.random((size // 16, size // 16), dtype=np.float32) - 0.5, 16) * 1.0
    save_normal_map(os.path.join(out, "rock_n.png"), rock.astype(np.float32), strength=4.2)


# ------------------------------------------------------------------------ main

def main() -> int:
    print("=" * 62)
    print("Cell to Mind — prosedürel varlık üretimi")
    print("=" * 62)
    reset_scene()
    build_rocks()
    build_nodules()
    build_predator()
    build_spore()
    build_textures()
    print("=" * 62)
    print("Tamamlandı. Varlıklar:", OUT_ROOT)
    return 0


if __name__ == "__main__":
    sys.exit(main())