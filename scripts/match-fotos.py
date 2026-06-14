# Empareja fotos de fotos_raw/ con productos de data/products.json.
# Conservador: solo asigna si la foto coincide con UN solo producto.
# Uso: python scripts/match-fotos.py [--apply]
import hashlib, json, os, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "fotos_raw"
OUT = ROOT / "public" / "products"
MAX_FOTOS = 5

def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s

data = json.loads((ROOT / "data" / "products.json").read_text(encoding="utf-8"))
products = data["products"]
keys = []  # (normkey, slug)
for p in products:
    keys.append((norm(p["name"]), p["slug"]))
    k2 = norm(p["slug"])
    if k2 != norm(p["name"]):
        keys.append((k2, p["slug"]))

# Aliases manuales para typos obvios del Drive (carpeta -> slug).
# Solo agregar tras revisar la lista de "sin match".
ALIASES = {}
alias_path = ROOT / "scripts" / "alias-fotos.json"
if alias_path.exists():
    ALIASES = {norm(k): v for k, v in json.loads(alias_path.read_text(encoding="utf-8")).items()}

EXT = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".cr3"}
photos = [f for f in RAW.rglob("*") if f.is_file() and f.suffix.lower() in EXT]

# Mapeo manual exacto nombre-de-archivo -> slug (identificacion visual)
MANUAL = {}
manual_path = ROOT / "scripts" / "manual-fotos.json"
if manual_path.exists():
    MANUAL = json.loads(manual_path.read_text(encoding="utf-8"))

def candidates(stem_n):
    hits = {}
    if stem_n in ALIASES:
        # null = bloqueado (producto que no esta en el catalogo)
        return {ALIASES[stem_n]: 999} if ALIASES[stem_n] else {}
    for k, slug in keys:
        if not k:
            continue
        if k in stem_n or stem_n in k:
            hits[slug] = max(hits.get(slug, 0), len(k))
    return hits

matched = {}   # slug -> [paths]
unmatched = []
ambiguous = []

for ph in sorted(photos):
    if ph.name in MANUAL:
        matched.setdefault(MANUAL[ph.name], []).append(ph)
        continue
    stem = ph.stem
    stem_clean = re.sub(r"^(copia de\s*)+", "", stem, flags=re.I)
    stem_clean = re.sub(r"[\s_\-]*\(?\d+\)?$", "", stem_clean)
    folder = ph.parent.name if ph.parent != RAW else ""
    folder_clean = re.sub(r"^(copia de\s*)+", "", folder, flags=re.I)

    best = {}
    # carpeta primero (las fotos vienen en carpetas por producto con archivos _MG_xxxx)
    for source in (folder_clean, stem_clean, stem):
        n = norm(source)
        if len(n) < 4:
            continue
        hits = candidates(n)
        if hits:
            best = hits
            break

    if not best:
        unmatched.append(str(ph.relative_to(RAW)))
    elif len(best) == 1:
        matched.setdefault(next(iter(best)), []).append(ph)
    else:
        mx = max(best.values())
        top = [s for s, v in best.items() if v == mx]
        if len(top) == 1:
            matched.setdefault(top[0], []).append(ph)
        else:
            ambiguous.append((str(ph.relative_to(RAW)), sorted(best)))

# --- dedupe por producto ---
# 1) mismo stem (toma .jpg sobre .cr3)  2) mismo contenido (hash) entre tandas
def filehash(p, limit=1 << 16):
    h = hashlib.md5()
    h.update(str(p.stat().st_size).encode())
    with open(p, "rb") as f:
        h.update(f.read(limit))
    return h.hexdigest()

PREF = {".jpg": 0, ".jpeg": 0, ".png": 1, ".webp": 1, ".avif": 1, ".cr3": 2}
for slug, lst in matched.items():
    bystem = {}
    for ph in sorted(lst, key=lambda p: (PREF[p.suffix.lower()], str(p))):
        bystem.setdefault(ph.stem.lower(), ph)
    seen, final = set(), []
    for ph in sorted(bystem.values(), key=lambda p: str(p)):
        h = filehash(ph)
        if h in seen:
            continue
        seen.add(h)
        final.append(ph)
    matched[slug] = final[:MAX_FOTOS]

print(f"Fotos totales: {len(photos)}")
print(f"Asignadas (post-dedupe, max {MAX_FOTOS}): {sum(len(v) for v in matched.values())} fotos -> {len(matched)} productos")
print(f"Sin match: {len(unmatched)}")
print(f"Ambiguas (no asignadas): {len(ambiguous)}")
print("\n--- MATCHES (carpetas) ---")
folder_match = {}
for slug in sorted(matched):
    folders = sorted({str(p.parent.relative_to(RAW)) for p in matched[slug]})
    print(f"{slug}  ({len(matched[slug])} fotos)  <=  {' | '.join(folders)}")
print("\n--- SIN MATCH (por carpeta) ---")
from collections import Counter
cnt = Counter(str(Path(u).parent) for u in unmatched)
for folder, c in sorted(cnt.items()):
    print(f"{folder}: {c} fotos")
print("\n--- AMBIGUAS ---")
for u, c in ambiguous:
    print(f"{u} ~ {c}")

slugs_sin_foto = [p["slug"] for p in products if p["slug"] not in matched]
print(f"\n--- PRODUCTOS SIN FOTO ({len(slugs_sin_foto)}) ---")
for s in slugs_sin_foto:
    print(s)

if "--apply" in sys.argv:
    from PIL import Image, ImageOps
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for slug in sorted(matched):
        for i, ph in enumerate(matched[slug], 1):
            dest = OUT / f"{slug}_{i}.jpg"
            if ph.suffix.lower() == ".cr3":
                import rawpy
                with rawpy.imread(str(ph)) as raw:
                    # RAWs sin editar vienen subexpuestas (contraluz): +3 stops
                    rgb = raw.postprocess(use_camera_wb=True, output_bps=8,
                                          exp_shift=3.0, exp_preserve_highlights=1.0)
                img = Image.fromarray(rgb)
            else:
                img = Image.open(ph)
                img = ImageOps.exif_transpose(img)
                if img.mode != "RGB":
                    img = img.convert("RGB")
            lado = max(img.width, img.height)
            if lado > 1200:
                f = 1200 / lado
                img = img.resize((round(img.width * f), round(img.height * f)), Image.LANCZOS)
            img.save(dest, "JPEG", quality=80, optimize=True)
            if dest.stat().st_size > 300 * 1024:
                img.save(dest, "JPEG", quality=70, optimize=True)
            n += 1
    total = sum(f.stat().st_size for f in OUT.iterdir() if f.is_file())
    print(f"\n[apply] {n} fotos escritas en public/products/ ({total/1024/1024:.1f} MB)")
