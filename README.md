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

1. Sube los cambios a `main` — GitHub Pages se redespliega solo.
2. **Importante**: incrementa `VERSION` en `sw.js` para que los clientes reciban la nueva caché.

## Despliegue (GitHub Pages)

```bash
git init -b main
git add . && git commit -m "Initial commit: Sudoku app PWA"
gh repo create sudoku-app --public --source . --push
gh api repos/<usuario>/sudoku-app/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

La app queda en `https://<usuario>.github.io/sudoku-app/`.

## Regenerar iconos

Edita `icons/icon.svg` y rasteriza con QuickLook (macOS):

```bash
cd icons
for s in 180 192 512 32; do qlmanage -t -s $s icon.svg -o . && mv icon.svg.png icon-$s.png; done
cp icon-180.png apple-touch-icon.png
cp icon-512.png icon-maskable-512.png
```

## Arquitectura

```
js/game.js      motor puro: solver, generador, validador (sin DOM)
js/state.js     store observable + acciones del juego
js/storage.js   localStorage versionado con validación
js/timer.js     tiempo de enfoque (pausa en segundo plano)
js/theme.js     temas + colores personalizados
js/ui/*         board, controls, modal, settings, stats, toast, confetti
sw.js           precache versionado + cache-first
```
