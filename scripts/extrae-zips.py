# Extrae los zips de Drive a fotos_raw/, saneando nombres ilegales en Windows.
import re, zipfile
from pathlib import Path

VINO = Path(r"C:\Users\guill\dev\Amanti\amanti-store-vino")
RAW = Path(r"C:\Users\guill\dev\Amanti\amanti-store-cake\fotos_raw")

ZIPS = {
    "FOTOS CATALOGO-20260610T041426Z-3-001.zip": "fotos-catalogo",
    "FOTOS CATALOGO-20260610T041426Z-3-002.zip": "fotos-catalogo",
    "CATALOGO PENDIENTE DE DESCRIPCIONES-20260610T041440Z-3-001.zip": "catalogo-pendiente",
    "6 PRODUCTOS FALTANTES-20260610T041505Z-3-001.zip": "productos-faltantes",
    "CATÁLOGO PRODUCTOS RESTANTES-20260610T041453Z-3-001.zip": "productos-restantes",
}

def sane(part):
    part = part.replace('"', " in")
    part = re.sub(r'[<>:|?*]', "_", part)
    part = "".join(c for c in part if ord(c) >= 32)
    return part.strip().rstrip(".") or "_"

for zname, sub in ZIPS.items():
    zpath = VINO / zname
    out = RAW / sub
    n = skip = 0
    with zipfile.ZipFile(zpath) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            # decodifica nombres cp437->utf8 si hace falta
            name = info.filename
            if info.flag_bits & 0x800 == 0:
                try:
                    name = name.encode("cp437").decode("utf-8")
                except (UnicodeDecodeError, UnicodeEncodeError):
                    pass
            dest = out / Path(*[sane(p) for p in Path(name).parts])
            if dest.exists() and dest.stat().st_size == info.file_size:
                skip += 1
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, open(dest, "wb") as dst:
                while chunk := src.read(1 << 20):
                    dst.write(chunk)
            n += 1
    print(f"{zname} -> {sub}: {n} extraidos, {skip} ya existian", flush=True)
print("FIN", flush=True)
