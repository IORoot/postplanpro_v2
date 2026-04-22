# Stripe setup for PostPlan Pro

This guide matches how PostPlan Pro integrates Stripe: Checkout **subscriptions**, Customer Billing Portal, and a single **Pro monthly** price per environment. The app uses **secret keys only** (no publishable key in the codebase). Webhooks hit **`POST /api/stripe/webhook`**.

Stripe Dashboard has two worlds: **Test mode** and **Live mode** (toggle top right). You repeat product/price/portal/webhook steps in each mode and copy values into the matching environment variables.

---

## 1. Prerequisites

1. **Stripe account** — [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Public app URL** — set `APP_BASE_URL` to the canonical origin your users use (no trailing slash), e.g. `https://app.postplanpro.com`. Checkout success/cancel URLs and the Billing Portal return URL are built from this value.
3. **Mode switch** — PostPlan uses `STRIPE_MODE=test` or `STRIPE_MODE=live` (default is `live` if unset). An admin can also override mode in the database (`app_setting.stripe_mode`); when that is set, it wins over the env var. See [§ Mode and secrets](#5-mode-and-secrets-test-vs-live).

---

## 2. API keys

### Test mode

1. Turn **Test mode** **on** in the Dashboard.
2. Go to **Developers → API keys**.
3. Copy **Secret key** (`sk_test_…`) → `STRIPE_SECRET_KEY_TEST` in your env (e.g. `.env`, hosting secrets).  
   *Optional:* Restricted keys are not documented here; use a standard secret key unless you have a key rotation policy that requires restricted keys with the right permissions (Checkout, Customers, Subscriptions, Billing Portal, Webhooks).

### Live mode

1. Turn **Test mode** **off**.
2. **Developers → API keys** → copy **Secret key** (`sk_live_…`) → `STRIPE_SECRET_KEY`.

**Security:** Never commit keys. Use your host’s secret store. Restrict who can view live keys.

---

## 3. Product and price (Pro monthly)

PostPlan Checkout creates a **subscription** with **one line item**: the price ID from `STRIPE_PRICE_ID_PRO_MONTHLY` (live) or `STRIPE_PRICE_ID_PRO_MONTHLY_TEST` (test).

### Test mode

1. **Test mode on** → **Product catalog → Products → Add product**.
2. Name e.g. `PostPlan Pro` (or your public name).
3. Add a **recurring** price (typically **monthly** billing). Save.
4. Open the **Price** (not only the product) and copy the **Price ID** (`price_…`) → `STRIPE_PRICE_ID_PRO_MONTHLY_TEST`.

### Live mode

Repeat the same steps with **Test mode off**. Copy the live price ID → `STRIPE_PRICE_ID_PRO_MONTHLY`.

Use separate test and live prices so test checkouts never touch real money.

---

## 4. Customer Billing Portal

The app redirects subscribers to Stripe’s **Billing Portal** (`/api/stripe/portal`) so they can manage payment methods and cancel.

1. In the Dashboard (**same mode** as the keys you use), go to **Settings → Billing → Customer portal** (or search “Customer portal”).
2. **Activate** the portal and enable the capabilities you want (e.g. cancel subscription, update payment method).  
3. No portal “client ID” is stored in PostPlan; configuration is entirely in Stripe. Ensure the **Products** that appear in the portal include your Pro subscription if Stripe asks for product visibility.

Repeat for **test** and **live** if you test portal flows in both modes.

---

## 5. Mode and secrets (test vs live)

| Variable | Used when |
|----------|-----------|
| `STRIPE_MODE` | `test` → test stack; anything else (including unset) → live stack. |
| `STRIPE_SECRET_KEY_TEST` | Effective mode is **test**. |
| `STRIPE_WEBHOOK_SECRET_TEST` | Effective mode is **test**. |
| `STRIPE_PRICE_ID_PRO_MONTHLY_TEST` | Effective mode is **test**. |
| `STRIPE_SECRET_KEY` | Effective mode is **live**. |
| `STRIPE_WEBHOOK_SECRET` | Effective mode is **live**. |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Effective mode is **live**. |

**Effective mode** is `test` or `live` from `app_setting.stripe_mode` in the database if set; otherwise it follows `STRIPE_MODE`. The admin Stripe page can set or clear that override.

**Recommendation:** In production, set `STRIPE_MODE=live` explicitly. Use `STRIPE_MODE=test` on staging or local machines that should only talk to test keys.

---

## 6. Webhooks

Endpoint URL (same path for every deployment; origin must match where Stripe can reach you):

```text
{APP_BASE_URL}/api/stripe/webhook
```

Example: `https://app.postplanpro.com/api/stripe/webhook`

### Events to send

Create **one** webhook endpoint per Dashboard mode (test vs live) and select at least:

| Event | Why |
|--------|-----|
| `checkout.session.completed` | Sets user to **pro**, stores Stripe customer and subscription IDs. |
| `customer.subscription.updated` | Downgrades to **free** when status is `canceled` or `unpaid`. |
| `customer.subscription.deleted` | Downgrades to **free** when subscription is removed. |

You can subscribe to more events in Stripe, but only these are handled.

### Signing secret

After creating the endpoint, open it and click **Reveal** under **Signing secret** (`whsec_…`):

- **Test** webhook → `STRIPE_WEBHOOK_SECRET_TEST`
- **Live** webhook → `STRIPE_WEBHOOK_SECRET`

The app verifies signatures with the secret that matches **effective** Stripe mode (same rules as API keys).

### Local development

Stripe cannot reach `localhost` directly. Options:

1. **Stripe CLI** — `stripe listen --forward-to localhost:5173/api/stripe/webhook` and use the CLI’s temporary signing secret as `STRIPE_WEBHOOK_SECRET_TEST` while developing with test keys, **or**
2. Expose dev server via **ngrok** (or similar) and register that HTTPS URL as a **test** webhook in the Dashboard.

When using the CLI, events are **test mode**; keep `STRIPE_MODE=test` and test keys/prices aligned.

---

## 7. Environment variable checklist

Paste into your secrets file or host UI (names must match exactly):

**Always**

- `APP_BASE_URL` — public origin, no trailing slash.

**Test stack** (local / staging using Stripe test mode)

- `STRIPE_MODE=test`
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_WEBHOOK_SECRET_TEST`
- `STRIPE_PRICE_ID_PRO_MONTHLY_TEST`

**Live stack** (production)

- `STRIPE_MODE=live` (recommended even though live is the default)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PRO_MONTHLY`

If any required secret/price is missing for the active mode, Checkout and Portal return **503** (“Stripe is not configured”).

---

## 8. Verification checklist

1. **Test mode:** Create account → open upgrade/checkout link → pay with [Stripe test cards](https://docs.stripe.com/testing#cards). Confirm redirect to `/account?stripe=success` and that the user shows as Pro after webhook fires.
2. **Dashboard → Webhooks →** your endpoint: recent deliveries **2xx**; fix URL or signing secret if **400**.
3. **Portal:** With a user that has `stripe_customer_id` set (after successful checkout), open Billing Portal; confirm return to `/account`.
4. **Cancellation:** Cancel in portal or Dashboard; confirm user returns to **free** after `customer.subscription.updated` / `deleted` is processed.

---

## 9. Optional: Stripe Tax, invoices, branding

Not required by the current code paths. Configure in Stripe Dashboard if you need tax IDs, invoice customization, or email branding; Checkout and Portal will pick up what you enable on the Stripe side where applicable.

---

## Reference: routes and behavior

| Route | Purpose |
|--------|---------|
| `GET /api/stripe/checkout` | Creates Checkout Session (`mode: subscription`), `client_reference_id` = app user id. |
| `GET /api/stripe/portal` | Billing Portal for existing `stripe_customer_id`. |
| `POST /api/stripe/webhook` | Verifies signature; updates `tier` and Stripe IDs in SQLite. |

Stripe API version in code is pinned in server modules (see `Stripe` client initialization in `src/routes/api/stripe/*`); keep the `stripe` npm package compatible with that version when upgrading dependencies.
