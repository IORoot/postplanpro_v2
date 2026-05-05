/* eslint-disable */
/**
 * k6 multi-user UI load script.
 *
 * Hits a mix of UI endpoints from many virtual users to validate the app under
 * 1,000-10,000 concurrent reads (and optional writes if SESSION_COOKIE provided).
 *
 * Run
 *   k6 run scripts/load/k6-multi-user-ui.js \
 *     -e BASE_URL=https://staging.postplanpro.com \
 *     -e VUS=1000 -e DURATION=2m \
 *     -e LOAD_TEST_RUN_ID=loadtest-... \
 *     -e SESSION_COOKIE='authjs.session-token=...'
 *
 * Production guard
 *   When BASE_URL looks like production, ALLOW_PROD_LOAD_TEST=1 and
 *   FORCE_PROD_LOAD_TEST=1 must both be set.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const VUS = Number(__ENV.VUS || '1000');
const DURATION = __ENV.DURATION || '2m';
const RUN_ID = __ENV.LOAD_TEST_RUN_ID || `loadtest-k6-ui-${Date.now()}`;
const SESSION_COOKIE = (__ENV.SESSION_COOKIE || '').trim();
const ALLOW_PROD = (__ENV.ALLOW_PROD_LOAD_TEST || '').toLowerCase();
const FORCE_PROD = (__ENV.FORCE_PROD_LOAD_TEST || '').toLowerCase();

function looksLikeProd(url) {
	return /https?:\/\/([a-z0-9-]+\.)?postplanpro\.com/i.test(url);
}

if (looksLikeProd(BASE_URL)) {
	const allowed = ['1', 'true', 'yes', 'on'].includes(ALLOW_PROD) && ['1', 'true', 'yes', 'on'].includes(FORCE_PROD);
	if (!allowed) {
		throw new Error(
			`Refusing to run against production-looking BASE_URL=${BASE_URL}. ` +
				'Set ALLOW_PROD_LOAD_TEST=1 AND FORCE_PROD_LOAD_TEST=1 to override.'
		);
	}
}

const errors = new Counter('ui_errors_total');
const errorRate = new Rate('ui_error_rate');
const pageLatency = new Trend('ui_page_latency_ms', true);
const authedLatency = new Trend('ui_authed_latency_ms', true);

const PUBLIC_PATHS = ['/', '/auth/login', '/about', '/pricing'];
const AUTHED_PATHS = ['/calendar', '/posts', '/posts?pageSize=20', '/reports', '/outputs/webhooks', '/schedules'];

function pickRandom(list) {
	return list[Math.floor(Math.random() * list.length)];
}

export const options = {
	scenarios: {
		ui_traffic: {
			executor: 'ramping-vus',
			startVUs: Math.max(1, Math.floor(VUS / 10)),
			stages: [
				{ duration: '30s', target: VUS },
				{ duration: DURATION, target: VUS },
				{ duration: '30s', target: 0 }
			],
			gracefulRampDown: '15s'
		}
	},
	thresholds: {
		ui_error_rate: ['rate<0.05'],
		ui_page_latency_ms: ['p(95)<2000', 'p(99)<5000']
	},
	tags: { run_id: RUN_ID, mode: 'ui-k6' }
};

function commonHeaders() {
	const headers = {
		'user-agent': `k6-multi-user-ui/${RUN_ID}`,
		'x-load-test-run-id': RUN_ID
	};
	if (SESSION_COOKIE) headers['cookie'] = SESSION_COOKIE;
	return headers;
}

export default function () {
	const useAuthed = SESSION_COOKIE && Math.random() < 0.6;
	const path = useAuthed ? pickRandom(AUTHED_PATHS) : pickRandom(PUBLIC_PATHS);
	const url = `${BASE_URL}${path}`;
	const res = http.get(url, { headers: commonHeaders(), tags: { path } });
	const ok = check(res, {
		'status<500': (r) => r.status > 0 && r.status < 500,
		'has body': (r) => (r.body ? r.body.length > 0 : false)
	});
	if (useAuthed) authedLatency.add(res.timings.duration);
	else pageLatency.add(res.timings.duration);
	errorRate.add(!ok);
	if (!ok) errors.add(1);
	sleep(0.2 + Math.random() * 0.8);
}

export function handleSummary(data) {
	const summary = {
		run_id: RUN_ID,
		mode: 'ui-k6',
		base_url: BASE_URL,
		vus: VUS,
		duration: DURATION,
		ended_at: new Date().toISOString(),
		metrics: {
			ui_error_rate: data.metrics.ui_error_rate?.values?.rate ?? null,
			ui_errors_total: data.metrics.ui_errors_total?.values?.count ?? 0,
			ui_page_latency_ms_p95: data.metrics.ui_page_latency_ms?.values?.['p(95)'] ?? null,
			ui_page_latency_ms_p99: data.metrics.ui_page_latency_ms?.values?.['p(99)'] ?? null,
			ui_authed_latency_ms_p95: data.metrics.ui_authed_latency_ms?.values?.['p(95)'] ?? null,
			http_req_duration_p95: data.metrics.http_req_duration?.values?.['p(95)'] ?? null,
			http_req_failed_rate: data.metrics.http_req_failed?.values?.rate ?? null,
			iterations: data.metrics.iterations?.values?.count ?? 0
		}
	};
	const dir = `loadtest_results/${RUN_ID}`;
	return {
		[`${dir}/k6-ui-summary.json`]: JSON.stringify(summary, null, 2),
		[`${dir}/k6-ui-raw.json`]: JSON.stringify(data),
		stdout: JSON.stringify(summary, null, 2) + '\n'
	};
}
