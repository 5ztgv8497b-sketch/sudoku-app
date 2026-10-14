#!/usr/bin/env python3
"""Recalcula VERSION en sw.js a partir del contenido de los assets precacheados.

La caché cambia exactamente cuando cambia algún archivo que se sirve offline,
sin depender de acordarse de subir el número a mano. Ejecutar antes de publicar:

    python3 dev/release.py
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SW = ROOT / 'sw.js'


def main():
    src = SW.read_text(encoding='utf-8')

    assets_block = re.search(r'const ASSETS = \[(.*?)\];', src, re.S)
    if not assets_block:
        raise SystemExit('No encuentro ASSETS en sw.js')
    # './' es el mismo contenido que './index.html', que ya está en la lista
    assets = [a for a in re.findall(r"'([^']+)'", assets_block.group(1)) if a != './']

    digest = hashlib.sha256()
    for asset in assets:
        digest.update(asset.encode('utf-8'))
        digest.update((ROOT / asset).read_bytes())  # falla si el asset no existe

    version = f'v{digest.hexdigest()[:8]}'
    out, n = re.subn(r"const VERSION = '[^']*';", f"const VERSION = '{version}';", src, count=1)
    if n != 1:
        raise SystemExit('No encuentro VERSION en sw.js')
    if out != src:
        SW.write_text(out, encoding='utf-8')
    print(version)


if __name__ == '__main__':
    main()
