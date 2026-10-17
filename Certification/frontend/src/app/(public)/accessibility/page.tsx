import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Accessibility" };

const commitments = [
  "The interface targets WCAG 2.2 Level AA conformance, including contrast, focus visibility, target sizes and consistent help.",
  "All interactive features are operable with a keyboard alone, with visible focus indicators and a skip-to-content link on every page.",
  "Status is never communicated by color alone — icons and text labels accompany every status indicator.",
  "Animations respect the operating-system reduced-motion preference.",
  "Forms use programmatic labels, descriptions and error messages announced to assistive technology.",
  "Tables, dialogs, menus and notifications follow WAI-ARIA authoring practices."
];

export default function AccessibilityPage() {
  return (
    <div className="container max-w-3xl py-10">
      <PageHeader title="Accessibility statement" description="Our commitment to an accessible learning platform." />
      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Commitment</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          {commitments.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h2 className="mb-3 mt-6 text-lg font-semibold">Reporting a barrier</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If you encounter an accessibility barrier, report it to your agency administrator or the Certification
          Academy support contact. We aim to acknowledge reports promptly and provide content in an alternative format
          where needed.
        </p>
      </section>
    </div>
  );
}
