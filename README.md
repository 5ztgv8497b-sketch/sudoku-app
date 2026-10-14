# Sudoku app

Sudoku minimalista, responsive y **PWA sin dependencias** (HTML/CSS/JS vanilla, sin build). Funciona offline, se instala en iOS/Android y genera tableros infinitos con solución única.

## Características

- Tableros aleatorios infinitos con **solución única garantizada** (backtracking + MRV, verificación de unicidad al quitar celdas).
- Tres dificultades: fácil (~42 pistas), media (~34), difícil (~28).
- **Móvil**: toca una casilla y elige el número en el teclado inferior — nunca aparece el teclado del sistema.
- **Escritorio**: flechas para moverte, 1-9 para escribir, Retroceso/Supr para borrar.
- Partida **guardada en vivo** (localStorage): cierra y reanuda cuando quieras.
- Modo **claro/oscuro/automático** con estética liquid glass y sub-cajas bien diferenciadas.
- **Verificar** bajo demanda y **auto-comprobación** en tiempo real (switch).
- Contador de errores, cronómetro de enfoque (pausa con la app en segundo plano, ocultable).
- **Estadísticas**: partidas, resueltas, mejor tiempo y últimas 10 partidas por dificultad.
- **Colores personalizables**: presets + pickers para celda, caja 3×3 y borde.
- Confeti y resumen al completar el tablero.
- Reglas y consejos para nuevos jugadores.
- PWA completa: manifest, service worker cache-first, iconos y metadatos iOS (Añadir a pantalla de inicio).

## Desarrollo local

Los módulos ES y el service worker requieren HTTP (no `file://`):

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Pruebas del motor (generación/unicidad/tiempos): <http://localhost:8000/dev/engine-test.html>

## Publicar una nueva versión

1. **Importante**: ejecuta `python3 dev/release.py` antes del commit. Recalcula `VERSION` en `sw.js` a partir del contenido de los assets precacheados, así los clientes reciben la nueva caché sin tener que acordarse de subir el número.
2. Sube los cambios a `main` — GitHub Pages se redespliega solo. Los clientes instalados ven el aviso «Hay una versión nueva» y pulsan **Actualizar**.

## Despliegue (GitHub Pages)

```bash
git init -b main
git add . && git commit -m "Initial commit: Sudoku app PWA"
gh repo create sudoku-app --public --source . --push
gh api repos/<usuario>/sudoku-app/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

La app queda en `https://<usuario>.github.io/sudoku-app/`.

## Regenerar iconos

Rasteriza con QuickLook (macOS). `icon.svg` es el icono redondeado; `icon-maskable.svg` es la versión a sangre (sin esquinas transparentes) que usan iOS y el icono maskable de Android:

```bash
cd icons
for s in 192 512; do qlmanage -t -s $s icon.svg -o . && mv icon.svg.png icon-$s.png; done
qlmanage -t -s 32 icon.svg -o . && mv icon.svg.png favicon-32.png
qlmanage -t -s 512 icon-maskable.svg -o . && mv icon-maskable.svg.png icon-maskable-512.png
qlmanage -t -s 180 icon-maskable.svg -o . && mv icon-maskable.svg.png apple-touch-icon.png
```

## Arquitectura

```
js/game.js      motor puro: solver, generador, validador (sin DOM)
js/state.js     store observable + acciones del juego
js/storage.js   localStorage versionado con validación
js/timer.js     tiempo de enfoque (pausa en segundo plano)
js/theme.js     temas + colores personalizados
js/ui/*         board, controls, modal, settings, stats, toast, confetti, update
sw.js           precache versionado + cache-first (VERSION lo fija dev/release.py)
dev/release.py  recalcula VERSION a partir del contenido de los assets
```

**Rendimiento:** cada vista se suscribe con `store.watch(selector, fn)` y solo se repinta cuando cambia su dato. El cronómetro no escribe el estado en cada frame: refresca el marcador una vez por segundo y guarda cada ~3 s. Antes de tocar el render o los temporizadores, mide con `Performance.getMetrics` (CDP) y un `MutationObserver`.
