'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Minus, Plus } from 'lucide-react'

const FAQS = [
  {
    q: 'Is OpenVault a public document library?',
    a: 'No. There is no public browse area, publisher account, or free-user library. Documents are available only after enterprise sign-in, and only through the permissions the company has granted.',
  },
  {
    q: 'How is this different from a shared drive with AI bolted on?',
    a: 'Access control runs before retrieval. OpenVault filters the permission-aware document set first, then searches it, then sends only those passages to the model. A restricted file is not part of the evidence the assistant can use.',
  },
  {
    q: 'Can the assistant reveal a file I am not allowed to see?',
    a: 'No. The same access rules apply to search, preview, download, and AI retrieval. If a document is outside your scope, it is excluded before the model receives a question.',
  },
  {
    q: 'Where does the AI actually run?',
    a: 'The hosted default uses Amazon Bedrock in the AWS India geographic profile; only permission-approved passages are sent for generation. The Local Ollama option runs generation on the Ollama endpoint configured for the API. A fully local RAG deployment must also use a private embedding endpoint and re-index documents with it.',
  },
  {
    q: 'Can we share a document with another company?',
    a: 'Yes. Find the registered partner by its five-character company code, select one of its employees, and grant one document. Download permission is configurable, access is logged, and revocation is immediate.',
  },
  {
    q: 'What happens when we reach a plan limit?',
    a: 'Nothing breaks and nothing is deleted. The action returns a clear upgrade message, and everything resumes as soon as you move to a larger tier.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="py-20 sm:py-24 lg:py-28" aria-labelledby="faq-heading">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow">Questions</p>
            <h2 id="faq-heading" className="display-lg mt-5">
              Before you
              <br />
              <span className="serif text-accent">trust it.</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Straight answers about access, privacy, and the limits of the assistant. For the full
              operating model, read the field guide.
            </p>
            <Link href="/help" className="link-arrow mt-6">
              Visit the help centre <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          <div className="border-t border-border">
            {FAQS.map((item, index) => {
              const isOpen = open === index
              return (
                <div key={item.q} className="border-b border-border">
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${index}`}
                      id={`faq-trigger-${index}`}
                      className="flex w-full items-start justify-between gap-5 py-5 text-left"
                    >
                      <span className="text-[14px] font-medium leading-snug tracking-[-0.01em] sm:text-[15px]">
                        {item.q}
                      </span>
                      <span
                        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-colors ${
                          isOpen ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground'
                        }`}
                        aria-hidden
                      >
                        {isOpen ? <Minus className="size-3" /> : <Plus className="size-3" />}
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`faq-panel-${index}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${index}`}
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-2xl pb-5 pr-10 text-[13px] leading-relaxed text-muted-foreground">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default FaqSection
