// 08-assemble gerçek çalıştırma testi (ffmpeg gerekir; yoksa atlanır):  node --test tests/assemble.test.mjs
// Kapsam: sessiz kaynak (ses akışı yok → sessizlik eklenir) ve zoom kadrajı (t=0'da 1× başlayan zoom'da kadraj ortada kalır, sol-üste yapışmaz).
// Kendi geçici çalışma klasöründe koşar: repo'nun work/ klasörüne dokunmaz.
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
const psnr = (a, b) => {
  const r = run("ffmpeg", ["-hide_banner", "-i", a, "-i", b, "-filter_complex", "[0:v]format=rgb24[a];[1:v]format=rgb24[b];[a][b]psnr", "-f", "null", "-"]);
  return Number(/average:([0-9.]+)/.exec(r.stderr)?.[1] ?? "NaN");
};

test("08-assemble: sessiz kaynak çökmez, zoom kadrajı ortada kalır", { skip: !hasFfmpeg && "ffmpeg yok", timeout: 180000 }, () => {
  const W = mkdtempSync(path.join(os.tmpdir(), "kurgu-assemble-"));
  try {
    cpSync(path.join(ROOT, "scripts"), path.join(W, "scripts"), { recursive: true });
    mkdirSync(path.join(W, "work/composite"), { recursive: true });
    // 1 sn, 640x360, 30 fps, SDR, SES YOK; tek karede her şey farklı olsun diye hareketli test deseni
    const src = path.join(W, "sessiz.mp4");
    assert.equal(run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", src]).status, 0);
    writeFileSync(path.join(W, "work/assemble.json"), JSON.stringify({
      output: "sdr", pieces: [{ src: "sessiz.mp4", from: 0, to: 1, kind: "sdr" }],
      zooms: [{ from: 0.5, to: 1, z: 1.5, cx: 0.5, cy: 0.5, in: 0, out: 0 }], // t=0'da 1×, 0,5 sn'den sonra 1,5× (hata: kadraj sol-üste yapışırdı)
    }));
    const r = run(process.execPath, [path.join(W, "scripts/08-assemble.mjs"), "--force"], { cwd: W });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /sessizlik eklendi/);
    const out = path.join(W, "work/composite/base.mov");
    assert.ok(existsSync(out));
    const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,nb_frames,duration", "-of", "json", out]).stdout).streams;
    assert.equal(Number(probe.find((s) => s.codec_type === "video").nb_frames), 30);
    assert.ok(Math.abs(Number(probe.find((s) => s.codec_type === "audio").duration) - 1) < 0.05, "ses 1 sn olmalı");
    // 24. kare (zoom'lu): ortadan 1/1,5 kırpılmış kaynakla eşleşmeli, kırpılmamışla değil
    const frame = (file, vf, png) => assert.equal(run("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `select=eq(n\\,24),${vf}`, "-frames:v", "1", png]).status, 0);
    const o = path.join(W, "o.png"), e = path.join(W, "e.png"), n = path.join(W, "n.png");
    frame(out, "scale=640:360:out_range=pc", o);
    frame(src, "crop=iw/1.5:ih/1.5:(iw-iw/1.5)/2:(ih-ih/1.5)/2,scale=640:360", e);
    frame(src, "scale=640:360", n);
    const good = psnr(e, o), bad = psnr(n, o);
    assert.ok(good > 15 && good > bad + 5, `kadraj ortada değil: kırpmayla ${good} dB, kırpılmamışla ${bad} dB`);
  } finally { rmSync(W, { recursive: true, force: true }); }
});
