# Build SvelteKit (adapter-node) with Bun; run with Node so better-sqlite3 matches a real Node ABI.
# Bun-built node_modules can omit or misplace the .node addon after `bun install --production`, which
# surfaces as "Could not locate the bindings file" and breaks OAuth (ensureOAuthUser hits SQLite).
FROM oven/bun:1.3 AS builder
WORKDIR /app

# better-sqlite3: node-gyp needs a toolchain.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

# Install without lifecycle scripts first (prepare needs svelte.config.js, which is not copied yet).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
# Full install: svelte-kit sync + native addons, then build and production deps only.
RUN bun install --frozen-lockfile \
	&& bun run build \
	&& bun install --frozen-lockfile --production

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Rebuild native addon for Node (not Bun’s embedded ABI).
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
# Include load-test tooling and DB source modules used by tsx runtime scripts.
# Without these, `npm run load:*` fails in the slim runtime image.
COPY --from=builder /app/scripts/load ./scripts/load
COPY --from=builder /app/src/lib/db ./src/lib/db

RUN npm rebuild better-sqlite3

ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/data/postplan.db

EXPOSE 3000

CMD ["node", "build/index.js"]
