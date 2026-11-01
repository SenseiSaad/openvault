// k6 load test: authenticated browsing endpoints (documents list, me, usage).
//   BASE=http://localhost:8001 k6 run loadtests/browse.js
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = __ENV.BASE || 'http://localhost:8001'
const EMAIL = __ENV.USER || 'load@openvault.test'
const PASSWORD = __ENV.PASS || 'loadtest-pass'

export const options = {
  vus: 10,
  duration: '40s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
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
  const jar = http.cookieJar()
  jar.set(BASE, 'openvault_access', data.cookie)
  const me = http.get(`${BASE}/api/auth/me`)
  check(me, { 'me 200': (r) => r.status === 200 })
  const docs = http.get(`${BASE}/api/documents?page_size=200`)
  check(docs, { 'documents 200': (r) => r.status === 200 })
  const usage = http.get(`${BASE}/api/admin/usage`)
  check(usage, { 'usage 200': (r) => r.status === 200 })
  sleep(1)
}
