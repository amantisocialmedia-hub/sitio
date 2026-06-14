# Descarga carpetas de Drive saneando nombres ilegales en Windows (", ?, *, etc.)
import re, sys, time
from pathlib import Path
import gdown

TANDAS = {
    "t1": "1Sr__PEeDx3NPcHaAVpY6-yBmJSmkkpNw",
    "t2": "1-II4c9gPpUnPlm9egd5ruaT4bAGARho9",
    "t3": "1AM3m9BGLOdR_b9EHBt8Bl9hMbnldLZYi",
    "t4": "149FTHxSmlc5EaMdPPo0y1L0F_ELdcHj5",
    "t5": "1ECGFYeSIBg5pLd7d3jz6gwtHw0enMlI0",
}
RAW = Path(__file__).resolve().parent.parent / "fotos_raw"

def sane(part):
    part = part.replace('"', " in")          # 8" -> 8 in
    part = re.sub(r'[<>:|?*]', "_", part)
    return part.strip().rstrip(".")

solo = sys.argv[1:] or list(TANDAS)
for t in solo:
    fid = TANDAS[t]
    print(f"=== {t} ===", flush=True)
    try:
        files = gdown.download_folder(id=fid, skip_download=True, quiet=True)
    except Exception as e:
        print(f"  LISTADO FALLO: {e}", flush=True)
        continue
    if not files:
        print("  (vacia o sin permiso)", flush=True)
        continue
    ok = err = skip = 0
    for f in files:
        rel = Path(f.path)
        # f.path viene como fotos_raw-style relativo a la carpeta raiz de la tanda
        dest = RAW / t / Path(*[sane(p) for p in rel.parts])
        if dest.exists() and dest.stat().st_size > 0:
            skip += 1
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            gdown.download(id=f.id, output=str(dest), quiet=True)
            ok += 1
        except Exception as e:
            print(f"  ERROR {rel}: {type(e).__name__}", flush=True)
            err += 1
        time.sleep(0.3)
    print(f"  {t}: {ok} descargados, {skip} ya existian, {err} errores", flush=True)
print("FIN", flush=True)
