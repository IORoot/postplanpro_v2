Security Audit Report — PostPlan Pro V2
CRITICAL
[CRITICAL] DoS: ReDoS via user-supplied regular expressions

src/routes/inputs/+page.server.ts lines 88–90, 180, 185, 190 — user input is passed directly to new RegExp(val) with no validation
→ Impact: Catastrophic backtracking patterns (e.g. (a+)+b) can hang the Node.js event loop, causing full service denial
→ Fix: Validate regex complexity before compiling. Use safe-regex or re-validate npm packages. Enforce a max pattern length. Wrap in try/catch with an AbortController timeout
HIGH
[HIGH] Dependencies: Multiple known CVEs in direct dependencies

vite@7.3.1 — path traversal in .map handling (GHSA-4w7w-66w2-5vf9), server.fs.deny bypass (GHSA-v2wj-q39q-566r), arbitrary file read via WebSocket (GHSA-p9ff-h696-f583)
svelte@5.53.0 — XSS via HTML comment injection in SSR (GHSA-qgvg-pr8v-6rr3), XSS with contenteditable bind (GHSA-phwv-c562-gvmh)
nodemailer@7.0.13 — SMTP command injection (GHSA-c7w3-x93f-qmm8)
@sveltejs/kit — deserialization expansion DoS (GHSA-fpg4-jhqr-589c)
cookie — out-of-bounds character acceptance (GHSA-pxg6-pf52-xh8x)
→ Impact: Varies per CVE: server file read, XSS in SSR output, email injection, DoS
→ Fix: bun update vite svelte @sveltejs/kit nodemailer cookie — update all affected packages now
[HIGH] Auth: CRON secret transmitted in URL query parameter

src/routes/api/cron/send-due-posts/+server.ts lines 8–10: url.searchParams.get('secret') accepted as alternative to header
→ Impact: Secret appears in server access logs, browser history, HTTP Referer headers, and any upstream proxy logs
→ Fix: Remove URL-based fallback. Accept secret from x-cron-secret header only. Use timing-safe comparison: crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
[HIGH] Info Disclosure: Callback token included in outbound webhook payloads

src/lib/scheduler/sendDuePosts.ts lines 179–182: out.callback_token = token injected into every webhook POST body
→ Impact: Any webhook recipient (Make.com, Zapier, attacker-controlled URLs) receives the user's callback token and can replay or forge callbacks
→ Fix: Remove callback_token from outbound payloads. Authenticate inbound callbacks via HMAC signature instead
[HIGH] Info Disclosure: Raw error messages returned to client

src/routes/api/callbacks/import/+server.ts lines 301–302, src/lib/scheduler/sendDuePosts.ts lines 191–192: e.message sent directly in API response
→ Impact: Exposes DB schema, internal paths, validation logic, and third-party service URLs to attackers
→ Fix: Log full error server-side; return only a generic message: return json({ error: 'Operation failed.' }, { status: 400 })
MEDIUM
[MEDIUM] SSRF: No validation on webhook URLs

src/routes/outputs/webhooks/+page.server.ts lines 52–59: URL presence checked but not validated
→ Impact: Users can register internal URLs (http://localhost:9000, http://169.254.169.254/...) as webhooks; server will make requests to them on schedule
→ Fix:
function isValidWebhookUrl(urlStr: string) {
  try {
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (/^(localhost|127\.|::1|0\.0\.0\.|169\.254\.)/.test(u.hostname)) return false;
    return true;
  } catch { return false; }
}
[MEDIUM] DoS: No timeout on outbound fetch calls

src/lib/scheduler/sendDuePosts.ts lines 185, 309; RSS fetches in src/routes/inputs/+page.server.ts
→ Impact: Slow or unresponsive webhook/RSS endpoints can hang the scheduler indefinitely
→ Fix: Add AbortController with a 10–15 second timeout to all fetch() calls
[MEDIUM] Crypto: Weak callback token generation

src/lib/server/callbackTokenFormActions.ts lines 8–9: crypto.randomUUID() — 122 bits of entropy, no expiration, no rotation
→ Impact: Tokens are long-lived and not rotatable in bulk; lower entropy than ideal for a bearer token
→ Fix: Use Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex') (256-bit). Add created_at column for future expiry support
[MEDIUM] Type Safety: JSON.parse() results cast to unknown without schema validation

src/routes/account/+page.server.ts line 15, src/routes/outputs/webhooks/+page.server.ts line 8, src/routes/api/callbacks/import/+server.ts line 79
→ Impact: Runtime type confusion if stored JSON has unexpected shape — potential crashes or logic bypasses
→ Fix: Validate parsed JSON with Zod schemas before use
[MEDIUM] Injection: CSV formula injection not prevented

src/routes/inputs/+page.server.ts lines 1140+: raw field values written to CSV
→ Impact: Values starting with =, +, -, @ execute as formulas when opened in Excel/Google Sheets
→ Fix: Prefix such values with ' before writing to CSV
[MEDIUM] DoS: No rate limiting on API callback endpoints

/api/callbacks/import, /api/callbacks/stage
→ Impact: Attacker with a valid token can create unlimited posts or stage records, exhausting database/storage
→ Fix: Implement per-token rate limiting (e.g. 100 req/min). Consider a lightweight middleware or Upstash Redis limiter
LOW
[LOW] Headers: Missing HSTS and CSP headers

src/hooks.server.ts lines 94–106: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy are set — good. But Strict-Transport-Security and Content-Security-Policy are absent
→ Fix:
headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline';");
[LOW] XSS: {@html} usage with non-user data (defense-in-depth gap)

src/routes/outputs/presets/+page.svelte lines 251, 301; src/routes/welcome/technical/+page.svelte lines 269, 273 — currently rendering from static/scenarios.json (safe)
→ Impact: Low now, guaranteed XSS if source ever becomes user-controlled
→ Fix: Wrap with DOMPurify as defense-in-depth: {@html DOMPurify.sanitize(scenario.image)}
[LOW] Logging: No audit trail for security-sensitive operations

Token generation, token usage, OAuth callbacks, and failed auth attempts are not logged
→ Fix: Add structured audit logging (to DB or external log service) for: token issued, token used, auth failure, plan change
CONFIRMED SAFE
Area	Status
CSRF protection
Protected — SvelteKit native form actions
Math.random() usage
Non-security use only (UI colors)
localStorage contents
UI preferences only — not sensitive data
JSON.parse() in account/webhooks
Wrapped in try/catch with type filtering
Security headers (existing)
X-Frame-Options, nosniff, Referrer-Policy all set
Priority Action Plan
This week: 1. Patch ReDoS — add safe-regex check before new RegExp() 2. Update vite, svelte, @sveltejs/kit, nodemailer, cookie 3. Remove callback_token from webhook payloads; switch to HMAC verification 4. Sanitize error responses — no raw e.message to clients 5. Remove URL query param fallback on cron secret; use timing-safe compare

Next two weeks: 6. Add SSRF protection on webhook URL input 7. Add fetch timeouts throughout the scheduler 8. Add rate limiting on callback endpoints 9. Add Zod validation on all JSON.parse() calls 10. Add HSTS + CSP headers 11. Add CSV formula injection sanitization