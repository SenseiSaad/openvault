import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Privacy" };

const sections = [
  {
    title: "Data we process",
    body: "Certification Academy processes the information your agency provides when administering training: your name, work email address, role within your agency, learning activity and completion records. Billing information is processed for the purchasing agency, not for individual learners."
  },
  {
    title: "How your data is protected",
    body: "Access to personal data is restricted by role. Authentication uses server-managed session cookies that are HttpOnly and protected against cross-site request forgery. Personal data is never stored in your browser."
  },
  {
    title: "Your agency controls your data",
    body: "Your agency administrator manages your account, invitations and seat assignments. To correct or remove your personal information, contact your agency administrator. Platform administrators may access records to support agencies and comply with legal obligations."
  },
  {
    title: "Contact",
    body: "Questions about this notice can be directed to your agency administrator or to the Certification Academy support contact provided in your agency's agreement."
  }
];

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-10">
      <PageHeader title="Privacy notice" description="How Certification Academy handles personal information." />
      <article className="space-y-6">
        {sections.map((section) => (
          <section key={section.title} className="rounded-lg border bg-card p-6">
            <h2 className="mb-2 text-lg font-semibold">{section.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </article>
    </div>
  );
}
