#!/usr/bin/env bash
# Koruma ayırt ediciliği denetimi: her koruma MUTASYONLA kırılmalı.
#
# Kural: yeşil test bir kanıt değildir. Düzeltmeyi geri alıp testin
# **kızardığını** görmeden o korumayı kanıt saymıyoruz.
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0
fail=0

# ⚠️ Hedef sayılar **türetilir**, elle yazılmaz. Elle yazılan hedefler her
# yeni test eklendiğinde bayatlıyor ve "mutasyon uygulanamadı" hatası
# korumanın çalışmadığı anlamına geliyordu (kendim iki kez bunu yaşadım).
UNIT="$(node -e '
const fs=require("node:fs"),path=require("node:path");
let n=0; for (const f of fs.readdirSync("tests")) if (f.endsWith(".test.ts"))
  n += (fs.readFileSync(path.join("tests",f),"utf8").match(/^\s*it\(/gm)||[]).length;
console.log(n);
')"
FILES="$(node -e '
const fs=require("node:fs");
console.log(fs.readdirSync("tests").filter(f=>f.endsWith(".test.ts")).length);
')"
# ⚠️ Belge hedefleri de **belgeden** türetilir. Koddan türetmek yanlıştı:
# koruma tam da belgenin bayatlamasını yakaladığı için, kod doğruyken bile
# belge eskiyse hedef "bulunamadı" hatası veriyordu.
README_RUNS="$(grep -oE 'Vitest — [0-9]+ test' README.md | grep -oE '[0-9]+' | head -1)"
PROGRESS_RUNS="$(grep -oE '[0-9]+ test, [0-9]+ dosya' docs/PROGRESS.md | grep -oE '[0-9]+' | head -1)"
PROGRESS_FILES="$(grep -oE '[0-9]+ test, [0-9]+ dosya' docs/PROGRESS.md | grep -oE '[0-9]+' | tail -1)"
echo "hedef sayılar türetildi: $UNIT test / $FILES dosya · README $README_RUNS · PROGRESS $PROGRESS_RUNS/$PROGRESS_FILES"
# §1.x alt başlık sayısı **belgeden** türetilir: her yeni test bu sayıyı
# değiştirdiği için elle hedef yazmak bayatlıyordu.
VALIDATION_WORLD_TESTS="$(grep -oE '\`tests/world\.test\.ts\`, [0-9]+ test' docs/VALIDATION.md | grep -oE '[0-9]+' | head -1)"

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
check "eşik sayısı metinde" "src/i18n/observerSummary.ts" \
  "{threshold} eşiğin üzerinde bağlı küme yok" \
  "4 eşiğin üzerinde bağlı küme yok" \
  "tests/measurement.test.ts"

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
  "  MAX_RENDER_CELLS,
  MAX_RENDER_RESOURCES,
  ORGANISM_LIST_LIMIT,
} from '../engine/limits.ts';" \
  "  MAX_RENDER_CELLS,
  MAX_RENDER_RESOURCES,
  ORGANISM_LIST_LIMIT,
} from '../engine/limits.ts';
const ORGANISM_LIST_LIMIT = 300;" \
  "tests/caps.test.ts"

# 8) README komut tablosundaki test sayısı bayatlıyor
check "README tablo test sayısı" "README.md" \
  "| \`npm test\` | Vitest — ${README_RUNS} test |" \
  "| \`npm test\` | Vitest — $((README_RUNS - 1)) test |" \
  "tests/docs.test.ts"

# 9) PROGRESS.md dosya sayısı bayatlıyor
check "PROGRESS dosya sayısı" "docs/PROGRESS.md" \
  "${PROGRESS_RUNS} test, ${PROGRESS_FILES} dosya" \
  "${PROGRESS_RUNS} test, $((PROGRESS_FILES - 2)) dosya" \
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

# 12) Soy paneli kendi gösterim sınırını yazıyor
check "soy paneli ortak sınırı kullanıyor" "src/ui/Panels.tsx" \
  "lineages.slice(0, LINEAGE_DISPLAY_LIMIT)" \
  "lineages.slice(0, 12)" \
  "tests/caps.test.ts"

# 13) Simülasyon soy gruplamasını elle yazıyor
check "simülasyon ortak sabiti kullanıyor" "src/sim/world.ts" \
  "founders.length / FOUNDER_LINEAGE_GROUPS" \
  "founders.length / 12" \
  "tests/caps.test.ts"

# 14) Gözlemci paneli iddia tablosunu elle sınırlıyor
check "iddia tablosu ortak sabiti kullanıyor" "src/ui/Panels.tsx" \
  "r.claims.slice(0, OBSERVER_CLAIM_LIMIT)" \
  "r.claims.slice(0, 20)" \
  "tests/caps.test.ts"

# 15) Gözlemci paneli ölçüm tablosunu elle sınırlıyor
check "ölçüm tablosu ortak sabiti kullanıyor" "src/ui/Panels.tsx" \
  "evidence.measurements.slice(0, OBSERVER_MEASUREMENT_LIMIT)" \
  "evidence.measurements.slice(0, 24)" \
  "tests/caps.test.ts"

# 16) RNG akış sayısı bayatlıyor (kaynak modül)
check "RNG akış sayısı kaynakta" "src/sim/rng.ts" \
  "simülasyonun **dört** ayrı rastgele akışı vardır" \
  "simülasyonun **üç** ayrı rastgele akışı vardır" \
  "tests/measurement.test.ts"

# 17) RNG akış sayısı bayatlıyor (model belgesi)
check "RNG akış sayısı MODEL.md'de" "docs/MODEL.md" \
  "**Dört** ayrı RNG akışı vardır" \
  "**Üç** ayrı RNG akışı vardır" \
  "tests/measurement.test.ts"

# 18) Ağ parametre sayısı belgede bayatlıyor
check "parametre sayısı MODEL.md'de" "docs/MODEL.md" \
  "Parametre | \`12·8 + 8 + 8·4 + 4 = \` **140**" \
  "Parametre | \`12·8 + 8 + 8·4 + 4 = \` **120**" \
  "tests/measurement.test.ts"

# 19) Ağ parametre sayısı ARAYÜZDE bayatlıyor (kullanıcıya görünen metin)
check "parametre sayısı arayüzde" "src/i18n/index.ts" \
  "140 parametreli ağdan AYRIDIR" \
  "120 parametreli ağdan AYRIDIR" \
  "tests/measurement.test.ts"

# 20) Arayüzün MİMARİ tanımındaki bağlantı sayısı bayatlıyor
check "mimari tanımı arayüzde" "src/i18n/index.ts" \
  "128 ağırlıklı bağlantı · 12 bias · 24 birim" \
  "120 ağırlıklı bağlantı · 12 bias · 24 birim" \
  "tests/measurement.test.ts"

# 21) VALIDATION §1 özet bloğu bayatlıyor
check "§1 özet bloğu" "docs/VALIDATION.md" \
  "Test Files  12 passed (12)" \
  "Test Files  11 passed (11)" \
  "tests/docs.test.ts"

# 22) VALIDATION §1.x alt başlığındaki dosya bazlı sayı bayatlıyor
check "§1 alt başlık sayısı" "docs/VALIDATION.md" \
  "\`tests/world.test.ts\`, ${VALIDATION_WORLD_TESTS} test" \
  "\`tests/world.test.ts\`, $((VALIDATION_WORLD_TESTS - 1)) test" \
  "tests/docs.test.ts"

# 23) Paylaşma eşiği okuması bayat cümleyi geri getiriyor
# ⚠️ Hedef metin hem backtick hem tek tırnak içeriyor; kabukta tek tırnak
# içinde yazılır, içteki tek tırnak '\'' ile kaçırılır.
check "paylaşma okuması veriden türüyor" "src/sim/experiments/ecology.ts" \
  '` Enerji korunumu |${firstLive.worstLedgerResidual.toExponential(1)}|.`' \
  '` Varsayılan 0,82'\''de aktarım **0**. Enerji korunumu |${firstLive.worstLedgerResidual.toExponential(1)}|.`' \
  "tests/measurement.test.ts"

# 24) Dünya içi evrim hükümü gürültü tabanını düşmüyor
check "net etki hükümü" "src/sim/experiments/index.ts" \
  "const net = treatment.gain - control.gain;" \
  "const net = treatment.gain;" \
  "tests/measurement.test.ts"

# 25) Okuma metni verinin yönünün TERSİNİ iddia ediyor
check "okuma yönü veriden" "src/sim/experiments/ecology.ts" \
  "const dir = lowest.transfers > firstLive.transfers ? 'artırıyor' : 'azaltıyor';" \
  "const dir = 'artırıyor';" \
  "tests/measurement.test.ts"

# 26) İşaretli sayı biçimi çift işaret üretiyor
check "işaretli sayı biçimi" "src/sim/stats.ts" \
  "  return value > 0 ? \`+\${s}\` : s;" \
  "  return \`+\${s}\`;" \
  "tests/measurement.test.ts"

# 27) Koşucunun ilerleme paydası adım sayısıyla eşleşmiyor
check "ilerleme paydası" "scripts/run-experiments.ts" \
  "const TOTAL_STEPS = 31;" \
  "const TOTAL_STEPS = 30;" \
  "tests/docs.test.ts"

# 28) Yeni bölümün SINIRI rapordan düşüyor
check "yeni bölüm sınırı raporda" "scripts/run-experiments.ts" \
  "· **Güven aralığı YOK**: bu bir tarama, fark testi değil." \
  "· Bu bir tarama, fark testi değil." \
  "tests/docs.test.ts"

# 29) Yeni bölümün SINIRI rapordan düşüyor (dünya içi evrim)
check "dünya içi evrim sınırı raporda" "scripts/run-experiments.ts" \
  "⚠️ **SINIR: TEK tohum, güven aralığı YOK.**" \
  "Ölçüm yapıldı." \
  "tests/docs.test.ts"

# 30) Kanonik modülün kendi başlığı bayatlıyor (mlp.ts parametre sayısı)
check "mlp.ts başlığı parametre sayısı" "src/sim/behavior/mlp.ts" \
  "12*8 + 8 + 8*4 + 4 = **140**" \
  "12*8 + 8 + 8*4 + 4 = **130**" \
  "tests/measurement.test.ts"

# 31) Algı vektörünün boyutu bayatlıyor
check "perception.ts gözlem boyutu" "src/sim/behavior/perception.ts" \
  "12 girdili gözlem vektörü" \
  "14 girdili gözlem vektörü" \
  "tests/measurement.test.ts"

# 32) Uygulama başlangıç popülasyonunu elle yazıyor
check "başlangıç popülasyonu sabitten" "src/App.tsx" \
  "population: C.DEFAULT_POPULATION," \
  "population: 48," \
  "tests/measurement.test.ts"

# 33) Arayüzün çok hücrelilik eşiği sayıyı elle yazıyor
check "eşik metni yer tutucuda" "src/i18n/index.ts" \
  "eşiği: {n}+ hücreli yapı." \
  "eşiği: 4+ hücreli yapı." \
  "tests/measurement.test.ts"

# 34) Sahne kaynak tavanını elle yazıyor
check "sahne kaynak tavanı sabitten" "src/scene/Props.tsx" \
  "args={[geoA, matA, MAX_RENDER_RESOURCES]}" \
  "args={[geoA, matA, 64]}" \
  "tests/measurement.test.ts"

# 35) Ölü dışa aktarım kalıyor
check "ölü dışa aktarım yok" "src/sim/genome.ts" \
  "export function founderGenomes" \
  "export function founderGenomesUnused" \
  "tests/measurement.test.ts"

# 36) Belge kendi içinde çelişiyor (§6.15 yeni ölçüme atıf yapmıyor)
check "belge kendisiyle çelişmiyor" "docs/VALIDATION.md" \
  "Düzeltilmiş hâliyle ölçüm **karşılaştırılabilir** ve olumlu" \
  "Düzeltilmiş hâliyle ölçüm **karşılaştırılamaz** ve olumsuz" \
  "tests/docs.test.ts"

# 37) Arayüzün gönderdiği komutun worker karşılığı yok (sessizce düşer)
check "komut yüzeyi tam" "src/worker/sim.worker.ts" \
  "    case 'setSpeed':" \
  "    case 'setSpeedYeni':" \
  "tests/measurement.test.ts"

# 38) Worker'da kimsenin göndermediği ölü bir işleyici
check "ölü worker işleyicisi yok" "src/worker/sim.worker.ts" \
  "    case 'requestDecision': {" \
  "    case 'requestDecisionEski': {" \
  "tests/measurement.test.ts"

# 39) Enerji korunumu kapısı kaldırıldı (vaat uygulanmıyor)
check "enerji korunumu kapısı var" "scripts/run-experiments.ts" \
  "const RESIDUAL_LIMIT = 1e-3;" \
  "const RESIDUAL_LIMIT = 1e-3; // kapı yok" \
  "tests/measurement.test.ts"

# 40) Kapı ihlalde raporu yazıyor (geçersiz sayılar yayımlanır)
check "kapı ihlalde rapor yazılmıyor" "scripts/run-experiments.ts" \
  "Rapor YAZILMADI." \
  "Rapor yazıldı." \
  "tests/measurement.test.ts"

# 41) Snapshot yanlış tohum yazıyor (kullanıcıya yalan bilgi)
check "snapshot gerçek tohumu yazıyor" "src/sim/persistence/snapshot.ts" \
  "seed: world.seed," \
  "seed: 0," \
  "tests/world.test.ts"

# 42) Gözlemci özeti dil seçmiyor (panel hep Türkçe)
check "gözlemci özeti iki dilli" "src/worker/evidence.ts" \
  "  language: Language = 'tr',
): EvidencePack {" \
  "  language: Language = 'tr',
): EvidencePack { void language; language = 'tr';" \
  "tests/observer.test.ts"

# 43) Arayüze Türkçe sabit metin geri giriyor
check "arayüzde Türkçe sabit metin yok" "src/ui/EventsPanel.tsx" \
  "{t.events.recordNote}" \
  "{'Simülasyonun kaydı. Bu veri zaten üretiliyordu; panel onu görünür kılıyor.'}" \
  "tests/encoding.test.ts"

# 44) TEK TARAFLI üçlüde Türkçe metin (ilk tarayıcı sürümünün kaçırdığı hâl)
check "tek taraflı üçlüde Türkçe metin yok" "src/ui/Hud.tsx" \
  "{t.hud.learning}: {settings.learningEnabled ? t.settings.on : t.settings.off}" \
  "{t.hud.learning}: {settings.learningEnabled ? 'Açık' : 'Kapalı'}" \
  "tests/encoding.test.ts"

# 45) Kullanıcı tercihi kaydedilmiyor (sessizce unutuluyor)
check "kullanıcı tercihi kalıcı" "src/engine/store.ts" \
  "localStorage.setItem('ctm.muted', muted ? '1' : '0');" \
  "/* muted saklanmaz */" \
  "tests/measurement.test.ts"

echo
echo "ayırt edici: $pass · ayırt edici olmayan: $fail"
[ "$fail" -eq 0 ]
