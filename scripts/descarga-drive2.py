# Descarga las tandas con gdown --folder, parcheando el saneado de nombres
# para Windows (la subcarpeta 'Colours Pleasure 8"' rompe os.makedirs).
import re, sys
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

solo = sys.argv[1:] or list(TANDAS)
fallidas = []
for t in solo:
    print(f"=== {t} ===", flush=True)
    try:
        files = gdown.download_folder(id=TANDAS[t], output=f"fotos_raw/{t}", quiet=True, resume=True)
        print(f"  {t}: {len(files) if files else 0} archivos OK", flush=True)
    except Exception as e:
        print(f"  {t}: FALLO {type(e).__name__}: {e}", flush=True)
        fallidas.append(t)
print(f"FIN. Fallidas: {fallidas or 'ninguna'}", flush=True)
