# PostPlan – Webhook Post Planner

Plan and send JSON payloads to webhooks on a schedule. Create posts, attach schedules, import from WordPress, and send at the right time.

This repo uses [Bun](https://bun.sh) only for installs and scripts (`bun install`, `bun run …`, `bunx …`). You do not need the Node.js runtime installed for development, tests, or running the production build (`bun ./build` after `bun run build`).

The dependency `@sveltejs/adapter-node` is SvelteKit’s standard self-hosted server bundle. You can run `bun ./build/index.js` locally after `bun run build`; the **Docker image** runs `node build/index.js` and runs `npm rebuild better-sqlite3` so the native SQLite addon matches the runtime (Bun’s install layout was missing `.node` bindings in the container).

## Developing

```sh
bun install
bun run dev
```

Optional **pre-push version bump** (prompts whether to bump semver, update `changelog.md`, and `package.json`): `git config core.hooksPath scripts/git-hooks` once per clone. Skip with `SKIP_VERSION_BUMP=1 git push`. See `scripts/bump-version.sh`.

## Building

```sh
bun run build
bun run preview
```

## Sending scheduled posts

Scheduled posts are sent when something invokes the app’s cron handler. Either:

1. **Docker / single Node process** — set `ENABLE_INTERNAL_CRON=true` (the default in `docker-compose.yml`). The server runs `sendDuePosts` on a timer (every 60s by default; override with `INTERNAL_CRON_INTERVAL_MS`, minimum 10000). Turn this **off** if you run multiple app replicas and use an external trigger instead, so only one instance sends.

   The **GitHub deploy workflow** (`.github/workflows/deploy.yml`) installs a **host crontab** entry that runs `scripts/postplan-cron-hit.sh` every minute and appends `ENABLE_INTERNAL_CRON=false` to `.env` when that variable is unset, so the container does not poll twice. Set `ENABLE_INTERNAL_CRON` in your base64-encoded env if you need a different combination.

2. **External HTTP cron** — set `CRON_SECRET`, then call the endpoint every minute (e.g. system cron or [cron-job.org](https://cron-job.org)) with the secret in a header:

```sh
curl -H "X-Cron-Secret: YOUR_SECRET" "https://your-app.com/api/cron/send-due-posts"
```

---

# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
bunx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
bunx sv create --template minimal --types ts --no-install .
```

## Developing

After `bun install`, start a development server:

```sh
bun run dev

# or start the server and open the app in a new browser tab
bun run dev -- --open
```

## Building

To create a production version of your app:

```sh
bun run build
```

You can preview the production build with `bun run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
