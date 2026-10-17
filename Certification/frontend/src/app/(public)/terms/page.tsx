import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Terms" };

const sections = [
  {
    title: "Use of the platform",
    body: "Access is provided to authorized users of subscribing government agencies. Accounts are provisioned by agency invitation only; sharing accounts or accessing areas outside your assigned role is prohibited and logged."
  },
  {
    title: "Training records",
    body: "Completion certificates issued through the platform reflect the requirements of each product as published in the catalogue. Your agency remains responsible for confirming which certifications satisfy its internal and regulatory requirements."
  },
  {
    title: "Purchases and entitlements",
    body: "Subscriptions and seat entitlements are purchased by agencies under their own agreements. Learners are never billed directly through the platform."
  },
  {
    title: "Changes to terms",
    body: "These terms may be updated to reflect platform changes. Material changes affecting agencies will be communicated through agency administrators."
  }
];

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-10">
      <PageHeader title="Terms of use" description="Conditions governing use of Certification Academy." />
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
