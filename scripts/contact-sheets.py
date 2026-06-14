# Genera hojas de contacto de fotos_raw/.../cuarto para identificacion visual.
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

SRC = Path(r"C:\Users\guill\dev\Amanti\amanti-store-cake\fotos_raw\fotos-catalogo\FOTOS CATALOGO\cuarto")
OUT = Path(r"C:\Users\guill\dev\Amanti\amanti-store-cake\_sheets")
OUT.mkdir(exist_ok=True)

def serie(f):
    n = f.name.lower()
    if re.match(r"^\d+\.jpg$", n):
        return ("0num", int(f.stem))
    m = re.match(r"^image(\d+)(?:-(\d+))?\.jpeg$", n)
    if m:
        batch = int(m.group(2) or 0)
        return (f"batch{batch}", int(m.group(1)))
    return ("z", 0)

files = sorted([f for f in SRC.iterdir() if f.suffix.lower() in (".jpg", ".jpeg")], key=serie)

COLS, ROWS, CELL, LABEL = 5, 5, 300, 28
per = COLS * ROWS
for s in range(0, len(files), per):
    chunk = files[s:s + per]
    sheet = Image.new("RGB", (COLS * CELL, ROWS * (CELL + LABEL)), "white")
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        try:
            im = Image.open(f)
            im = ImageOps.exif_transpose(im)
            im.thumbnail((CELL, CELL))
        except Exception:
            continue
        x = (i % COLS) * CELL
        y = (i // COLS) * (CELL + LABEL)
        sheet.paste(im, (x + (CELL - im.width) // 2, y + (CELL - im.height) // 2))
        d.text((x + 4, y + CELL + 4), f.name, fill="black")
    out = OUT / f"sheet_{s // per + 1:02d}.jpg"
    sheet.save(out, "JPEG", quality=70)
    print(out.name, len(chunk))
