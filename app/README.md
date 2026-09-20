# zenpai — tu mentor de cultivo 🌿

PWA de cultivo de cannabis: una carpa foto-real que te guía de la germinación a la cosecha.
Offline-first y privada por diseño: sin cuentas, sin nube, datos y fotos solo en tu dispositivo
(fotos sin EXIF/GPS).

## Correr

Sin Node local — todo en Docker:

```bash
# desarrollo (Vite + HMR) → http://localhost:5173
docker compose up

# producción (build + nginx, instalable/offline) → http://localhost:8080
docker compose -f docker-compose.prod.yml up --build
```

## Stack

Vite + React 18 + TypeScript + Tailwind + vite-plugin-pwa · Zustand (persist) → Dexie/IndexedDB
(kv + bitácora append-only + fotos).

## Mapa del código (`src/`)

- `lib.ts` — modelo `Cultivo`, derivación por reloj real (`deriveLive`: día/etapa/sed),
  etapas por tipo de semilla (`stageAt`: fotoperiódica 12/12 manual vs autofloreciente),
  umbrales de riego (`GUARD_HOURS`, `WATER_ALERT_DAYS`), imágenes por etapa/sustrato, bitácora.
- `mentor.ts` — rangos agronómicos objetivo, consejos por etapa+nivel, guía de riego por maceta,
  guardarraíl de sobre-riego, `needsAttention`.
- `store.ts` — Zustand: cultivos, eventos, deshacer (pendingUndo), migraciones (`merge`),
  respaldo (export/import/wipe), recordatorios locales.
- `db.ts` — Dexie v3 (kv, events, photos) + respaldo JSON con fotos base64.
- `useBackClose.ts` — gesto atrás del sistema (capas con entradas de historial firmadas por sesión).
- `img.ts` — compresión de fotos vía canvas (elimina EXIF/GPS).
- `howtos.ts` — "muéstrame cómo" (secuencias de fotos paso a paso).
- `components/` — Gate (edad) · Onboarding (nivel) · Home (mis cultivos) · ConfigScreen
  (nuevo/registrar existente) · Germination (remojo) · TentView (la carpa) · Journal
  (bitácora + fotos) · Today (consejos + 12/12 + entrenamiento) · Measure · WaterRecipe ·
  FinishGrow (cierre de ciclo) · EditGrow · Settings (ajustes/datos/legal) · HowTo · Intro.

## Assets

La carpa es una **escena 3D** (ver `../blender/README.md`): `public/assets/v2/` tiene ~270 WebP
renderizados en Blender (una sola escena, misma cámara) para cada combinación de etapa × sustrato
× nº de macetas × estado de luz (día/noche/frío/calor) × vista (frente/cenital), más los 24
fotogramas de la puerta abriéndose. `lib.ts` (`frontImg`, `v2Name`) arma el nombre del archivo a
partir del cultivo; `mentor.ts` (`sceneState`) decide el estado según luz y temperatura.
En `public/assets/` solo queda arte IA en uso: el vaso de remojo (`agua-*`) y los how-to
(`howto-*`). El arte IA anterior de la carpa está en `_assets_ia_antiguas/` (fuera del build).
Scripts: `scripts/optimize-images.mjs` (JPG→WebP), `scripts/gen-icons.mjs` (íconos PWA).

## Despliegue (GitHub Pages)

La app pública vive en https://bperezmn.github.io/Zenpai/ (la rama `gh-pages` es el contenido
de `dist/`). Para publicar una versión nueva:

```bash
docker compose exec -T web sh -c "BASE_PATH=/Zenpai/ npm run build"
cd dist && touch .nojekyll && git init -q && git add -A && git commit -qm deploy \
  && git push -f git@github.com:bperezmn/Zenpai.git HEAD:gh-pages
```

La PWA cachea el shell, así que un visitante que ya la abrió ve la versión nueva en la
segunda visita (o forzando la actualización del service worker).

## Principios

- **No inventamos datos**: las lecturas las pone el usuario; la app solo deriva del reloj.
- **Event log como fuente de verdad**: cada acción real queda en la bitácora.
- **Privacidad por diseño**: edad + consentimiento versionado, EXIF fuera, cero comercio.
