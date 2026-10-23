import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { AwsControlRoom } from './aws-control-room'
import { AWS_OUTCOMES } from './aws-infrastructure-data'

export function AwsInfrastructure() {
  return (
    <section
      id="infrastructure"
      className="scroll-mt-24 py-20 sm:py-24 lg:py-28"
      aria-labelledby="aws-heading"
    >
      <div className="container-page">
        <Reveal>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Under the hood · AWS</p>
              <h2 id="aws-heading" className="display-lg mt-5">
                Where AWS
                <br />
                <span className="serif text-accent">comes in.</span>
              </h2>
            </div>
            <div className="max-w-sm lg:pb-1">
              <p className="text-sm leading-relaxed text-muted-foreground">
                The launch setup splits responsibilities: AWS Amplify hosts the web app, Render
                runs the API and database, and Amazon Bedrock powers permission-filtered AI.
                Cloudflare manages the custom-domain DNS.
              </p>
              <Link href="/infrastructure" className="link-arrow mt-4">
                Read the AWS blueprint <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div className="mt-11">
            <AwsControlRoom />
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            {AWS_OUTCOMES.map(({ icon: Icon, label, body }) => (
              <div key={label} className="flex items-start gap-3 border-t border-border pt-4">
                <Icon className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="text-[12px] font-medium">{label}</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
