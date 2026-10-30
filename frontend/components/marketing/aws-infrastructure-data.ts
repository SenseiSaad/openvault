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
    body: 'AWS Amplify builds and serves the static Next.js frontend through AWS edge delivery. Route 53 is the target for the production domain at cutover; the beta may use another DNS provider while that is prepared.',
    nodes: [
      { label: 'AWS Amplify', detail: 'live static hosting', icon: Cloud },
      { label: 'CloudFront', detail: 'global edge delivery', icon: ShieldCheck },
      { label: 'Next.js export', detail: 'no SSR runtime', icon: Globe2 },
      { label: 'Route 53', detail: 'production DNS target', icon: Globe2 },
    ],
    tags: ['Amplify · live', 'Static export', 'Route 53 at cutover'],
    note: 'Amplify’s managed Next runtime currently supports through Next 15, so OpenVault ships as a static export.',
  },
  {
    id: 'store',
    label: 'Store',
    index: '02',
    icon: Database,
    title: 'The API and files get an AWS home.',
    body: 'The production target is ECS/Fargate for the Django API, RDS PostgreSQL for relational data, and S3 for uploads and generated forms. The private beta may run on supporting test infrastructure until that cutover is complete.',
    nodes: [
      { label: 'ECS / Fargate', detail: 'Django + Gunicorn target', icon: Server },
      { label: 'RDS PostgreSQL', detail: 'managed relational data', icon: Database },
      { label: 'Amazon S3', detail: 'uploads + generated forms', icon: HardDrive },
      { label: 'Snapshots', detail: 'backup + restore target', icon: KeyRound },
    ],
    tags: ['Target: ECS · RDS · S3', 'No SQLite in production', 'Cutover after beta'],
    note: 'Move uploads to S3 before running multiple API tasks; a container-local disk cannot be shared safely across tasks.',
  },
  {
    id: 'think',
    label: 'Think',
    index: '03',
    icon: BrainCircuit,
    title: 'AI that stays inside the boundary.',
    body: 'Permission filtering happens before retrieval. Only passages a person is allowed to see are sent to Amazon Bedrock over TLS; Claude Haiku 4.5 answers and Titan V2 produces embeddings in the AWS India profile.',
    nodes: [
      { label: 'Permission filter', detail: 'access before retrieval', icon: LockKeyhole },
      { label: 'Bedrock runtime', detail: 'server-side secret', icon: Cloud },
      { label: 'Claude + Titan', detail: 'chat + embeddings', icon: BrainCircuit },
      { label: 'Cited answer', detail: 'sources + pages', icon: Check },
    ],
    tags: ['India inference profile', 'No model training', 'Key kept server-side'],
    note: 'The model receives approved passages only. The Bedrock key stays on the server and is never shipped to the browser.',
  },
  {
    id: 'watch',
    label: 'Watch',
    index: '04',
    icon: Activity,
    title: 'Deploys and spend stay visible.',
    body: 'Amplify records frontend builds and deploys. CloudWatch will carry API logs, metrics and alarms at the AWS cutover, and AWS Budgets tracks Bedrock spend before usage grows.',
    nodes: [
      { label: 'Git push', detail: 'frontend + API source', icon: Activity },
      { label: 'Amplify', detail: 'frontend build history', icon: Eye },
      { label: 'CloudWatch', detail: 'logs + alarms target', icon: ShieldCheck },
      { label: 'AWS Budgets', detail: 'Bedrock spend alerts', icon: KeyRound },
    ],
    tags: ['Build history', 'Health checks', 'Spend alerts'],
    note: 'Set a Bedrock budget alert before inviting testers; a spend alarm is cheaper than a surprise.',
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
    icon: Database,
    label: 'Keeps data persistent',
    body: 'The AWS target uses RDS and S3 so data outlives a deploy.',
  },
  {
    icon: Eye,
    label: 'Shows AI spend',
    body: 'AWS Budgets tracks Bedrock; the beta stack is monitored separately.',
  },
]
