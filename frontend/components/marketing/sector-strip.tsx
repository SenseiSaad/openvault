const SECTORS = [
  'Finance',
  'Legal',
  'People operations',
  'Healthcare',
  'Consulting',
  'Technology',
  'Education',
  'Public sector',
]

export function SectorStrip() {
  return (
    <section className="border-y border-border bg-surface/45" aria-label="Industries OpenVault supports">
      <div className="container-page flex flex-col gap-3 py-7 sm:flex-row sm:items-baseline sm:justify-between sm:py-8">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Built for teams that can&apos;t afford a leak
        </p>
        <p className="text-[10.5px] text-muted-foreground">Tenant-isolated · Permission-aware · Auditable</p>
      </div>

      <div className="container-page border-t border-border/70">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {SECTORS.map((sector, index) => {
            const classes = [
              'flex items-center gap-3 border-border/70 px-4 py-4 md:px-5 md:py-5',
              index % 2 !== 0 ? 'border-l' : '',
              index >= 2 ? 'border-t' : '',
              index >= 4 ? 'md:border-t' : 'md:border-t-0',
              index % 4 !== 0 ? 'md:border-l' : 'md:border-l-0',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div key={sector} className={classes}>
                <span className="size-1 shrink-0 rotate-45 bg-accent/70" aria-hidden />
                <span className="text-[clamp(0.95rem,1.25vw,1.1rem)] font-medium tracking-[-0.025em] text-foreground/75">
                  {sector}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default SectorStrip
