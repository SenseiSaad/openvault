import {
  Activity,
  BrainCircuit,
  Check,
  Cloud,
  Database,
  Eye,
  Globe2,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Server,
  ShieldCheck,
  TimerReset,
  type LucideIcon,
} from 'lucide-react'

export type AwsFlowNode = {
  label: string
  detail: string
  icon: LucideIcon
}

export type AwsLayer = {
  id: string
  label: string
  index: string
  icon: LucideIcon
  title: string
  body: string
  nodes: AwsFlowNode[]
  tags: string[]
  note: string
}

export const AWS_LAYERS: AwsLayer[] = [
  {
    id: 'serve',
    label: 'Serve',
    index: '01',
    icon: Cloud,
    title: 'The web app ships on AWS.',
    body: 'Cloudflare manages DNS for the custom domain. AWS Amplify builds and serves the static Next.js frontend; browser requests then reach the separate Django API on Render.',
    nodes: [
      { label: 'Cloudflare DNS', detail: 'custom domain records', icon: Globe2 },
      { label: 'AWS Amplify', detail: 'Next.js static export', icon: Cloud },
      { label: 'CloudFront CDN', detail: 'global static delivery', icon: ShieldCheck },
      { label: 'Render API', detail: 'Django at api.saadops.site', icon: Server },
    ],
    tags: ['Monorepo app root: frontend', 'HTTPS custom domains', 'API origin set at build'],
    note: 'The frontend is a static export for Next.js 16; SSR stays off because Amplify’s managed Next runtime currently supports through Next 15.',
  },
  {
    id: 'store',
    label: 'Store',
    index: '02',
    icon: Database,
    title: 'The API and files have a persistent home.',
    body: 'The Django API and PostgreSQL database run on Render in Singapore. Uploads and generated forms use a Render persistent disk so files survive container restarts; this is a single-instance launch setup.',
    nodes: [
      { label: 'Render API', detail: 'Django + Gunicorn', icon: Server },
      { label: 'Render PostgreSQL', detail: 'managed relational data', icon: Database },
      { label: 'Persistent disk', detail: 'uploads + generated forms', icon: HardDrive },
      { label: 'Restore plan', detail: 'database + disk snapshots', icon: KeyRound },
    ],
    tags: ['No SQLite in production', 'Persistent uploads', 'Single API instance initially'],
    note: 'The disk-backed API cannot scale horizontally yet. Move documents to shared object storage before adding multiple API instances.',
  },
  {
    id: 'think',
    label: 'Think',
    index: '03',
    icon: BrainCircuit,
    title: 'AI that stays inside the boundary.',
    body: 'Permission filtering happens before retrieval. Only passages a person is allowed to see are sent from the Render API to Amazon Bedrock over TLS; Claude Haiku 4.5 answers and Titan V2 produces embeddings in AWS India.',
    nodes: [
      { label: 'Permission filter', detail: 'access before retrieval', icon: LockKeyhole },
      { label: 'Bedrock runtime', detail: 'restricted backend secret', icon: Cloud },
      { label: 'Claude + Titan', detail: 'chat + embeddings', icon: BrainCircuit },
      { label: 'Cited answer', detail: 'sources + pages', icon: Check },
    ],
    tags: ['India inference profile', 'No model training', 'Key kept on backend'],
    note: 'The model receives approved passages only. Because the API runs outside AWS, the Bedrock key is stored as a Render secret—not an ECS task role.',
  },
  {
    id: 'watch',
    label: 'Watch',
    index: '04',
    icon: Activity,
    title: 'Deploys and spend stay visible.',
    body: 'Amplify records frontend builds and deploys. Render provides API logs, health checks, and database/disk operations. AWS billing alerts make Bedrock usage visible before it grows.',
    nodes: [
      { label: 'Git push', detail: 'frontend + API source', icon: Activity },
      { label: 'Amplify', detail: 'frontend build history', icon: Eye },
      { label: 'Render', detail: 'API logs + health', icon: ShieldCheck },
      { label: 'AWS Budgets', detail: 'Bedrock spend alerts', icon: KeyRound },
    ],
    tags: ['Separate deploys', 'Health endpoint', 'No secrets in source'],
    note: 'Keep provider keys in Render’s secret environment and set a Bedrock budget alert in AWS before onboarding users.',
  },
]

export const AWS_OUTCOMES = [
  {
    icon: Server,
    label: 'Ships cleanly',
    body: 'Amplify rebuilds the static frontend from the frontend/ app root.',
  },
  {
    icon: LockKeyhole,
    label: 'Checks access first',
    body: 'Tenant and document permissions filter evidence before model calls.',
  },
  {
    icon: TimerReset,
    label: 'Keeps data persistent',
    body: 'Render Postgres and an attached disk keep data beyond a deploy.',
  },
  {
    icon: Eye,
    label: 'Shows AI spend',
    body: 'Set AWS Budgets for Bedrock; review logs in Amplify and Render.',
  },
]
