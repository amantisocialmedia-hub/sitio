# Lista carpetas con gdown (skip_download) y baja cada archivo via
# drive.usercontent.google.com (evita el bloqueo del flujo uc?id= de gdown).
import re, sys, time
from pathlib import Path
import requests
import gdown

dfmod = sys.modules["gdown.download_folder"]
_orig = dfmod._sanitize_filename

def _win_sanitize(filename):
    f = _orig(filename=filename)
    f = f.replace('"', " in")
    f = re.sub(r'[<>:|?*]', "_", f)
    f = "".join(c for c in f if ord(c) >= 32)
    return f.strip().rstrip(".") or "_"

dfmod._sanitize_filename = _win_sanitize

TANDAS = {
    "t1": "1Sr__PEeDx3NPcHaAVpY6-yBmJSmkkpNw",
    "t2": "1-II4c9gPpUnPlm9egd5ruaT4bAGARho9",
    "t3": "1AM3m9BGLOdR_b9EHBt8Bl9hMbnldLZYi",
    "t4": "149FTHxSmlc5EaMdPPo0y1L0F_ELdcHj5",
    "t5": "1ECGFYeSIBg5pLd7d3jz6gwtHw0enMlI0",
}
RAW = Path(__file__).resolve().parent.parent / "fotos_raw"
URL = "https://drive.usercontent.google.com/download"

sess = requests.Session()
sess.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

solo = sys.argv[1:] or list(TANDAS)
total_ok = total_err = 0
for t in solo:
    print(f"=== {t} ===", flush=True)
    try:
        files = gdown.download_folder(id=TANDAS[t], skip_download=True, quiet=True)
    except Exception as e:
        print(f"  LISTADO FALLO: {type(e).__name__}: {e}", flush=True)
        continue
    if not files:
        print("  (vacia o sin permiso)", flush=True)
        continue
    ok = err = skip = 0
    for f in files:
        dest = RAW / t / f.path  # f.path ya viene saneado por el patch
        if dest.exists() and dest.stat().st_size > 0:
            skip += 1
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            r = sess.get(URL, params={"id": f.id, "export": "download", "confirm": "t"},
                         stream=True, timeout=120)
            ctype = r.headers.get("Content-Type", "")
            if r.status_code != 200 or ctype.startswith("text/html"):
                print(f"  ERROR {f.path}: HTTP {r.status_code} {ctype}", flush=True)
                err += 1
                continue
            with open(dest, "wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    fh.write(chunk)
            ok += 1
        except Exception as e:
            print(f"  ERROR {f.path}: {type(e).__name__}", flush=True)
            err += 1
        time.sleep(0.5)
    print(f"  {t}: {ok} bajados, {skip} ya existian, {err} errores", flush=True)
    total_ok += ok
    total_err += err
print(f"FIN ok={total_ok} err={total_err}", flush=True)
