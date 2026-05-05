# Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ── Dependencies ──────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# ── Build (generate Prisma client) ────────────────────────────
FROM deps AS build
COPY prisma ./prisma
RUN npx prisma generate

# ── Production image ──────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY src ./src
COPY frontend ./frontend

RUN mkdir -p logs

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "src/index.js"]
