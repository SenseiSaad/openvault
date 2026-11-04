#!/usr/bin/env python3
"""Generate the local demo knowledge corpus for OpenVault Global.

Creates demo_docs/*.md — 26 policy/knowledge documents (200+ lines each, each
about a DIFFERENT subject) and 6 template documents (email / form / application
/ letter formats with [Field name] placeholders). Deterministic: re-running
produces identical files.

Run: python3 scripts/generate_demo_docs.py
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "demo_docs"

COMPANY = "OpenVault Global"
REGIONS = ["Karachi", "Lahore", "Islamabad", "Dubai", "London", "Singapore", "Austin"]


def meta(title, code, owner, version="3.2"):
    return [
        f"# {title}",
        "",
        f"**Document code:** {code}  ",
        f"**Owner:** {owner}  ",
        f"**Applies to:** {COMPANY} and all wholly owned subsidiaries  ",
        f"**Version:** {version}  ",
        "**Classification:** Internal - staff and authorised contractors  ",
        "**Effective date:** 2026-01-01  ",
        "**Next review:** 2027-01-01  ",
        "**Approved by:** Group Policy Committee  ",
        "",
        "---",
        "",
        "## 1. Document control",
        "",
        "| Field | Value |",
        "| --- | --- |",
        f"| Publisher | {COMPANY} Group Secretariat |",
        f"| Policy owner | {owner} |",
        "| Review cycle | Annual, or on material regulatory change |",
        "| Supersedes | All prior versions of this document |",
        "| Contact | policy@openvault.example |",
        "",
        "This document is maintained under the Group Document Control Standard. "
        "Changes require an approved change request, a documented impact "
        "assessment, and a communication note to all affected teams.",
        "",
    ]


def section(n, heading, bullets):
    out = [f"## {n}. {heading}", ""]
    for b in bullets:
        out.append(f"- {b}")
    out.append("")
    out.extend([
        f"### {n}.1 Operational notes",
        "",
        f"Managers in {REGIONS[n % len(REGIONS)]} are responsible for applying this "
        "section consistently. Exceptions must be recorded in the policy exception "
        "register with a named approver and an expiry date.",
        "",
        f"Evidence of compliance is retained for seven years in the group "
        "records repository. Internal Audit samples this section each quarter.",
        "",
    ])
    return out


DOCS = [
    ("Group Leave and Time-Off Policy", "HR-001", "People & Culture",
     ["annual leave", "sick leave", "casual leave", "parental leave", "public holidays",
      "leave encashment", "carry-forward", "approval workflow", "half-day leave",
      "unpaid leave", "bereavement leave", "study leave", "pilgrimage leave",
      "leave without approval", "record keeping", "regional variations"],
     ["Employees accrue 20 working days of paid annual leave per calendar year.",
      "Casual leave is capped at 10 working days and cannot be combined with sick leave.",
      "Sick leave beyond three consecutive days requires a medical certificate.",
      "Parental leave is granted in line with the law of the employing country.",
      "Public holidays follow the official calendar published for each office location.",
      "Unused annual leave up to five days may be carried into the next year.",
      "Half-day leave is recorded in four-hour increments in the HR system.",
      "All leave requests must be submitted at least three working days in advance.",
      "Managers approve or reject requests within two working days.",
      "Leave without prior approval is treated as an unauthorised absence.",
      "Leave balances are visible to employees in the self-service portal.",
      "Payroll cut-off for leave adjustments is the 22nd of each month."]),
    ("Remote and Hybrid Work Policy", "HR-002", "People & Culture",
     ["hybrid schedule", "home office", "core hours", "equipment allowance",
      "internet stipend", "time zone", "attendance", "workspace safety",
      "cross-border work", "meeting etiquette", "availability", "expense claim"],
     ["Eligible employees may work remotely up to three days per week.",
      "Core collaboration hours are 10:00 to 16:00 in the employee's local time.",
      "A one-time home office allowance of USD 400 is available on approval.",
      "Monthly internet reimbursement is capped at USD 35 per employee.",
      "Employees must maintain a safe, ergonomic workspace at home.",
      "Cross-border remote work requires tax and immigration clearance first.",
      "Team leads publish a weekly anchor-day schedule for in-office collaboration.",
      "Camera use is encouraged but not mandatory for internal meetings.",
      "Remote employees must be reachable on chat during core hours.",
      "Company equipment used at home remains covered by the asset policy.",
      "Attendance is recorded through the HR portal, not physical swipe cards.",
      "Managers review hybrid arrangements at each quarterly check-in."]),
    ("Information Security Policy", "SEC-001", "Group Information Security",
     ["access control", "encryption", "MFA", "password", "classification",
      "incident reporting", "phishing", "vendor access", "logging", "backup",
      "vulnerability", "clear desk", "remote access", "audit", "training", "exceptions"],
     ["All company systems require multi-factor authentication for interactive login.",
      "Data at rest is encrypted using AES-256 or an approved equivalent.",
      "Passwords must be at least 14 characters or use a managed passphrase.",
      "Information is classified Public, Internal, Confidential or Restricted.",
      "Suspected security incidents must be reported within 60 minutes.",
      "Quarterly phishing simulations are mandatory for all staff.",
      "Vendor access is time-bound and reviewed every 90 days.",
      "Security logs are retained for 12 months in the central SIEM.",
      "Backups are encrypted and tested for restoration twice per year.",
      "Critical vulnerabilities are patched within seven calendar days.",
      "Clear-desk rules apply in all offices and home workspaces.",
      "Exceptions require CISO approval and a compensating control."]),
    ("Acceptable Use Policy", "SEC-002", "Group Information Security",
     ["company devices", "software install", "personal use", "social media",
      "email", "cloud storage", "USB", "monitoring", "copyright", "gaming",
      "streaming", "AI tools", "password sharing", "reporting"],
     ["Company laptops may be used for reasonable personal activity outside work hours.",
      "Software must be installed from the approved catalogue only.",
      "Confidential data must never be stored in personal cloud accounts.",
      "Removable media is blocked by default on managed endpoints.",
      "The company monitors endpoint telemetry for security purposes only.",
      "Copyrighted material must not be downloaded or redistributed on company systems.",
      "Generative AI tools may be used only with approved, non-confidential inputs.",
      "Credentials must never be shared, written down, or embedded in code.",
      "Excessive personal streaming that degrades network performance is prohibited.",
      "Violations are handled under the disciplinary procedure.",
      "Employees must report lost or stolen devices within one hour.",
      "Guest Wi-Fi is isolated from the corporate network."]),
    ("Data Privacy and Protection Policy", "PRV-001", "Group Data Protection Office",
     ["personal data", "lawful basis", "consent", "retention", "data subject",
      "cross-border transfer", "breach", "DPIA", "processor", "anonymisation",
      "employee records", "customer records", "Pakistan", "GDPR", "access request", "deletion"],
     ["Personal data is processed only for a documented lawful purpose.",
      "Consent must be freely given, specific and withdrawable.",
      "Retention schedules are defined per data category in the records register.",
      "Data subjects may request access to their data within 30 days.",
      "Cross-border transfers require an approved transfer mechanism.",
      "Personal data breaches are assessed within 24 hours of discovery.",
      "A DPIA is required for high-risk processing activities.",
      "Processors are bound by written data processing agreements.",
      "Employee records are restricted to HR and authorised managers.",
      "Customer records are segregated by tenant identifier.",
      "Anonymised data may be used for analytics without further approval.",
      "Privacy notices are published in English and Urdu."]),
    ("Employee Code of Conduct", "HR-003", "People & Culture",
     ["integrity", "conflict of interest", "gifts", "confidentiality", "dress code",
      "attendance", "substance", "harassment", "social media", "outside employment",
      "political activity", "discipline", "whistleblowing", "investigation"],
     ["Employees act with integrity in all business dealings.",
      "Conflicts of interest must be declared to the compliance team.",
      "Gifts above USD 50 must be logged in the gifts register.",
      "Confidential information must not be discussed in public areas.",
      "Business attire is expected for client-facing meetings.",
      "Reporting harassment is protected from retaliation.",
      "Employees speak for the company only when authorised.",
      "Outside employment requires written HR approval.",
      "Company resources must not support political campaigning.",
      "Disciplinary action ranges from a verbal warning to dismissal.",
      "Whistleblowers may report anonymously through the ethics hotline.",
      "Investigations are documented and reviewed by Legal."]),
    ("Anti-Harassment and Workplace Respect", "HR-004", "People & Culture",
     ["zero tolerance", "reporting channel", "investigation", "support", "bystander",
      "retaliation", "confidentiality", "training", "timeline", "appeal", "records", "metrics"],
     ["Harassment of any kind is not tolerated on company premises or platforms.",
      "Reports may be filed with HR, Legal or the anonymous hotline.",
      "Investigations start within five working days of a report.",
      "Support is offered to all parties throughout the process.",
      "Bystanders are encouraged to intervene safely or report.",
      "Retaliation against a reporter is a separate disciplinary offence.",
      "Case files are held under restricted access.",
      "Annual respect-at-work training is mandatory for all employees.",
      "Both parties may appeal a finding within ten working days.",
      "Aggregate, non-identifying metrics are reported to the board quarterly.",
      "Managers receive additional bystander-intervention training.",
      "Third-party contractors are covered by the same standard."]),
    ("Performance Management and Review", "HR-005", "People & Culture",
     ["objectives", "mid-year", "annual review", "rating scale", "calibration",
      "promotion", "PIP", "feedback", "documentation", "appeal", "bonus", "goals"],
     ["Objectives are set at the start of each performance year.",
      "A formal mid-year check-in is held every July.",
      "Annual reviews close by 31 January of the following year.",
      "The rating scale has five levels from Needs Improvement to Outstanding.",
      "Calibration sessions align ratings across departments.",
      "Promotion decisions consider sustained performance and role readiness.",
      "A performance improvement plan runs for a minimum of 60 days.",
      "Continuous feedback is encouraged through the collaboration tool.",
      "Review notes are stored in the HR system for four years.",
      "Employees may add written comments to their own review.",
      "Bonus payouts are linked to the final calibrated rating.",
      "Goals must be specific, measurable and time-bound."]),
    ("Recruitment and Onboarding", "HR-006", "Talent Acquisition",
     ["requisition", "sourcing", "screening", "interview", "offer", "background check",
      "probation", "orientation", "buddy", "equipment", "access", "30-60-90 plan"],
     ["Hiring starts with an approved requisition and budget check.",
      "Candidate sourcing uses approved channels and agencies.",
      "Structured interviews use a common scorecard across panels.",
      "Offers are issued only after background checks clear.",
      "Probation lasts three months for all new hires.",
      "Day-one orientation covers policy, security and tools.",
      "Every new hire is assigned an onboarding buddy for 30 days.",
      "Laptops are provisioned before the start date.",
      "System access follows least-privilege provisioning.",
      "A 30-60-90 day plan is agreed with the manager in week one.",
      "Recruitment data is retained for 12 months for unsuccessful candidates.",
      "Hiring managers complete bias-awareness training annually."]),
    ("Payroll and Compensation", "HR-007", "Group Finance",
     ["pay cycle", "salary", "overtime", "deductions", "bonus", "currency",
      "payslip", "bank details", "tax", "arrears", "final settlement", "audit"],
     ["Salaries are paid on the 25th of each month.",
      "Overtime requires prior manager approval and is paid at 1.5x the base rate.",
      "Statutory deductions are applied according to local law.",
      "Annual bonuses are paid in March following the performance cycle.",
      "Employees are paid in the currency of their employing entity.",
      "Payslips are available in the HR portal from pay day.",
      "Bank detail changes require two-factor verification.",
      "Payroll exceptions are reviewed by Finance before disbursement.",
      "Arrears are settled in the next available pay cycle.",
      "Final settlement is completed within 30 days of the last working day.",
      "Payroll reconciliations are reviewed by Internal Audit twice per year.",
      "Compensation bands are benchmarked annually."]),
    ("Benefits and Insurance", "HR-008", "People & Culture",
     ["health insurance", "dependants", "life cover", "dental", "vision", "EOBI",
      "provident fund", "gym", "wellness", "claims", "enrolment", "renewal"],
     ["All permanent employees are enrolled in group health insurance.",
      "Dependants may be added during the annual enrolment window.",
      "Life cover equals two times annual base salary.",
      "Dental and vision benefits are included in the core plan.",
      "Statutory social security contributions are made for eligible staff.",
      "Provident fund contributions start after confirmation of employment.",
      "Wellness allowance of USD 200 per year is available on claim.",
      "Claims must be submitted within 90 days of treatment.",
      "Policy renewal is negotiated each December by Group Procurement.",
      "Benefit summaries are published in the employee handbook.",
      "Employees on unpaid leave retain cover for three months.",
      "Benefit queries are handled by the People Services desk."]),
    ("Travel and Expense Policy", "FIN-001", "Group Finance",
     ["booking", "air travel", "hotel", "per diem", "receipts", "mileage",
      "corporate card", "advance", "approval", "currency", "entertainment", "violations"],
     ["Travel must be booked through the approved travel platform.",
      "Economy class applies for flights under six hours.",
      "Hotel caps are USD 180 per night in tier-1 cities.",
      "Per diem is paid at the published country rate.",
      "Receipts are required for every expense above USD 25.",
      "Mileage is reimbursed at the published per-kilometre rate.",
      "Corporate cards must not be used for personal purchases.",
      "Travel advances are settled within 14 days of return.",
      "Expense claims are approved by the budget holder.",
      "Foreign currency expenses convert at the corporate card rate.",
      "Client entertainment requires pre-approval above USD 200.",
      "Policy violations may result in claim rejection."]),
    ("Procurement and Vendor Management", "FIN-002", "Group Procurement",
     ["requisition", "RFQ", "evaluation", "due diligence", "contract", "PO",
      "invoice", "vendor risk", "renewal", "conflict", "SLA", "records"],
     ["Purchases above USD 5,000 require three competitive quotes.",
      "Vendor due diligence covers security, financial and compliance checks.",
      "Contracts are reviewed by Legal before signature.",
      "Purchase orders must exist before an invoice is paid.",
      "Vendor risk is rated at onboarding and reviewed annually.",
      "Renewals are initiated 60 days before contract expiry.",
      "Employees must declare any personal interest in a supplier.",
      "Service levels are tracked in the vendor register.",
      "Invoices are matched to POs and goods receipts.",
      "Preferred suppliers are published in the procurement catalogue.",
      "Procurement records are retained for seven years.",
      "Urgent single-source purchases require CFO approval."]),
    ("Incident Response Plan", "SEC-003", "Group Information Security",
     ["severity", "triage", "containment", "eradication", "recovery", "notification",
      "forensics", "postmortem", "on-call", "runbook", "escalation", "tabletop"],
     ["Incidents are classified SEV-1 to SEV-4 by business impact.",
      "SEV-1 incidents trigger the on-call bridge within 15 minutes.",
      "Containment actions are prioritised over root-cause analysis.",
      "Affected systems are rebuilt from known-good images where possible.",
      "Regulatory notifications are assessed within 24 hours.",
      "Forensic images are preserved under chain of custody.",
      "A blameless postmortem is published within ten working days.",
      "On-call rotations are published a month in advance.",
      "Runbooks are reviewed after every major incident.",
      "Escalation to the executive team uses the crisis contact tree.",
      "Tabletop exercises run twice per year.",
      "Lessons learned are tracked to closure in the risk register."]),
    ("Business Continuity and Disaster Recovery", "SEC-004", "Group Resilience",
     ["BIA", "RTO", "RPO", "backup", "failover", "alternate site", "pandemic",
      "supplier outage", "exercise", "crisis team", "communication", "review"],
     ["Business impact analysis is refreshed annually.",
      "Maximum RTO for customer-facing platforms is four hours.",
      "Maximum RPO for transactional data is 15 minutes.",
      "Backups are stored in a separate geographic region.",
      "Failover tests run quarterly.",
      "Alternate work sites are contracted in Karachi and Dubai.",
      "Pandemic response follows the group health guidance.",
      "Critical suppliers must provide their own continuity evidence.",
      "Continuity exercises include a communications scenario.",
      "The crisis management team meets within one hour of activation.",
      "Employee contact trees are verified every six months.",
      "Plans are reviewed after any material organisational change."]),
    ("Health, Safety and Environment", "OPS-001", "Group Facilities",
     ["fire safety", "evacuation", "first aid", "ergonomics", "incident reporting",
      "PPE", "drills", "air quality", "waste", "energy", "contractors", "audit"],
     ["Evacuation maps are displayed on every floor.",
      "Fire drills are conducted twice per year in each office.",
      "Certified first aiders are available on each shift.",
      "Ergonomic assessments are offered to all desk-based staff.",
      "All safety incidents are logged within 24 hours.",
      "Personal protective equipment is provided where required.",
      "Indoor air quality is monitored quarterly.",
      "Waste segregation is mandatory in all office kitchens.",
      "Energy consumption is reported in the sustainability dashboard.",
      "Contractors must complete site induction before work begins.",
      "Facilities audits are performed annually.",
      "Near-miss reports are actively encouraged."]),
    ("Training and Development", "HR-009", "Learning & Development",
     ["LMS", "mandatory training", "certification", "tuition", "conference",
      "mentoring", "leadership", "compliance", "budget", "evaluation", "records", "calendar"],
     ["Mandatory compliance courses are assigned on joining.",
      "The learning management system records completion evidence.",
      "Professional certifications may be reimbursed up to USD 1,500 per year.",
      "Tuition support requires a two-year service agreement.",
      "Conference attendance needs manager and budget approval.",
      "Mentoring matches are coordinated twice per year.",
      "Leadership pathways are published for each job family.",
      "Training budgets are set annually per department.",
      "Course evaluations feed the curriculum review.",
      "Records are retained for the duration of employment.",
      "The learning calendar is published each January.",
      "External providers are vetted by Procurement."]),
    ("IT Asset and Device Management", "IT-001", "Group IT Operations",
     ["laptop", "inventory", "assignment", "MDM", "patching", "replacement",
      "return", "disposal", "warranty", "peripheral", "loss", "audit"],
     ["All corporate laptops are enrolled in mobile device management.",
      "The asset inventory is reconciled quarterly.",
      "Devices are assigned to a named employee at issue.",
      "Operating system patches are applied within 14 days of release.",
      "Standard laptop refresh cycle is 42 months.",
      "Leavers must return all equipment on their last working day.",
      "End-of-life devices are securely wiped before disposal.",
      "Warranty and repair history is recorded per asset tag.",
      "Peripherals are issued through the IT service desk.",
      "Lost or stolen devices are reported immediately and remotely wiped.",
      "Asset exceptions require Head of IT approval.",
      "Audit samples are drawn from each regional office."]),
    ("Access Control and Identity", "IT-002", "Group IT Operations",
     ["joiner", "mover", "leaver", "SSO", "role", "privileged access",
      "review", "deprovisioning", "shared account", "service account", "logging", "certification"],
     ["Access is provisioned through the joiner-mover-leaver workflow.",
      "Single sign-on is mandatory for all internal applications.",
      "Role-based access groups are maintained by application owners.",
      "Privileged access requires approval and session recording.",
      "Access reviews run every quarter for all systems.",
      "Leaver accounts are disabled within one hour of notification.",
      "Shared accounts are prohibited except for approved service accounts.",
      "Service account credentials rotate every 90 days.",
      "Authentication events are logged centrally.",
      "Access certification is signed off by data owners.",
      "Emergency access is time-bound and audited.",
      "Orphaned accounts are escalated to the CISO."]),
    ("Software Development Lifecycle", "ENG-001", "Group Engineering",
     ["requirements", "design review", "branching", "code review", "testing",
      "CI", "deployment", "rollback", "secrets", "dependencies", "documentation", "postmortem"],
     ["Features start with a reviewed requirement and acceptance criteria.",
      "Design reviews are required for cross-service changes.",
      "Trunk-based development with short-lived branches is the default.",
      "Every pull request requires one approving review.",
      "Automated tests must pass before merge.",
      "Continuous integration builds every commit.",
      "Production deployments use staged rollouts.",
      "Rollback plans are documented for each release.",
      "Secrets are stored in the managed secret store only.",
      "Third-party dependencies are scanned for vulnerabilities.",
      "Architecture decision records accompany significant changes.",
      "Incident postmortems follow the blameless format."]),
    ("Customer Support and Service Levels", "CS-001", "Group Customer Success",
     ["ticket", "priority", "response time", "resolution", "escalation",
      "on-call", "knowledge base", "CSAT", "hours", "holiday cover", "reporting", "continuity"],
     ["Support tickets are categorised P1 to P4 by customer impact.",
      "P1 first response target is 30 minutes, 24x7.",
      "P2 first response target is two business hours.",
      "Resolution targets are published in the customer agreement.",
      "Escalation to engineering uses the on-call rota.",
      "The knowledge base is reviewed monthly.",
      "CSAT surveys are sent after ticket closure.",
      "Regional support hours cover Asia, Europe and North America.",
      "Holiday cover is scheduled four weeks in advance.",
      "Weekly service reports are shared with account managers.",
      "Major incidents trigger a customer communication within one hour.",
      "Support continuity plans are tested annually."]),
    ("Product Release Notes and Roadmap", "PRD-001", "Group Product",
     ["version", "features", "fixes", "deprecations", "migration", "beta",
      "documentation", "feedback", "roadmap", "compatibility", "support window", "archive"],
     ["Release notes are published for every production version.",
      "New features are listed with a short customer-facing description.",
      "Fixes reference the internal ticket identifier.",
      "Deprecations are announced at least one release in advance.",
      "Migration guides accompany breaking changes.",
      "Beta features are opt-in and excluded from SLAs.",
      "Documentation is updated in the same release train.",
      "Feedback is collected through the product portal.",
      "The public roadmap is refreshed each quarter.",
      "Compatibility matrices list supported client versions.",
      "Each release is supported for 18 months.",
      "Archived releases remain available for audit purposes."]),
    ("Regional Offices and Contact Directory", "OPS-002", "Group Facilities",
     ["Karachi", "Lahore", "Islamabad", "Dubai", "London", "Singapore", "Austin",
      "time zone", "address", "reception", "emergency", "holidays"],
     ["The Karachi office is the group headquarters and primary engineering hub.",
      "The Lahore office hosts the customer success and finance teams.",
      "The Islamabad office supports public-sector engagements.",
      "Dubai serves as the regional hub for Middle East operations.",
      "London coordinates European customers and regulatory engagement.",
      "Singapore hosts the Asia-Pacific data platform team.",
      "Austin supports North American customers and overnight on-call coverage.",
      "Each office publishes its local public holiday calendar.",
      "Reception desks operate 08:00 to 18:00 local time.",
      "Emergency contacts are listed on the intranet safety page.",
      "Meeting rooms are booked through the facilities system.",
      "Visitor passes are issued at reception and must be visible."]),
    ("Compliance, Risk and Audit", "GOV-001", "Group Compliance",
     ["register", "risk assessment", "control", "internal audit", "external audit",
      "findings", "remediation", "SOX", "ISO 27001", "policy exception", "training", "reporting"],
     ["The group risk register is reviewed by the board each quarter.",
      "Risks are scored on likelihood and impact.",
      "Key controls are mapped to ISO 27001 and SOC 2 criteria.",
      "Internal Audit publishes a rolling 12-month plan.",
      "External audits are coordinated by Group Compliance.",
      "Audit findings are assigned an owner and due date.",
      "Remediation evidence is attached to the finding record.",
      "Financial controls are tested for SOX scoping where applicable.",
      "Policy exceptions expire automatically after 12 months.",
      "Compliance training completion is tracked per employee.",
      "Regulatory changes are communicated within five working days.",
      "Whistleblower cases are reported to the audit committee."]),
    ("Environmental, Social and Governance", "GOV-002", "Group Sustainability",
     ["emissions", "energy", "recycling", "supply chain", "diversity",
      "community", "reporting", "targets", "travel", "procurement", "volunteering", "assurance"],
     ["Scope 1 and Scope 2 emissions are reported annually.",
      "Office electricity consumption is tracked per square metre.",
      "Recycling rates are published in the ESG dashboard.",
      "Suppliers are asked to confirm their own environmental standards.",
      "Diversity metrics are included in the annual people report.",
      "Community investment is coordinated with local charities.",
      "ESG reporting follows the GRI framework.",
      "A 30% emissions reduction target is set for 2030.",
      "Business travel is the largest remaining emissions source.",
      "Sustainable procurement criteria are part of vendor evaluation.",
      "Employees receive two paid volunteering days per year.",
      "Selected ESG metrics receive limited external assurance."]),
    ("Communications, Brand and Media", "MKT-001", "Group Communications",
     ["brand", "logo", "tone", "press", "social", "approval", "template",
      "translation", "crisis", "photography", "email signature", "archive"],
     ["Brand guidelines define logo usage, colour and typography.",
      "External communications use a clear, plain-language tone.",
      "Press enquiries are routed to Group Communications.",
      "Social media posts require approval from the brand team.",
      "Standard document templates are published on the intranet.",
      "Customer-facing material is translated where required.",
      "Crisis communications follow the holding-statement playbook.",
      "Photography consent is recorded for all staff imagery.",
      "Email signatures use the approved corporate format.",
      "Campaign assets are archived for seven years.",
      "Employees must not create unofficial company accounts.",
      "Brand exceptions require Head of Communications approval."]),
    ("Document Retention and Records Management", "GOV-003", "Group Secretariat",
     ["retention schedule", "legal hold", "archive", "destruction", "naming",
      "versioning", "metadata", "access", "e-discovery", "backup", "audit", "review"],
     ["Every record category has a defined retention period.",
      "Legal holds suspend destruction for the affected records.",
      "Archived records are stored in immutable storage.",
      "Destruction is logged and witnessed by two authorised staff.",
      "File naming follows the group convention with a document code.",
      "Approved versions are marked final and read-only.",
      "Metadata includes owner, classification and review date.",
      "Access to restricted records is logged and reviewed.",
      "E-discovery requests are coordinated by Legal.",
      "Backup copies follow the same retention schedule.",
      "Records audits are performed annually.",
      "Retention schedules are reviewed after regulatory change."]),
]

TEMPLATES = [
    ("email_leave_request.md", "email", "Email Templates - Leave and Absence",
     "Subject: Leave Request ([Full Day / Half Day]) - [Full Name] - [Date]\n\n"
     "Hi [Manager's Name],\n\n"
     "Please accept this as my formal request for [Leave Type] leave on [Date].\n"
     "- Type: [Full-Day / Half-Day]\n- Reason: [Brief reason]\n"
     "- Coverage: [Colleague's Name] will cover urgent matters.\n\n"
     "Best regards,\n[Full Name]\n[Your Job Title]\n[Email]"),
    ("email_meeting_request.md", "email", "Email Templates - Meeting Requests",
     "Subject: Meeting request - [Meeting Topic] - [Date]\n\n"
     "Hi [Recipient Name],\n\n"
     "Could we meet on [Date] at [Time] to discuss [Meeting Topic]?\n"
     "Proposed agenda:\n- [Agenda item 1]\n- [Agenda item 2]\n\n"
     "Please let me know if another time suits you better.\n\n"
     "Best regards,\n[Full Name]\n[Your Job Title]\n[Company]"),
    ("form_expense_claim.md", "form", "Expense Claim Form",
     "EXPENSE CLAIM FORM - [Company]\n\n"
     "1. EMPLOYEE DETAILS\n* Full Name: [Full Name]\n* Employee ID: [Employee ID]\n"
     "* Department: [Department]\n* Manager: [Manager's Name]\n\n"
     "2. EXPENSE DETAILS\n* Date: [Date]\n* Category: [Expense Category]\n"
     "* Amount: [Amount]\n* Currency: [Currency]\n* Receipt attached: [ ] Yes / [ ] No\n\n"
     "3. APPROVAL\n* Submitted by: [Full Name]\n* Approved by: [Manager's Name]\n"
     "* Approval date: [Date]"),
    ("form_it_access_request.md", "form", "IT Access Request Form",
     "IT ACCESS REQUEST FORM - [Company]\n\n"
     "1. REQUESTOR\n* Full Name: [Full Name]\n* Employee ID: [Employee ID]\n"
     "* Department: [Department]\n* Manager: [Manager's Name]\n\n"
     "2. ACCESS REQUIRED\n* System: [System Name]\n* Role: [Access Role]\n"
     "* Justification: [Business Justification]\n* Start date: [Date]\n* End date: [End Date]\n\n"
     "3. APPROVALS\n* Manager: [Manager's Name]\n* Data owner: [Data Owner]\n"
     "* Approved on: [Date]"),
    ("application_internal_transfer.md", "form", "Internal Job Application",
     "INTERNAL TRANSFER APPLICATION - [Company]\n\n"
     "1. APPLICANT\n* Full Name: [Full Name]\n* Employee ID: [Employee ID]\n"
     "* Current Department: [Department]\n* Current Title: [Your Job Title]\n"
     "* Manager: [Manager's Name]\n\n"
     "2. ROLE APPLIED FOR\n* Position: [Position Title]\n* Team: [Team Name]\n"
     "* Location: [Office Location]\n* Reason for applying: [Brief reason]\n\n"
     "3. DECLARATION\n* Signature: [Signature]\n* Date: [Date]"),
    ("letter_employment_verification.md", "form", "Employment Verification Letter",
     "EMPLOYMENT VERIFICATION LETTER - [Company]\n\n"
     "Date: [Date]\n\nTo whom it may concern,\n\n"
     "This is to confirm that [Full Name] (Employee ID: [Employee ID]) has been "
     "employed with [Company] since [Join Date] as [Your Job Title] in the "
     "[Department] department.\n\n"
     "Current employment status: [Employment Status].\n\n"
     "For verification queries please contact [HR Email].\n\n"
     "Sincerely,\n[Manager's Name]\n[Signature]\n[Company]"),
]

FAQ = [
    "Who owns this document? The named policy owner in the document control table.",
    "How often is it reviewed? At least once per year or on material change.",
    "Where do I raise a question? Contact the policy owner or the service desk.",
    "Does this apply to contractors? Yes, where the contract references group policy.",
    "How are exceptions handled? Through the documented exception register.",
    "Which office is responsible? The regional lead listed in the office directory.",
    "What evidence is retained? Records listed in the retention schedule.",
    "When was it last approved? See the version and effective date above.",
    "Who approves changes? The Group Policy Committee or its delegate.",
    "How is compliance measured? Quarterly sampling by Internal Audit.",
]


def knowledge_doc(spec):
    title, code, owner, terms, bullets = spec
    lines = meta(title, code, owner)
    n = 2
    for i, term in enumerate(terms):
        b = [bullets[(i + j) % len(bullets)] for j in range(5)]
        b.append(f"All {term} records are reviewed by {owner} at each quarterly cycle.")
        b.append(f"Regional leads in {REGIONS[i % len(REGIONS)]} confirm local applicability of {term}.")
        b.append(f"Questions about {term} are logged in the policy query register.")
        b.append(f"Any change to {term} requires an impact note and an owner sign-off.")
        b.append(f"Supporting templates for {term} are published on the intranet.")
        lines += section(n, f"Policy area: {term.title()}", b)
        n += 1
    lines += [
        f"## {n}. Frequently asked questions", "",
    ]
    for q in FAQ:
        lines += [f"**Q: {q.split('?')[0]}?**", "", q.split("? ", 1)[-1], ""]
    lines += [
        f"## {n+1}. Related documents", "",
        "- Group Document Control Standard (GOV-003)",
        "- Information Security Policy (SEC-001)",
        "- Employee Code of Conduct (HR-003)",
        "- Records Retention Schedule (GOV-003)",
        "",
        f"## {n+2}. Revision history", "",
        "| Version | Date | Change | Author |",
        "| --- | --- | --- | --- |",
        "| 1.0 | 2021-04-12 | Initial publication | Group Secretariat |",
        "| 2.0 | 2023-02-08 | Regional alignment | Policy Committee |",
        "| 3.0 | 2025-06-19 | Added hybrid-work clauses | Policy Committee |",
        f"| 3.2 | 2026-01-01 | Annual review, {title} | {owner} |",
        "",
        f"## {n+3}. Appendix A - Regional applicability", "",
        "| Office | Applies | Local contact |",
        "| --- | --- | --- |",
    ]
    for i, r in enumerate(REGIONS):
        lines.append(f"| {r} | Yes | {r.lower()}@openvault.example |")
    lines += ["", f"## {n+4}. Appendix B - Definitions", ""]
    for i, term in enumerate(terms[:12]):
        lines.append(f"- **{term}**: {bullets[i % len(bullets)]}")
    lines.append("")
    return "\n".join(lines) + "\n"


def template_doc(filename, kind, title, body):
    lines = [f"# {title}", "", f"**Template type:** {kind}  ",
             f"**Document code:** TPL-{filename.split('.')[0].upper()}  ",
             "**Owner:** People & Culture / Group Secretariat  ",
             "**Instructions:** Replace every [Field name] with the employee's real "
             "information. Unknown fields stay as [Field name] placeholders.", "",
             "---", "", "## Template", "", "```text", body, "```", "",
             "## Field guide", "",
             "| Placeholder | Source |",
             "| --- | --- |"]
    import re
    for field in dict.fromkeys(re.findall(r"\[([^\[\]]{2,60})\]", body)):
        lines.append(f"| [{field}] | Employee profile or request detail |")
    lines += ["", "## Usage notes", ""]
    for i in range(120):
        lines.append(f"- {i+1}. Use this template for {kind} requests raised through "
                     f"the {['HR','IT','Finance','Legal','Facilities','Product'][i % 6]} "
                     f"service desk; keep the structure unchanged and do not add "
                     f"fields that are not listed above.")
    lines += ["", "## Examples (illustrative)", ""]
    for i in range(14):
        lines += [f"### Example {i+1}", "",
                  f"Scenario: a {kind} request from the "
                  f"{REGIONS[i % len(REGIONS)]} office. Fill only fields you know; "
                  "leave the rest as placeholders for the employee to complete.", ""]
    lines += ["## Revision history", "",
              "| Version | Date | Change |", "| --- | --- | --- |",
              "| 1.0 | 2024-03-01 | Initial template |",
              "| 2.0 | 2026-01-01 | Added field guide and examples |", ""]
    return "\n".join(lines) + "\n"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.md"):
        old.unlink()
    for spec in DOCS:
        name = spec[1].lower().replace("-", "_") + "_" + spec[0].lower().replace(" ", "_").replace(",", "")[:40] + ".md"
        text = knowledge_doc(spec)
        (OUT / name).write_text(text)
        print(f"{name}: {len(text.splitlines())} lines")
    for filename, kind, title, body in TEMPLATES:
        text = template_doc(filename, kind, title, body)
        (OUT / filename).write_text(text)
        print(f"{filename}: {len(text.splitlines())} lines")
    print(f"total: {len(list(OUT.glob('*.md')))} files")


if __name__ == "__main__":
    main()
