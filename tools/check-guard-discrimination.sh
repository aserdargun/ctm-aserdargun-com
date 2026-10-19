#!/usr/bin/env bash
# Koruma ayırt ediciliği denetimi: her koruma MUTASYONLA kırılmalı.
#
# Kural: yeşil test bir kanıt değildir. Düzeltmeyi geri alıp testin
# **kızardığını** görmeden o korumayı kanıt saymıyoruz.
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0
fail=0

check() {
  local name="$1" file="$2" from="$3" to="$4" test="$5"
  local backup
  backup="$(mktemp)"
  cp "$file" "$backup"
  # ⚠️ **Geri yükleme mtime'ı korumak zorunda.** `cp` dosyanın değiştirme
  # zamanını günceller; bu da rapor tazelik denetimini (rapor, üretim
  # kodundan sonra yeniden üretilmiş mi?) **yanlış** kırmızıya döndürür —
  # oysa içerik birebir aynıdır. Betik ölçüm aracıdır; ağacı kirletmemelidir.
  local stamp
  stamp="$(stat -f %m "$file")"
  # mutasyonu uygula
  python3 - "$file" "$from" "$to" <<'PY'
import sys
path, frm, to = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(path, encoding='utf-8').read()
if frm not in s:
    print("MUTASYON UYGULANAMADI: parça bulunamadı")
    sys.exit(3)
open(path, 'w', encoding='utf-8').write(s.replace(frm, to, 1))
PY
  if [ $? -ne 0 ]; then
    echo "✗ $name — mutasyon uygulanamadı"
    cp "$backup" "$file"; touch -m -t "$(date -r "$stamp" '+%Y%m%d%H%M.%S')" "$file" 2>/dev/null || true
    rm -f "$backup"; fail=$((fail+1)); return
  fi
  if npx vitest run "$test" --reporter=basic >/dev/null 2>&1; then
    echo "✗ $name — mutasyon SONRASI TEST GEÇTİ (koruma ayırt edici DEĞİL)"
    fail=$((fail+1))
  else
    echo "✓ $name — mutasyon sonrası test kızardı (koruma ayırt edici)"
    pass=$((pass+1))
  fi
  cp "$backup" "$file"
  touch -m -t "$(date -r "$stamp" '+%Y%m%d%H%M.%S')" "$file" 2>/dev/null || true
  rm -f "$backup"
}

# 1) Bozuk karakter koruması: evidence.ts'e U+FFFD geri koy
check "U+FFFD taraması" "src/worker/evidence.ts" \
  'interpretations.push(' \
  'interpretations.push("bozuk \uFFFD metin",' \
  "tests/encoding.test.ts"

# 2) Eşik metni koruması: sabiti geri sayıya çevir
check "eşik sayısı metinde" "src/worker/evidence.ts" \
  '`Şu ana kadar ${C.MULTICELL_THRESHOLD} eşiğin üzerinde bağlı küme yok.' \
  "'Şu ana kadar 4 eşiğin üzerinde bağlı küme yok." \
  "tests/encoding.test.ts"

# 3) Ölü sabit koruması: MOBILE_CAPACITY'i geri koy
check "ölü C sabidi" "src/sim/biology/energy.ts" \
  '  STANDARD_CAPACITY: 256,' \
  '  STANDARD_CAPACITY: 256,
  MOBILE_CAPACITY: 96,' \
  "tests/caps.test.ts"

# 4) Tavan koruması: render tavanını ölçülen tepeye yaklaştır
check "3B tavanı yeterli" "src/engine/limits.ts" \
  'export const MAX_RENDER_CELLS = 512;' \
  'export const MAX_RENDER_CELLS = 8;' \
  "tests/caps.test.ts"

# 5) Liste tavanı koruması
check "liste tavanı yeterli" "src/engine/limits.ts" \
  'export const ORGANISM_LIST_LIMIT = 300;' \
  'export const ORGANISM_LIST_LIMIT = 4;' \
  "tests/caps.test.ts"

# 6) Sahne kendi tavanını tanımlıyor (tek kaynak kuralı)
check "sahne tek kaynaktan okuyor" "src/scene/Cells.tsx" \
  "import { MAX_RENDER_CELLS } from '../engine/limits.ts';" \
  "import { MAX_RENDER_CELLS } from '../engine/limits.ts';
const MAX_CELLS = 512;" \
  "tests/caps.test.ts"

# 7) HUD kendi tavanını tanımlıyor
check "HUD tek kaynaktan okuyor" "src/ui/Hud.tsx" \
  "import { MAX_RENDER_CELLS, ORGANISM_LIST_LIMIT } from '../engine/limits.ts';" \
  "import { MAX_RENDER_CELLS, ORGANISM_LIST_LIMIT } from '../engine/limits.ts';
const ORGANISM_LIST_LIMIT = 300;" \
  "tests/caps.test.ts"

# 8) README komut tablosundaki test sayısı bayatlıyor
check "README tablo test sayısı" "README.md" \
  '| `npm test` | Vitest — 286 test |' \
  '| `npm test` | Vitest — 285 test |' \
  "tests/docs.test.ts"

# 9) PROGRESS.md dosya sayısı bayatlıyor
check "PROGRESS dosya sayısı" "docs/PROGRESS.md" \
  '286 test, 12 dosya' \
  '286 test, 10 dosya' \
  "tests/docs.test.ts"

# 10) İngilizce metinde yer tutucu adı kaymış
check "i18n yer tutucu eşleşmesi" "src/i18n/index.ts" \
  'The 3D view shows at most {shown} cells; {total} exist, {hidden} are not shown.' \
  'The 3D view shows at most {shown} cells; {total} exist, {missing} are not shown.' \
  "tests/measurement.test.ts"

# 11) format() bilinmeyen yer tutucuyu sessizce yutuyor
check "format bilinmeyen yer tutucu" "src/i18n/index.ts" \
  "    key in vars ? String(vars[key]) : match," \
  "    key in vars ? String(vars[key]) : ''," \
  "tests/measurement.test.ts"

echo
echo "ayırt edici: $pass · ayırt edici olmayan: $fail"
[ "$fail" -eq 0 ]
