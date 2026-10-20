# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Construcción de la app
FROM base AS builder
# SHA del commit. Identifica la versión: si alguien tiene la PWA abierta durante un deploy,
# Next.js detecta el cambio y recarga la página con la versión nueva.
ARG GIT_SHA=local
ENV NEXT_DEPLOYMENT_ID=$GIT_SHA
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Imagen de tablas y datos iniciales: corre una vez al arrancar y termina.
# Solo instala lo que usa, con las versiones exactas del package-lock.json.
FROM base AS migrator
COPY package-lock.json /tmp/
RUN npm install --no-save --no-audit --no-fund $(node -p " \
      const l = require('/tmp/package-lock.json').packages; \
      ['drizzle-kit','drizzle-orm','postgres','bcryptjs','tsx'] \
        .map(n => n + '@' + l['node_modules/' + n].version).join(' ')") \
    && rm /tmp/package-lock.json && npm cache clean --force
COPY drizzle.config.ts ./
COPY src/db ./src/db
COPY src/lib/permissions.ts ./src/lib/permissions.ts
CMD ["sh", "-c", "npx drizzle-kit push && npx tsx src/db/seed.ts"]

# Imagen final de la app, mínima
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
