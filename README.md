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
| `npm run db:demo` | Carga los datos de ejemplo (solo con `SEED_DEMO=true`) |
| `npm run db:demo -- --borrar` | Quita los datos de ejemplo |
| `npm run db:studio` | Abre un visor de la base de datos |

### Archivos subidos (galería de proveedores y logos)

Las fotos, planos, fotos 360° y audios se guardan en el volumen de Docker `uploads` (en la app: `/app/uploads`; con `npm run dev`: la carpeta `uploads/`, que no se sube a git). Los videos no se suben: se guarda el enlace de YouTube, Vimeo, TikTok o Instagram.

Los logos de la empresa (*Administración → Empresa*) también van ahí, en `uploads/empresa/`. Se sirven en `/marca/logo-claro.webp`, `/marca/logo-oscuro.webp` y `/marca/icono-*.png`; si no se subió ninguno, se usan los originales de `public/`. El logo claro genera los íconos de la app y es el que usan los PDF.

Los comprobantes de pago (Saldos) van en `uploads/pagos/<id de la cotización>/` y solo se sirven a quien tiene `saldos.ver`.

**Respaldo:** junto con la base de datos, respalda también este volumen (incluye `uploads/pagos`):

```bash
docker run --rm -v nova-event_uploads:/datos -v "$PWD":/respaldo alpine tar czf /respaldo/uploads-$(date +%F).tar.gz -C /datos .
```

### Datos de ejemplo y base de producción

- **En tu PC** pon `SEED_DEMO=true` en `.env`: al levantar Docker se cargan proveedores, agendas y cuentas de ejemplo (todas terminan en `@demo.test`, contraseña `Demo12345` o la de `DEMO_PASSWORD`). No se duplican si ya están.
- **En producción** deja `SEED_DEMO=false` (o sin poner): la base arranca vacía, solo con los roles, las categorías y tu administrador.
- Para empezar de cero en tu PC: `docker compose down -v && docker compose up -d` (borra **toda** la base local).

## Cotizaciones

Módulo para armar propuestas para los clientes (`/panel/cotizaciones`). Cada cotización (`COT-AAAA-NNNN`) tiene una o varias opciones; cada opción suma los paquetes de proveedores y un paquete de Nova Event (Esencia, Inspiración o Prestigio), con una barra frente al presupuesto del cliente y avisos si un proveedor tiene ocupado el día.

- **Propuesta y enlace público:** desde la cotización se presenta la propuesta y se activa un enlace `/p/<código largo>` que se abre sin iniciar sesión. Se puede desactivar o regenerar. El cliente nunca ve notas internas, teléfonos ni correos de proveedores; el presupuesto solo si se marca para mostrarlo.
- **PDF:** la propuesta se descarga en PDF desde el mismo enlace o desde el panel.
- **Aceptar y confirmar:** al aceptar una opción se congela (cambios posteriores en catálogos no la alteran) y cada proveedor queda «Por confirmar»; al confirmarlo se reserva su día en su calendario.
- **Permisos:** `cotizaciones.ver`, `.crear`, `.editar` y `.eliminar` (solo equipo; se asignan en Roles). Los paquetes y la capacidad de cada proveedor requieren `proveedores.editar`. El rol Coordinador no los trae por defecto: sin ellos todo el módulo da 403.
- **Ejemplos (`SEED_DEMO=true`):** se cargan paquetes para los proveedores de ejemplo y tres cotizaciones: *Boda Rojas & Pérez* (borrador con dos opciones), *Quinceaños de Valeria* (enviada, con enlace activo) y *Boda García & Mendoza* (aceptada) y *Cumpleaños de Andrés* (cancelada). `npm run db:demo -- --borrar` las quita junto con los días que reservaron.

## Saldos

Módulo de cobros a la pareja y pagos a proveedores (`/panel/saldos`). Todo el dinero va en centavos enteros y los montos propuestos se redondean a bolivianos.

- **Permisos:** `saldos.ver`, `.crear`, `.editar` y `.eliminar` (solo equipo). Cambiar la fecha o cancelar un evento pide además `cotizaciones.editar`. Las condiciones de pago de cada proveedor (adelanto, días del saldo) requieren `proveedores.editar` y la política de cancelación, `empresa.editar`. Sin permiso el módulo da 403 y el Dashboard no muestra sus tarjetas.
- **Plan de la pareja:** al aceptar una opción se propone Anticipo 30 %, Cuota 1 40 % y Saldo final 30 % (15 días antes del evento); se puede editar. Cada proveedor confirmado que paga Nova Event tiene su propio plan (50 % al confirmar y el resto 7 días antes, o sus condiciones).
- **Recibos:** cada cobro genera `REC-AAAA-NNNN`, correlativo por año y nunca reutilizado, con PDF. Nada se borra: cobros, pagos, devoluciones y ajustes se anulan con motivo; el recibo anulado queda con su número y dice «ANULADO».
- **Mis pagos:** en el enlace público de la cotización aceptada (`/p/<código>`) la pareja ve su avance, cuotas y recibos. Nunca ve pagos a proveedores, comprobantes ni notas internas. Se oculta con «Mostrar pagos en el enlace».
- **Comprobantes:** imagen o PDF de hasta 10 MB (las imágenes se guardan como WebP), en `uploads/pagos/`. **Respalda esa carpeta** junto con la base de datos (ver *Archivos subidos*).
- **Ejemplos (`SEED_DEMO=true`):** *Boda García & Mendoza* con plan 30/40/30, anticipo (QR) y Cuota 1 (transferencia) cobrados, un descuento por referido, un proveedor pagado por la pareja y tres con plan (uno al día, uno vencido, uno pendiente); y *Cumpleaños de Andrés*, cancelado con un cobro y una devolución parcial. `npm run db:demo -- --borrar` los quita.

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
