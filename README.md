# zenpai 🌿

*Tu mentor de cultivo* — PWA de cultivo de cannabis: una carpa foto-real que te guía de la
germinación a la cosecha. Offline-first y privada por diseño.

## Estructura

- **[`app/`](app/)** — la aplicación real (Vite + React + TS + PWA). Ver [`app/README.md`](app/README.md)
  para el mapa del código y cómo correrla:

  ```bash
  cd app && docker compose up          # dev → http://localhost:5173
  ```

- **`prototype/`** — prototipos HTML históricos (la exploración de junio 2026 que definió la
  dirección: carpa foto-real, marca, UX). Sus imágenes (~440 MB) no viven en el repo;
  el prototipo quedó superado por `app/`.

- **`blender/`** — la escena 3D de la carpa (`zenpai-carpa.blend`), los recortes de plantas
  generados con Higgsfield y los scripts de render por lotes que producen `app/public/assets/v2/`.

> Nota: `app/_assets_jpg_original/` (JPG fuente de las WebP antiguas) no se versiona por peso;
> el arte IA anterior de la carpa quedó en `app/_assets_ia_antiguas/` (fuera del build).
