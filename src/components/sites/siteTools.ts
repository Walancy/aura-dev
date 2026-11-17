import { sitesRoot } from './siteStore';

// Ferramentas que a IA chama pelo terminal dentro da pasta do site. Ficam em ~/.aura-dev/sites/_tools e são reescritas a cada uso.
// remove-bg: recorta o fundo de uma foto (PNG com transparência). No macOS usa o Vision da Apple (offline, sem download); em outros
// sistemas, ou se falhar, usa o rembg quando instalado. Sem nenhum dos dois, sai com erro e a IA cai no recorte por máscara CSS.
const REMOVE_BG_SWIFT = String.raw`import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
func fail(_ msg: String, _ code: Int32) -> Never { FileHandle.standardError.write(Data((msg + "\n").utf8)); exit(code) }
guard args.count >= 3 else { fail("uso: remove-bg <entrada> <saida.png>", 2) }
guard let img = NSImage(contentsOfFile: args[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fail("imagem ilegivel", 3) }
let req = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cg)
do {
  try handler.perform([req])
  guard let obs = req.results?.first else { fail("nenhum sujeito encontrado", 4) }
  let buf = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: false)
  guard let png = CIContext().pngRepresentation(of: CIImage(cvPixelBuffer: buf), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!) else { fail("falha ao gerar PNG", 5) }
  try png.write(to: URL(fileURLWithPath: args[2]))
} catch { fail("falha: \(error)", 1) }
`;

const REMOVE_BG_SH = String.raw`#!/bin/sh
# uso: sh remove-bg.sh <entrada> <saida.png> [lado-maximo em px, padrao 2400]
in="$1"; out="$2"; max="$3"
[ -z "$in" ] || [ -z "$out" ] && { echo "uso: sh remove-bg.sh <entrada> <saida.png> [lado-maximo]" >&2; exit 2; }
[ -z "$max" ] && max=2400
[ -f "$in" ] || { echo "arquivo de entrada nao encontrado: $in" >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
ok=""
if [ "$(uname)" = "Darwin" ] && command -v swiftc >/dev/null 2>&1; then
  bin="$here/.remove-bg-mac"
  { [ -x "$bin" ] && [ "$bin" -nt "$here/remove-bg.swift" ]; } || swiftc -O "$here/remove-bg.swift" -o "$bin" >/dev/null 2>&1
  [ -x "$bin" ] && "$bin" "$in" "$out" && ok=1
fi
[ -z "$ok" ] && command -v rembg >/dev/null 2>&1 && rembg i "$in" "$out" && ok=1
[ -z "$ok" ] && { echo "remove-bg indisponivel neste computador: use recorte por mascara CSS" >&2; exit 1; }
# só reduz (sips -Z também amplia, o que borra imagens menores que o limite)
if command -v sips >/dev/null 2>&1; then
  pw=$(sips -g pixelWidth "$out" 2>/dev/null | awk '/pixelWidth/{print $2}'); ph=$(sips -g pixelHeight "$out" 2>/dev/null | awk '/pixelHeight/{print $2}')
  [ -z "$pw" ] && pw=0; [ -z "$ph" ] && ph=0
  if [ "$pw" -gt "$max" ] || [ "$ph" -gt "$max" ]; then sips -Z "$max" "$out" >/dev/null 2>&1; fi
elif command -v magick >/dev/null 2>&1; then magick "$out" -resize "$max"x"$max"\> "$out"; fi
echo "ok: $out"
`;

const CUTOUT_PY = String.raw`import re, sys, base64, subprocess, tempfile, os, shutil, urllib.request

# uso: python3 cutout.py <index.html>: remove o fundo das <img data-cutout> e embute o resultado (WebP/PNG com transparencia)
html_path = os.path.abspath(sys.argv[1])
tools = os.path.dirname(os.path.abspath(__file__))
html = open(html_path, encoding="utf-8").read()
pat = re.compile(r"<img\b[^>]*\bdata-cutout\b[^>]*>", re.I)
attr = re.compile(r"\s+data-cutout(?:=(?:\"[^\"]*\"|'[^']*'))?", re.I)
count = {"ok": 0, "fail": 0}

def fetch(src, dst):
    if src.startswith("data:"):
        data = base64.b64decode(src.split(",", 1)[1])
    elif re.match(r"https?://", src):
        req = urllib.request.Request(src.replace("&amp;", "&"), headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=40).read()
    else:
        data = open(os.path.join(os.path.dirname(html_path), src), "rb").read()
    open(dst, "wb").write(data)

def repl(m):
    tag = m.group(0)
    sm = re.search(r"\bsrc=([\"'])(.*?)\1", tag, re.S)
    if not sm:
        count["fail"] += 1
        return attr.sub(' data-cutout-failed="1"', tag, count=1)
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "in"), os.path.join(d, "out.png")
        try:
            fetch(sm.group(2), a)
            r = subprocess.run(["sh", os.path.join(tools, "remove-bg.sh"), a, b, "2400"], capture_output=True, text=True, timeout=240)
            if r.returncode != 0 or not os.path.exists(b):
                raise RuntimeError(r.stderr.strip() or "remove-bg falhou")
            mime, path = "image/png", b
            if shutil.which("magick"):
                w = os.path.join(d, "out.webp")
                if subprocess.run(["magick", b, "-quality", "92", w], capture_output=True).returncode == 0 and os.path.exists(w):
                    mime, path = "image/webp", w
            uri = "data:%s;base64,%s" % (mime, base64.b64encode(open(path, "rb").read()).decode())
        except Exception as e:
            count["fail"] += 1
            print("falhou:", e, file=sys.stderr)
            return attr.sub(' data-cutout-failed="1"', tag, count=1)
    count["ok"] += 1
    return attr.sub("", tag.replace(sm.group(0), 'src="' + uri + '"', 1), count=1)

new = pat.sub(repl, html)
if new != html:
    open(html_path, "w", encoding="utf-8").write(new)
print("recortes: %d ok, %d falharam" % (count["ok"], count["fail"]))
`;

const ASSETS_PY = String.raw`import re, sys, base64, os, shutil, subprocess, tempfile

# uso: python3 assets.py <index.html>: troca referencias a imagens anexadas (asset:NOME e <img data-asset="NOME">) pelos arquivos de _reference/, embutidos
html_path = os.path.abspath(sys.argv[1])
site = os.path.dirname(html_path)
html = open(html_path, encoding="utf-8").read()
MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif", "avif": "image/avif"}
cache = {}
count = {"ok": 0, "miss": 0}

def data_uri(name):
    if name in cache:
        return cache[name]
    path = None
    for base in ("_reference", "_assets", "."):
        cand = os.path.join(site, base, name)
        if os.path.isfile(cand):
            path = cand
            break
    if not path:
        cache[name] = None
        return None
    ext = name.rsplit(".", 1)[-1].lower()
    with tempfile.TemporaryDirectory() as d:
        use = path
        if ext in ("png", "jpg", "jpeg", "webp") and os.path.getsize(path) > 1_500_000 and shutil.which("magick"):
            small = os.path.join(d, "small." + ext)
            if subprocess.run(["magick", path, "-resize", "2400x2400>", "-quality", "86", small], capture_output=True).returncode == 0 and os.path.exists(small):
                use = small
        uri = "data:%s;base64,%s" % (MIME.get(ext, "image/png"), base64.b64encode(open(use, "rb").read()).decode())
    cache[name] = uri
    return uri

def swap_token(m):
    uri = data_uri(m.group(1))
    if uri:
        count["ok"] += 1
        return uri
    count["miss"] += 1
    return m.group(0)

# 1) <img data-asset="user-1.png" ...>: vira src e o atributo some
def img_tag(m):
    tag = m.group(0)
    am = re.search(r"\sdata-asset\s*=\s*(?:\"([^\"]*)\"|'([^']*)')", tag)
    name = (am.group(1) or am.group(2) or "").strip()
    uri = data_uri(name)
    tag = tag.replace(am.group(0), "", 1)
    if not uri:
        count["miss"] += 1
        return tag
    count["ok"] += 1
    if re.search(r"\ssrc\s*=", tag):
        return re.sub(r"\ssrc\s*=\s*(?:\"[^\"]*\"|'[^']*')", ' src="' + uri + '"', tag, count=1)
    return re.sub(r"<img\b", '<img src="' + uri + '"', tag, count=1, flags=re.I)

html = re.sub(r"<img\b[^>]*\sdata-asset\s*=\s*(?:\"[^\"]*\"|'[^']*')[^>]*>", img_tag, html, flags=re.I)
# 2) asset:NOME em qualquer lugar (src, srcset, url(...) do CSS e de style="")
html = re.sub(r"asset:([A-Za-z0-9_.\-]+\.(?:png|jpe?g|webp|gif|avif))", swap_token, html, flags=re.I)
open(html_path, "w", encoding="utf-8").write(html)
print("anexos: %d ok, %d nao encontrados" % (count["ok"], count["miss"]))
`;

/** Grava as ferramentas (a IA chama o remove-bg; o app roda o cutout.py nas imagens marcadas com data-cutout). */
export async function ensureSiteTools(): Promise<void> {
  const api = (window as any).electronAPI?.fs;
  if (!api) return;
  const dir = `${await sitesRoot()}/_tools`;
  await api.createItem(dir, true);
  await api.writeFile(`${dir}/remove-bg.swift`, REMOVE_BG_SWIFT);
  await api.writeFile(`${dir}/remove-bg.sh`, REMOVE_BG_SH);
  await api.writeFile(`${dir}/cutout.py`, CUTOUT_PY);
  await api.writeFile(`${dir}/assets.py`, ASSETS_PY);
}

/** Remove o fundo das <img data-cutout> do site (marcadas pela IA). Devolve quantos recortes deram certo; 0 se não havia nada a fazer. */
export async function applyCutouts(siteId: string): Promise<{ ok: number; fail: number }> {
  const api = (window as any).electronAPI;
  const root = await sitesRoot();
  const q = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;
  const res = await api?.shell?.exec?.(`python3 ${q(`${root}/_tools/cutout.py`)} ${q(`${root}/${siteId}/index.html`)}`, root);
  const m = /recortes: (\d+) ok, (\d+) falharam/.exec(String(res?.stdout || ''));
  return { ok: m ? Number(m[1]) : 0, fail: m ? Number(m[2]) : 0 };
}

/** Embute no HTML as imagens anexadas pelo usuário que a IA marcou com data-asset="user-N.ext" ou asset:user-N.ext. */
export async function applyAssets(siteId: string): Promise<{ ok: number; miss: number }> {
  const api = (window as any).electronAPI;
  const root = await sitesRoot();
  const q = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;
  const res = await api?.shell?.exec?.(`python3 ${q(`${root}/_tools/assets.py`)} ${q(`${root}/${siteId}/index.html`)}`, root);
  const m = /anexos: (\d+) ok, (\d+) nao encontrados/.exec(String(res?.stdout || ''));
  return { ok: m ? Number(m[1]) : 0, miss: m ? Number(m[2]) : 0 };
}
