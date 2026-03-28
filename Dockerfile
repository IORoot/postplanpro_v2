# Build SvelteKit (adapter-node) with Bun; run the Node server the adapter emits.
FROM oven/bun:1.3 AS builder
WORKDIR /app

# better-sqlite3: Bun does not use prebuilds yet; node-gyp needs a toolchain.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build \
	&& bun install --frozen-lockfile --production

FROM oven/bun:1.3 AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build

ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/data/postplan.db

EXPOSE 3000

CMD ["bun", "build/index.js"]
