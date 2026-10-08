#!/bin/zsh
# Graphics render → manifest check → x265 composite, as ONE detached job (survives the session):
#   nohup scripts/run-master-detached.sh > work/logs/chain.log 2>&1 &
# Progress: work/logs/render-gfx.log, work/logs/composite.log; end marker in work/logs/chain.log.
cd "$(dirname "$0")/.." || exit 1
mkdir -p work/logs
echo "[chain] render basliyor $(date +%T)"
node scripts/50-validate-plan.mjs > work/logs/render-gfx.log 2>&1 && node scripts/60-render-segments.mjs >> work/logs/render-gfx.log 2>&1
node -e 'const m=require("./work/segments/manifest.json"); if(!m.complete){console.log("[chain] MANIFEST EKSIK"); process.exit(1)} console.log("[chain] manifest tam:", m.segments.length, "segment")' || { echo "[chain] BITTI (hata)"; exit 1; }
echo "[chain] composite basliyor $(date +%T)"
node scripts/70-composite.mjs > work/logs/composite.log 2>&1
echo "[chain] composite cikis kodu $? $(date +%T)"
echo "[chain] BITTI"
