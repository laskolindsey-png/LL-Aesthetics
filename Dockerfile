# Production image for the LL Aesthetics operating system (Fly.io).
FROM node:22-slim AS base
WORKDIR /app
# OpenSSL is required by the Prisma engine.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Install dependencies ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Build the app ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# --- Runtime image ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Keep node_modules (incl. prisma + tsx) so the release step can run migrations + seed.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["npm", "run", "start"]
