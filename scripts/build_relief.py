"""Relieve de Chile para el menú de regiones (el "pasillo"): grilla de alturas y máscara de regiones.

Uso:
    python3 scripts/build_relief.py [--step 0.08] [--zoom 7] [--cache /tmp/tiles]

Fuente: AWS Terrain Tiles (formato Terrarium; SRTM, GMTED, ETOPO1 y batimetría GEBCO/NOAA), sin
API key: https://registry.opendata.aws/terrain-tiles/
Cada celda guarda una mezcla de la media y el máximo de su bloque (así las cumbres no se aplanan al
bajar la resolución). La máscara de regiones sale de data/game/chile-map.json (los trazados del mapa
de viaje), rasterizada a la misma grilla.

Salida: data/game/chile-relief.json
  lat0, lon0: esquina noroeste (centro de la primera celda); step: grados por celda;
  rows, cols; h: alturas en metros (Int16 little-endian en base64, fila 0 = norte);
  region: un carácter por celda ('.' = fuera de Chile, 'a' + id - 1 = región id).
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
LAT_N, LAT_S, LON_W, LON_E = -17.3, -56.1, -76.2, -66.0


def tile_xy(lon: float, lat: float, z: int) -> tuple[float, float]:
    n = 2 ** z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


def fetch(z: int, x: int, y: int, cache: Path) -> np.ndarray:
    f = cache / f"{z}_{x}_{y}.png"
    if not f.exists():
        with urllib.request.urlopen(URL.format(z=z, x=x, y=y), timeout=60) as r:
            f.write_bytes(r.read())
    a = np.asarray(Image.open(io.BytesIO(f.read_bytes())).convert("RGB"), dtype=np.float32)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768


def mosaic(z: int, cache: Path) -> tuple[np.ndarray, int, int]:
    x0, y0 = (int(v) for v in tile_xy(LON_W, LAT_N, z))
    x1, y1 = (int(v) for v in tile_xy(LON_E, LAT_S, z))
    rows = []
    for ty in range(y0, y1 + 1):
        rows.append(np.concatenate([fetch(z, tx, ty, cache) for tx in range(x0, x1 + 1)], axis=1))
    print(f"{(x1 - x0 + 1) * (y1 - y0 + 1)} teselas z{z}")
    return np.concatenate(rows, axis=0), x0 * 256, y0 * 256


def region_mask(rows: int, cols: int, step: float) -> np.ndarray:
    """Rasteriza los trazados SVG de chile-map.json (x = (−17.3 − lat)·10, y = (−66.2 − lon)·8.5)."""
    cmap = json.loads((ROOT / "data/game/chile-map.json").read_text(encoding="utf-8"))
    sup = 2  # sobremuestreo para bordes más justos
    img = Image.new("L", (cols * sup, rows * sup), 0)
    draw = ImageDraw.Draw(img)
    for reg in cmap["regions"]:
        for part in reg["d"].split("M")[1:]:
            pts = []
            for p in part.rstrip("Z").split("L"):
                x, y = (float(v) for v in p.split(","))
                lat, lon = -17.3 - x / 10, -66.2 - y / 8.5
                pts.append(((lon - LON_W) / step * sup + sup / 2, (LAT_N - lat) / step * sup + sup / 2))
            if len(pts) >= 3:
                draw.polygon(pts, fill=reg["id"])
    return np.asarray(img)[::sup, ::sup][:rows, :cols]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--step", type=float, default=0.08)
    ap.add_argument("--zoom", type=int, default=7)
    ap.add_argument("--cache", type=Path, default=Path("/tmp/terrain-tiles"))
    args = ap.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    z, step = args.zoom, args.step

    mos, ox, oy = mosaic(z, args.cache)
    rows = int(round((LAT_N - LAT_S) / step)) + 1
    cols = int(round((LON_E - LON_W) / step)) + 1
    lat = LAT_N - np.arange(rows) * step
    lon = LON_W + np.arange(cols) * step
    # 5×5 muestras dentro de cada celda: media y máximo
    sub = (np.arange(5) - 2) / 5 * step
    LAT = lat[:, None, None, None] + sub[None, None, :, None]
    LON = lon[None, :, None, None] + sub[None, None, None, :]
    LAT, LON = np.broadcast_arrays(LAT, LON)
    n = 2 ** z * 256
    px = ((LON + 180) / 360 * n - ox).astype(int).clip(0, mos.shape[1] - 1)
    py = ((1 - np.arcsinh(np.tan(np.radians(LAT))) / np.pi) / 2 * n - oy).astype(int).clip(0, mos.shape[0] - 1)
    s = mos[py, px].reshape(rows, cols, 25)
    mean, mx, mn = s.mean(axis=2), s.max(axis=2), s.min(axis=2)
    h = np.where(mean > 0, 0.55 * mean + 0.45 * mx, np.minimum(mean, 0.5 * (mean + mn)))  # cumbres y fosas visibles
    h = np.where((mean <= 0) & (mx > 0), np.maximum(mean, 1), h)  # costa: celda mixta = tierra baja

    mask = region_mask(rows, cols, step)
    region = "".join("." if v == 0 else chr(96 + int(v)) for v in mask.ravel())

    out = {
        "_nota": "Relieve de Chile para el menú de regiones. Generado por scripts/build_relief.py desde AWS "
                 "Terrain Tiles (Terrarium: SRTM, GMTED2010, ETOPO1; batimetría GEBCO). h: metros, Int16 LE "
                 "en base64, fila 0 = norte. region: '.' fuera de Chile, chr(96 + id) región.",
        "lat0": LAT_N, "lon0": LON_W, "step": step, "rows": rows, "cols": cols,
        "h": base64.b64encode(np.clip(h, -9000, 7000).round().astype("<i2").tobytes()).decode(),
        "region": region,
    }
    dst = ROOT / "data/game/chile-relief.json"
    dst.write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{rows}×{cols} celdas · máx {h.max():.0f} m · mín {h.min():.0f} m → {dst.relative_to(ROOT)} "
          f"({dst.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
