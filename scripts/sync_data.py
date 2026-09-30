"""Copia los datos del juego desde el repo principal (infovis_2026-2) a este repo.

Uso:
    python3 scripts/sync_data.py [--src ../infovis-2026-2] [--regions CL-RM ...]

Copia web/data/game/index.json, y para cada región pedida su region-<CODE>.json, terrain-<CODE>.json y
props-<CODE>.json (desde enrich/props_*.json), más los clips de audio (clip completo y fragmento -g)
de las especies que aparecen en esas regiones.
Destino: data/game/ y audio/ (rutas iguales a las de la web del repo principal, para que
species.clip.src funcione tal cual). Cuando el repo principal esté publicado en GitHub Pages
se puede cargar desde ahí en vez de copiar (ver js/data.js).
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _simplify(pts: list, tol: float) -> list:
    """Douglas-Peucker (grados)."""
    if len(pts) < 3:
        return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    dx, dy = x1 - x0, y1 - y0
    n = (dx * dx + dy * dy) ** 0.5 or 1e-9
    i, dmax = 0, -1.0
    for k in range(1, len(pts) - 1):
        d = abs(dy * pts[k][0] - dx * pts[k][1] + x1 * y0 - y1 * x0) / n
        if d > dmax:
            i, dmax = k, d
    if dmax <= tol:
        return [pts[0], pts[-1]]
    return _simplify(pts[: i + 1], tol)[:-1] + _simplify(pts[i:], tol)


def chile_map(src: Path, dst: Path, index: dict, tol: float = 0.035) -> None:
    """Mapa de viaje: regiones como trazados SVG simplificados, Chile acostado (norte a la izquierda,
    Pacífico abajo). x = grados de latitud hacia el sur; y = grados de longitud hacia el oeste."""
    if not src.exists():
        return
    geo = json.loads(src.read_text(encoding="utf-8"))
    names = {r["code"]: r for r in index["regions"]}
    lat0, lon0, k = -17.3, -66.2, 10.0  # origen y escala (10 px por grado)
    proj = lambda lon, lat: (round((lat0 - lat) * k, 1), round((lon0 - lon) * k * 0.85, 1))
    regions = []
    for f in geo["features"]:
        code = f["properties"]["code"]
        polys = f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]]
        parts, best = [], (0.0, None)
        for poly in polys:
            ring = poly[0]
            xs, ys = [p[0] for p in ring], [p[1] for p in ring]
            area = (max(xs) - min(xs)) * (max(ys) - min(ys))
            if area < 0.02:  # islotes que no se ven a esta escala
                continue
            mid = len(ring) // 2  # anillo cerrado: simplificar cada mitad por separado
            simp = _simplify(ring[: mid + 1], tol)[:-1] + _simplify(ring[mid:], tol)
            if len(simp) < 4:
                continue
            parts.append("M" + "L".join("%s,%s" % proj(*p) for p in simp) + "Z")
            if area > best[0]:
                best = (area, (sum(xs) / len(xs), sum(ys) / len(ys)))
        meta = names.get(code, {})
        regions.append({"code": code, "id": meta.get("id"), "name": meta.get("name", code),
                        "active": bool(meta.get("terrainFile")), "d": "".join(parts),
                        "label": proj(*best[1]) if best[1] else None})
    dst.write_text(json.dumps({"viewBox": [0, -2, round((lat0 + 56.2) * k, 1), round((lon0 + 76.2) * k * 0.85, 1) + 4],
                               "regions": regions}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=ROOT.parent / "infovis-2026-2")
    ap.add_argument("--regions", nargs="+", default=["CL-RM"])
    args = ap.parse_args()
    web = args.src / "web"
    game = web / "data" / "game"
    out = ROOT / "data" / "game"
    out.mkdir(parents=True, exist_ok=True)

    index = json.loads((game / "index.json").read_text(encoding="utf-8"))
    shutil.copy2(game / "index.json", out / "index.json")
    rids = set()
    for code in args.regions:
        for name in (f"region-{code}.json", f"terrain-{code}.json"):
            if (game / name).exists():
                shutil.copy2(game / name, out / name)
        # vegetación por escena: enrich/props_<rm>.json → props-<CODE>.json
        props = game / "enrich" / f"props_{code.split('-')[1].lower()}.json"
        if props.exists():
            shutil.copy2(props, out / f"props-{code}.json")
        rids |= {str(r["id"]) for r in index["regions"] if r["code"] == code}

    chile_map(web / "data" / "regions.min.geojson", out / "chile-map.json", index)

    audio = ROOT / "audio"
    audio.mkdir(exist_ok=True)
    n = 0
    for s in index["species"]:
        if not s.get("clip") or not rids & set(s["regionalClass"]):
            continue
        for key in ("src", "grain"):
            rel = s["clip"].get(key)
            if rel and (web / rel).exists():
                shutil.copy2(web / rel, ROOT / rel)
                n += 1
    print(f"index + {len(args.regions)} región(es) → data/game/ · {n} clips → audio/")


if __name__ == "__main__":
    main()
