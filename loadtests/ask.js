// k6 load test: streaming /api/ask under concurrency.
//
//   k6 run loadtests/ask.js                       # against localhost:8001
//   BASE=http://localhost:8001 k6 run loadtests/ask.js
//
// Requires a seeded load-test tenant (backend: manage.py seed_loadtest) and a
// no-cost chat provider (LLM_PROVIDER=fake) so the numbers measure OUR
// pipeline (retrieval + streaming + gunicorn threading), not the model.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const BASE = __ENV.BASE || 'http://localhost:8001'
const EMAIL = __ENV.USER || 'load@openvault.test'
const PASSWORD = __ENV.PASS || 'loadtest-pass'

const ttft = new Trend('ask_ttft_ms', true)   // time to first byte ≈ first NDJSON line
const full = new Trend('ask_full_ms', true)   // whole streamed answer
const errors = new Rate('ask_errors')

export const options = {
  scenarios: {
    steady: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '20s', target: 5 },   // the launch profile: a handful of users
        { duration: '40s', target: 5 },
        { duration: '20s', target: 15 },  // find the degradation point
        { duration: '30s', target: 15 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    ask_errors: ['rate<0.02'],
    'ask_full_ms{scenario:steady}': ['p(95)<30000'],
  },
}

export function setup() {
  const login = http.post(`${BASE}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } })
  check(login, { 'login 200': (r) => r.status === 200 })
  return { cookie: login.cookies['openvault_access'][0].value }
}

export default function (data) {
  const t0 = Date.now()
  const res = http.post(`${BASE}/api/ask`,
    JSON.stringify({ question: `What is section ${__VU} of the policy?`, mode: 'online' }),
    {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `openvault_access=${data.cookie}`,
      },
      timeout: '120s',
    })
  const t1 = Date.now()
  const ok = check(res, {
    'ask 200': (r) => r.status === 200,
    'has sources event': (r) => r.body.includes('"type": "sources"'),
    'has done event': (r) => r.body.includes('"type": "done"'),
  })
  errors.add(!ok)
  ttft.add(res.timings ? res.timings.waiting : t1 - t0)
  full.add(Date.now() - t0)
  sleep(1)
}
