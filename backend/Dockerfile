# node:20-slim, NOT alpine — Prisma's musl binary target on Alpine is a
# classic multi-hour debug. openssl is required by Prisma's query engine.
FROM node:20-slim AS base
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Generates the Prisma client against schema.prisma — must run after
# npm ci (needs @prisma/client installed) and before tsc.
RUN npx prisma generate

RUN npm run build

EXPOSE 4000

# migrate deploy (not `migrate dev`) applies existing migrations without
# prompting — this is what production/CI should run. `migrate dev` is
# for local iteration only.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
