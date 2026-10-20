# Nova Event

Sistema de gestión de eventos de Nova Event (por ahora bodas). PWA hecha con Next.js 16 y PostgreSQL, lista para Docker.

## Levantar con Docker en tu PC

1. Copia `.env.example` como `.env` y cambia las claves (`POSTGRES_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
2. Ejecuta:

   ```bash
   docker compose up --build -d
   ```

3. Abre `http://localhost:3000/login` y entra con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Al iniciar, el servicio `migrate` crea o actualiza las tablas a partir de `src/db/schema.ts` (no hay archivos `.sql`; están ignorados en git) y carga los roles base y el primer administrador. Se puede ejecutar varias veces sin duplicar nada ni cambiar contraseñas. Si un cambio de tablas pudiera borrar datos, se detiene sin aplicarlo.

**Reiniciar los servidores:** `docker compose down && docker compose up -d` (no uses `docker compose restart`, porque reinicia todo a la vez sin esperar a la base de datos). Para borrar también la base de datos y empezar de cero: `docker compose down -v`.

> **HTTPS:** en el servidor deja `COOKIE_SECURE=true` y pon la app detrás de HTTPS (Nginx, Caddy, Traefik...). Si entras por `http://` con una IP, la sesión no se guarda; solo en ese caso usa `false`.

## Deploy en el servidor (CI/CD con GitHub Actions + ghcr.io)

El servidor **no construye nada**. En cada push a `main`, GitHub Actions ([.github/workflows/imagenes.yml](.github/workflows/imagenes.yml)) construye dos imágenes y las sube a ghcr.io con dos etiquetas, el SHA del commit y `latest`:

- `ghcr.io/<usuario>/nova-event-app`: la aplicación
- `ghcr.io/<usuario>/nova-event-migrate`: crea o actualiza las tablas y los datos iniciales, y termina

**Primera vez (una sola vez):**

1. Haz commit y push. En GitHub → **Actions**, espera el ✅ (la primera vez tarda más porque no hay caché).
2. Las imágenes se crean **privadas**:
   - Repo público: GitHub → perfil → **Packages** → cada imagen → *Package settings* → *Change visibility* → **Public**.
   - Repo privado: en el servidor, inicia sesión una vez con un token que tenga solo `read:packages`:
     `echo <token> | docker login ghcr.io -u <usuario> --password-stdin`
3. En el servidor: `git clone`, copia `.env.example` como `.env`, completa las claves y pon `GHCR_OWNER=<tu usuario de GitHub en minúsculas>`.
4. Ejecuta `bash deploy.sh`.

**Uso diario:** haz `git push` y, en el servidor, ejecuta `bash deploy.sh`. Si Actions todavía está construyendo, el script espera solo (hasta 15 min). Si no aparecen las imágenes, aborta y producción sigue con la versión anterior.

**Volver a una versión anterior:** `TAG=<sha del commit> docker compose up -d --no-build`

**PWA y actualizaciones:** cada imagen lleva el SHA del commit como versión (`NEXT_DEPLOYMENT_ID`). Si alguien tiene la app abierta durante un deploy, Next.js detecta la versión nueva y recarga la página en la siguiente navegación.

## Desarrollo

```bash
docker compose up -d db   # solo la base de datos (puerto 5433)
npm install
npm run dev               # http://localhost:3000
```

| Comando | Qué hace |
|---|---|
| `npm run db:push` | Crea o actualiza las tablas según `src/db/schema.ts` |
| `npm run db:seed` | Crea los roles base y el administrador |
| `npm run db:studio` | Abre un visor de la base de datos |

## Estructura

- `src/db/schema.ts`: tablas (usuarios, roles, permisos, sesiones, registro de actividad)
- `src/lib/permissions.ts`: catálogo de módulos y permisos (`<modulo>.ver`, `<modulo>.gestionar`)
- `src/lib/auth.ts`: sesiones, `requireUser()` y `requirePermission()`
- `src/app/login`: inicio de sesión
- `src/app/panel`: sistema interno (el menú muestra solo los módulos permitidos)

## Roles iniciales

| Rol | Tipo | Acceso |
|---|---|---|
| Administrador | equipo | Todo |
| Coordinador | equipo | Cronogramas, proveedores, moodboard, calendario. Sin contratos, saldos ni usuarios |
| Proveedor | proveedor | Su propio calendario de disponibilidad |
| Cliente | cliente | Acceso opcional a su evento |
