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
