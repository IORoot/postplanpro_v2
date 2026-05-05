/* eslint-disable */
/**
 * k6 multi-user concurrent posting load.
 *
 * Simulates N synthetic "users" all firing webhook deliveries at the listener
 * concurrently (the multi-user version of the single-user 5,000/10,000 tests).
 *
 * Flags
 *   TARGET_URL      Required. Listener endpoint, typically http://<host>:4000/webhook.
 *   LISTENER_TOKEN  Optional. Sent as x-load-test-token if set.
 *   USERS           How many distinct synthetic personas (default 1000).
 *   POSTS_PER_USER  How many posts each persona sends (default 10).
 *   VUS             Concurrent VUs (default = min(USERS, 1000)).
 *   DURATION        Hold duration after ramp (default '1m'). 0 = run-to-completion.
 *   LOAD_TEST_RUN_ID  Override run id, otherwise auto-generated.
 *
 * Run
 *   k6 run scripts/load/k6-multi-user-posting.js \
 *     -e TARGET_URL=http://receiver:4000/webhook \
 *     -e LISTENER_TOKEN=CHANGEME \
 *     -e USERS=1000 -e POSTS_PER_USER=5 -e VUS=500
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const TARGET_URL = (__ENV.TARGET_URL || '').trim();
if (!TARGET_URL) throw new Error('TARGET_URL is required');

const LISTENER_TOKEN = (__ENV.LISTENER_TOKEN || '').trim();
const USERS = Math.max(1, Number(__ENV.USERS || '1000'));
const POSTS_PER_USER = Math.max(1, Number(__ENV.POSTS_PER_USER || '10'));
const TOTAL_POSTS = USERS * POSTS_PER_USER;
const VUS = Math.max(1, Number(__ENV.VUS || Math.min(USERS, 1000)));
const DURATION = __ENV.DURATION || '1m';
const RUN_ID = __ENV.LOAD_TEST_RUN_ID || `loadtest-k6-posting-${Date.now()}`;
const ALLOW_PROD = (__ENV.ALLOW_PROD_LOAD_TEST || '').toLowerCase();
const FORCE_PROD = (__ENV.FORCE_PROD_LOAD_TEST || '').toLowerCase();

function looksLikeProd(url) {
	return /https?:\/\/([a-z0-9-]+\.)?postplanpro\.com/i.test(url);
}
if (looksLikeProd(TARGET_URL)) {
	const allowed = ['1', 'true', 'yes', 'on'].includes(ALLOW_PROD) && ['1', 'true', 'yes', 'on'].includes(FORCE_PROD);
	if (!allowed) {
		throw new Error(
			`Refusing to run against production-looking TARGET_URL=${TARGET_URL}. ` +
				'Set ALLOW_PROD_LOAD_TEST=1 AND FORCE_PROD_LOAD_TEST=1 to override.'
		);
	}
}

const sent = new Counter('post_sent_total');
const errors = new Counter('post_errors_total');
const errorRate = new Rate('post_error_rate');
const latency = new Trend('post_latency_ms', true);

export const options =
	__ENV.RUN_TO_COMPLETION === '1'
		? {
				scenarios: {
					complete_all: {
						executor: 'shared-iterations',
						vus: VUS,
						iterations: TOTAL_POSTS,
						maxDuration: __ENV.MAX_DURATION || '15m'
					}
				},
				thresholds: {
					post_error_rate: ['rate<0.02'],
					post_latency_ms: ['p(95)<2000', 'p(99)<5000']
				},
				tags: { run_id: RUN_ID, mode: 'posting-k6' }
			}
		: {
				scenarios: {
					steady_post: {
						executor: 'ramping-vus',
						startVUs: Math.max(1, Math.floor(VUS / 10)),
						stages: [
							{ duration: '30s', target: VUS },
							{ duration: DURATION, target: VUS },
							{ duration: '15s', target: 0 }
						],
						gracefulRampDown: '15s'
					}
				},
				thresholds: {
					post_error_rate: ['rate<0.02'],
					post_latency_ms: ['p(95)<2000', 'p(99)<5000']
				},
				tags: { run_id: RUN_ID, mode: 'posting-k6' }
			};

let GLOBAL_SEQ = 0;

export default function () {
	GLOBAL_SEQ += 1;
	const sequence = (__VU - 1) * 1_000_000 + __ITER + 1;
	const personaIdx = sequence % USERS;
	const persona = `persona-${personaIdx}`;
	const now = new Date();
	const body = JSON.stringify({
		load_test_run_id: RUN_ID,
		load_test_sequence: sequence,
		load_test_persona: persona,
		load_test_scenario: 'multi_user_post',
		title: `Load post #${sequence} from ${persona}`,
		content: 'multi-user posting load',
		scheduled_at: now.toISOString(),
		sent_at: now.toISOString()
	});
	const headers = { 'content-type': 'application/json' };
	if (LISTENER_TOKEN) headers['x-load-test-token'] = LISTENER_TOKEN;
	const res = http.post(TARGET_URL, body, { headers, tags: { persona } });
	const ok = check(res, { 'status 2xx': (r) => r.status >= 200 && r.status < 300 });
	latency.add(res.timings.duration);
	sent.add(1);
	errorRate.add(!ok);
	if (!ok) errors.add(1);
	if (__ENV.RUN_TO_COMPLETION !== '1') sleep(0.05);
}

export function handleSummary(data) {
	const summary = {
		run_id: RUN_ID,
		mode: 'posting-k6',
		target_url: TARGET_URL,
		users: USERS,
		posts_per_user: POSTS_PER_USER,
		total_posts_planned: TOTAL_POSTS,
		vus: VUS,
		duration: DURATION,
		ended_at: new Date().toISOString(),
		metrics: {
			post_sent_total: data.metrics.post_sent_total?.values?.count ?? 0,
			post_errors_total: data.metrics.post_errors_total?.values?.count ?? 0,
			post_error_rate: data.metrics.post_error_rate?.values?.rate ?? null,
			post_latency_ms_p50: data.metrics.post_latency_ms?.values?.['p(50)'] ?? null,
			post_latency_ms_p95: data.metrics.post_latency_ms?.values?.['p(95)'] ?? null,
			post_latency_ms_p99: data.metrics.post_latency_ms?.values?.['p(99)'] ?? null,
			http_req_duration_p95: data.metrics.http_req_duration?.values?.['p(95)'] ?? null,
			http_req_failed_rate: data.metrics.http_req_failed?.values?.rate ?? null,
			iterations: data.metrics.iterations?.values?.count ?? 0
		}
	};
	const dir = `loadtest_results/${RUN_ID}`;
	return {
		[`${dir}/k6-posting-summary.json`]: JSON.stringify(summary, null, 2),
		[`${dir}/k6-posting-raw.json`]: JSON.stringify(data),
		stdout: JSON.stringify(summary, null, 2) + '\n'
	};
}
