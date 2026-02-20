# PostPlan – Webhook Post Planner

Plan and send JSON payloads to webhooks on a schedule. Create posts, attach schedules, import from WordPress, and send at the right time.

## Developing

```sh
npm install
npm run dev
```

## Building

```sh
npm run build
npm run preview
```

## Sending scheduled posts

Scheduled posts are sent when the cron endpoint is called. Set `CRON_SECRET` in your environment (see `.env.example`), then call the endpoint every minute (e.g. with system cron or [cron-job.org](https://cron-job.org)):

```sh
curl -H "X-Cron-Secret: YOUR_SECRET" "https://your-app.com/api/cron/send-due-posts"
```

Or with query param: `GET /api/cron/send-due-posts?secret=YOUR_SECRET`

---

# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv create --template minimal --types ts --no-install .
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
