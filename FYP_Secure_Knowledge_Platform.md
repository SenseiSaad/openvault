# Secure Knowledge Platform — Final Year Project Documentation

*A private AI knowledge assistant for enterprises, with a public open-data portal.*

Last updated: 2026-09-24

---

## 1. What Is This Project? (In One Line)

> A secure online platform where a company can privately upload its documents, and its employees can ask questions and get accurate answers pulled straight from those documents — using a small AI model that runs on our own server, so the company's data never leaves our control. Companies can also choose to publish some documents on a public page for anyone to read and download.

Think of it as **a private, company-only "Google" for their own documents**, plus a small public library of whatever each company chooses to share.

**Important:** This is *not* a "management system" and *not* just a "chatbot." Those are only small supporting parts. The real project is the **secure knowledge platform** — the security, the data privacy, and the AI that reads documents faithfully.

---

## 2. The Problem We Are Solving

Companies have lots of important information locked inside documents — policies, manuals, reports, HR rules, technical docs. Problems today:

- Employees waste time searching through long PDFs to find one answer.
- This information is **private** — it cannot be uploaded to public AI tools like ChatGPT, because the data would leave the company.
- Small/medium companies with lots of private work often have **low public visibility** — people don't know they exist because most of their work is behind closed doors.

**Our answer:**
1. A private AI that reads a company's own documents and answers employees' questions instantly and accurately — without the data ever leaving our secured server.
2. A public portal where companies can showcase the documents they *want* to share, so they gain visibility.

---

## 3. What We Provide (Our Value)

- **Private answers from private data** — employees get instant, accurate answers from their company's documents.
- **Data never leaves** — the AI model runs on our own server (not a public cloud AI), so private data stays private.
- **Strong security & isolation** — each company's data is completely walled off from every other company.
- **Faithful answers** — the AI answers *only* from the uploaded documents, with the source shown, and won't make things up.
- **Public visibility** — companies can publish selected documents to a public page for recognition and sharing.
- **Curated knowledge (OKF)** — beyond raw documents, admins can add curated notes/rules so the AI handles exceptions and special logic correctly.

---

## 4. Public vs Private — The Two Worlds

This is the heart of the platform. There are two clearly separated "worlds":

### Private World (company-only)
- Only logged-in employees of that company can access it.
- Contains sensitive documents (policies, internal manuals, confidential reports).
- Data is encrypted and isolated per company.
- The AI answers questions here, using only that company's documents.

### Public World (open to everyone)
- A public page, viewable **without login**.
- Contains only documents a company has **explicitly chosen to publish**.
- Anyone can read and download these.
- Purpose: give companies public visibility, and give the platform real content to show off.

**Safety rule:** A document is **private by default**. It only becomes public when an admin *deliberately* clicks "Publish" and confirms. This "publish gate" means private data can never accidentally appear in public. (This is also a security feature we highlight.)

---

## 5. Who Uses It? (Stakeholders & Roles)

| Stakeholder | Who they are | What they can do |
|---|---|---|
| **Platform owner (us)** | The service provider | Runs and secures the platform, hosts the public portal |
| **Company Admin** | The employer / company's manager account | Uploads/deletes/edits documents, creates employee accounts, sets permissions, chooses what to publish publicly |
| **Employee** | A staff member of a company | Logs in, asks questions, gets answers from *their company's* documents only; can view/download files they're allowed to |
| **Public user** | Anyone on the internet | Views and downloads only the publicly-published documents; no login needed |

**Key rule:** One employee belongs to **one company only**. They can never log into or see another company's data.

---

## 6. Business Model (How It Creates Value / Money)

- **Subscription (SaaS):** companies pay a monthly fee based on team size, storage, and questions asked. Example tiers:

| Tier | Best for | Employees | Storage | Questions/mo | Price (example) |
|---|---|---|---|---|---|
| **Free** | Trials / tiny teams | up to 3 | 500 MB | 100 | $0 |
| **Starter** | Small teams | up to 15 | 5 GB | 2,000 | ~$29/mo |
| **Business** | Growing firms | up to 50 | 50 GB | 10,000 | ~$99/mo |
| **Enterprise** | Large orgs | unlimited | custom | custom | custom |

  - Higher tiers unlock the stronger features: per-company encryption key, audit logs, OKF curated knowledge, and priority support.
  - *(Numbers are illustrative examples for the proposal — adjust to your real market and running costs.)*
- **Value for the company:** saves employee time, keeps data private, and gives free public visibility.
- **Value for the public:** a growing library of free, downloadable company documents (like a mini-Wikipedia of shared knowledge).
- **Our cost to run:** mainly the server (GPU) that runs the AI, plus storage — kept low by running a small model and starting/stopping the server when not needed.

*(For a Final Year Project, you don't need real revenue — you present this as the intended business model.)*

---

## 7. Competitors — And What They Miss

| Competitor type | Examples | What they give | What they DON'T give (our edge) |
|---|---|---|---|
| Public AI chat tools | ChatGPT, Gemini | Great general answers | Your data goes to their servers — **not private**; no per-company isolation |
| Enterprise document search | SharePoint, Confluence | Store & search docs | No real AI answering from *your* docs; no faithful, cited answers |
| Enterprise AI search | Glean and similar | AI over company docs | Expensive, cloud-based, not self-hosted; no public sharing portal; overkill for smaller firms |
| IT/AI service firms | e.g. Logic Spark | AI/IT services | They sell services, not a self-hostable private-knowledge product with a public visibility portal |

**What makes us different:**
1. **Self-hosted small AI model** → data truly never leaves; affordable to run.
2. **Strict per-company isolation** as a core, provable feature.
3. **A public visibility portal** — competitors keep everything private; we turn "sharing" into a benefit for the company.
4. **Curated knowledge (OKF)** for accurate handling of exceptions.

---

## 8. The AI Part — RAG + OKF (Explained Simply)

### What is RAG?
RAG = **Retrieval-Augmented Generation**. In plain words:
1. **Retrieve:** when an employee asks a question, the system searches the company's documents and pulls out the few most relevant pieces of text.
2. **Augment:** it puts those pieces into the AI's prompt as "here is the source material."
3. **Generate:** the AI writes an answer *based only on that material*, and shows where it came from.

This is how the AI answers from *your* documents instead of from the internet.

### What is OKF? (and why we add it)
OKF = **Open Knowledge Format** — an open, plain-text standard (introduced by Google Cloud) for storing curated knowledge, context, and rules.

- **Problem it solves:** raw documents don't always state the *logic* or *exceptions* clearly. Example: a policy PDF says "leave = 20 days" but the rule "interns get 10, not 20" might be understood, not written down.
- **What OKF does:** an admin writes these rules/exceptions/context as simple text files. The AI reads them *alongside* the retrieved document chunks, so it answers the tricky "exception" cases correctly.
- **Honest note:** OKF is a *knowledge format*, not a thinking engine. It doesn't reason by itself — it just feeds the AI better, pre-organized context so the AI reasons correctly.

### Faithfulness ("no meaning change")
To make sure the AI never twists the meaning of the data:
- **Temperature = 0** (no creative guessing).
- **Strict instructions:** "Answer only from the provided text. If it's not there, say 'not found in the documents.'"
- **Citations:** every answer shows the exact source, so it's checkable.
- **Evaluation:** we test with a set of known question–answer pairs and measure accuracy.

**Trade-off:** a small model is fast and private, but slightly less "smart" than a giant cloud model. We accept this because our job is *extraction and faithful answering*, not creative writing — and a small model does that well.

---

## 9. Login & Authentication (Who Gets In)

- Each user logs in with email + password (managed securely by **Amazon Cognito**).
- Every account is tied to **one company** and **one role** (Admin or Employee).
- When you log in, the system knows *which company you belong to*, and every action is automatically limited to that company's data.
- **Security extra:** a "new login alert" email is sent when someone logs in (like Google/banks do) — this fits our security theme.

**Why Cognito?** It handles passwords, sign-up, email verification, roles, and multi-company user groups for us — securely and free at small scale — instead of us building risky login code ourselves.

---

## 10. Data Privacy & Security (The Core of the Project)

This is the most important part — where the marks are.

1. **Multi-tenant isolation (the big one).** Every company is a "tenant." Every document, every piece of data, and every AI search is stamped and filtered by company ID. The search *physically cannot* return another company's data. New company = brand-new, isolated space.
2. **Encryption.**
   - *In transit:* all traffic uses HTTPS (encrypted on the wire).
   - *At rest:* files in storage are encrypted, ideally with a **separate key per company** (so even the platform can't read Company A's files without its key).
3. **Access control.** Employees only see what their role allows. Admins manage only their own company.
4. **Audit logging.** Every question asked and every document accessed is logged — who, what, when. Good for compliance.
5. **Leak / prompt-injection defense.** A malicious document can't trick the AI into leaking other data; the AI is locked to the current company's context. Sensitive info (like ID numbers) can be auto-detected and hidden.
6. **Least privilege.** The servers use secure AWS roles (not shared passwords), so a breach in one place doesn't unlock everything.

**Why this matters:** enterprises will only trust a platform with their private data if isolation and privacy are *provable*. Demonstrating "Company A can never see Company B's data" is your headline achievement.

---

## 11. Upload & Download (How Files Move)

### Upload (Admin)
1. Admin selects a file (PDF, Word, PPT, or a scanned image).
2. The file goes into **secure storage (Amazon S3)**, filed under that company's private space.
3. The system **reads the text** from it (using OCR for scanned images/PDFs), splits it into small chunks, and turns each chunk into a searchable form (an "embedding") stored in the **vector database**.
4. Now the AI can find and answer from this document.

### Download / View
- Admins and permitted employees can view, download, edit, or delete their company's files anytime.
- Public users can download only the publicly-published files.
- Downloads use **secure temporary links** (presigned URLs) so files aren't openly exposed on the internet.

**Trade-off:** OCR (reading scanned images) adds processing time and isn't 100% perfect on messy scans — but it hugely widens what documents we can support, so it's worth it.

---

## 12. How It All Works — Step by Step (The Full Journey)

1. **A company signs up.** The platform creates a new, isolated space for them. The first account is the **Admin**.
2. **Admin adds employees.** Each gets a login tied to this company only.
3. **Admin uploads documents.** They go to secure storage, get read, chunked, and indexed (see section 11).
4. **Admin (optionally) adds OKF notes.** Curated rules/exceptions for tricky cases.
5. **Admin (optionally) publishes some documents** to the public portal.
6. **An employee logs in** and asks a question in plain language.
7. **The system retrieves** the most relevant chunks from *only that company's* documents (+ OKF notes).
8. **The AI generates a faithful, cited answer**, streamed word-by-word so it feels instant.
9. **Everything is logged** for audit.
10. **Public users** browse the public portal separately, reading/downloading shared documents — no login.

---

## 13. Tech Stack (What We Use & Why)

| Layer | Technology | Why this one | Alternatives / trade-off |
|---|---|---|---|
| **Frontend** | React (hosted on **Netlify**) | Popular, fast to build, easy hosting | Next.js (more features, more setup); AWS Amplify |
| **Backend / API** | Python + **FastAPI** | Great for AI work, simple, fast | Django (heavier); Node.js |
| **AI model** | Small open model (**Qwen 3B**, ~2 GB) via **Ollama** | Small, private, self-hosted, good at extraction | Bigger = smarter but slower/pricier; cloud AI = not private |
| **RAG search** | Vector DB (**pgvector on Postgres**, or Chroma/Qdrant) | Finds relevant text by meaning | FAISS (local, less managed) |
| **Curated knowledge** | **OKF** plain-text files | Standard, simple, handles exceptions | Custom JSON (non-standard) |
| **File storage** | **Amazon S3** | Cheap, reliable, encrypted, scalable | Storing on the server (risky) |
| **Login / auth** | **Amazon Cognito** | Secure logins, roles, multi-company groups | Building your own (risky); Auth0 (paid) |
| **Email** | **Amazon SES** | Cheap, reliable notifications | SendGrid; Gmail SMTP |
| **AI server** | **AWS EC2 g4dn.xlarge (GPU, T4)** | Fast (<5s) answers; affordable with credits | CPU-only (cheaper but slower) |
| **Containers** | **Docker** + **AWS ECR** | Consistent, portable, easy deploy | Installing directly on server (messy) |
| **CI/CD** | **GitHub Actions** | Auto build/test/deploy on every push | Manual deploy (error-prone) |
| **Secrets/keys** | **AWS Secrets Manager + KMS** | Safe storage of keys/passwords | Hard-coding (never) |

---

## 14. Architecture (How the Pieces Connect)

```
Public user ─────────────► Public Portal (read-only, no login)

Employee / Admin (browser)
      │  HTTPS
      ▼
React app (Netlify)
      │
      ▼
Backend API (FastAPI)  ◄──── Amazon Cognito (login + roles)
   │  does RAG + security checks
   ├──────────────► Vector DB (pgvector)  — finds relevant text
   ├──────────────► Amazon S3 — encrypted files, per company
   └──────────────► AI model (Qwen on GPU EC2, via Ollama) — writes the answer
```

The **backend is the brain** (does the RAG + enforces security). The **AI model is just a "generate text" helper** it calls.

---

## 15. Deployment on AWS (How It Goes Live)

**Approach:** Package everything in Docker, store the images in AWS ECR, run them on EC2. Frontend on Netlify.

1. **Build** Docker images for the backend and the AI (Ollama + Qwen).
2. **Push** images to **Amazon ECR** (a private image store).
3. **Run** them on the **GPU EC2 instance** (g4dn.xlarge).
   - ⚠️ The GPU box needs NVIDIA drivers + the NVIDIA Container Toolkit so Docker can use the GPU. Easiest: launch from the **AWS Deep Learning AMI** (comes preinstalled).
4. **Frontend** deploys to **Netlify** (auto-builds from GitHub).
   - ⚠️ Netlify is HTTPS, so the backend must also be HTTPS — put a small reverse proxy (Caddy/nginx with a free certificate) or an AWS load balancer in front, on a real domain. Otherwise the browser blocks the connection.
5. **Files** live in **S3**, **logins** in **Cognito**, **emails** via **SES**, **keys** in Secrets Manager/KMS.

**Simplest setup (recommended for FYP):** run the backend + AI + vector DB together on the **one GPU instance** using Docker Compose. One thing to start/stop.

**Cost control:** EC2 only bills while *running*. Start it before you demo, stop it after. Stopped = you only pay a few dollars/month for storage. With your AWS credits, this is easily affordable for 3–4 months.

---

## 16. Automations

1. **GitHub Actions (CI/CD):** every time you push code, it automatically builds, tests, and deploys. Add a security scan step to reinforce the security theme.
2. **Email notifications (Amazon SES):**
   - When new data/policy is uploaded → employees of that company get an email.
   - When someone logs in → a "new login security alert" email.

Both show real-world engineering maturity and fit the security story.

---

## 17. Key Design Decisions — Pros & Cons

| Decision | Pros | Cons | Verdict |
|---|---|---|---|
| Small self-hosted model (Qwen 3B) | Private, cheap, fast enough | Less "smart" than big cloud models | ✅ Right for private + extraction |
| GPU server (vs CPU) | <5s answers, smooth demo | Slightly higher cost | ✅ Worth it with credits + start/stop |
| Multi-tenant isolation | Core selling point, secure | Needs careful engineering | ✅ Non-negotiable |
| Public portal | Visibility, real content | Must guard against leaks | ✅ Keep, with a strict publish gate |
| OKF curated knowledge | Handles exceptions, accurate | Admin must maintain the notes | ✅ Optional but strong |
| All-in-one server (vs split) | Simple, one start/stop | Backend down when server is off | ✅ Fine for FYP; split later |
| RAG + citations | Faithful, checkable answers | Quality depends on retrieval | ✅ Core approach |

---

## 18. Recommended Approach (What You Should Do)

1. **Build the core first:** upload → store in S3 → read/chunk/index → ask question → RAG answer with citations. Make this rock-solid.
2. **Add security properly:** Cognito login, per-company isolation, HTTPS, encryption, audit log. This is your headline.
3. **Add OKF** curated notes for the exception-handling story.
4. **Add the public portal** (read-only, with the publish gate).
5. **Add OCR** so scanned documents work.
6. **Add automations:** GitHub Actions + email.
7. **Deploy on AWS** with Docker, streaming answers, start/stop.
8. **Measure & document:** accuracy, response time, and "isolation never leaked" tests — with real numbers.

Do the "core" and "security" parts first; treat the rest as layers you add if time allows.

---

## 19. Suggested Timeline (3–4 Months)

| Month | Focus |
|---|---|
| **Month 1** | Core RAG pipeline (upload, store, index, ask, answer with citations) working locally |
| **Month 2** | Security: Cognito login, multi-tenant isolation, encryption, roles; add OKF |
| **Month 3** | Public portal, OCR, email + GitHub Actions automations |
| **Month 4** | AWS deployment, streaming UI, testing, accuracy/isolation metrics, docs & demo prep |

---

## 20. Project Cost Estimate (3–4 Months)

Almost all the software is **free and open-source** (Qwen model, Ollama, FastAPI, React, pgvector, Docker), so the real cost is the **AWS hosting**. The estimate below is deliberately on the **safe (higher) side** with a buffer, so you are never caught short.

**Monthly running cost (safe estimate, GPU setup):**

| Item | What it is | Safe monthly cost |
|---|---|---|
| GPU server — EC2 g4dn.xlarge | Runs the AI model (~150 hrs/month of use) | ~$80 |
| Disk (EBS, ~100 GB) | OS, model, database, Docker images | ~$8 |
| File storage (Amazon S3) | Uploaded documents | ~$3 |
| Database (RDS Postgres, small) | Vector search + app data (or $0 if run on the EC2) | ~$20 |
| Data transfer out | Sending answers/files to users | ~$8 |
| Elastic IP (while server stopped) | Keeps a fixed address | ~$4 |
| Cognito + SES + Route 53 | Login, emails, domain routing | ~$2 |
| **Subtotal** | | **~$125 / month** |
| Safety buffer (~25%) | Extra testing, surprises | ~$30 |
| **Safe monthly total** | | **~$155 / month** |

**Full project (3–4 months):**

| | Amount |
|---|---|
| 4 months × ~$155 | ~$620 |
| Domain name (1 year) | ~$15 |
| **Safe project total** | **~$635 (round up to ~$700 to be safe)** |

**The good news:**
- You have **AWS credits**, which should cover essentially all of the AWS items above → your real out-of-pocket cost is close to **$0** (maybe just the ~$15 domain).
- **Free = $0:** the AI model (Qwen), Ollama, FastAPI, React, pgvector, Docker, GitHub Actions (free tier), Netlify (free tier), Let's Encrypt TLS, Cognito free tier, SES at low volume.

**Ways to spend even less (if needed):**
- Use a **CPU** instance instead of GPU → roughly half the server cost (but slower answers).
- Run the database **on the same EC2** instead of managed RDS → saves ~$20/month.
- **Stop the server** whenever you're not testing → you only pay while it runs.

*(Prices are approximate, region-dependent, and change over time — confirm in the AWS Pricing Calculator. The point is a safe upper bound, not an exact bill.)*

---

## 21. Risks & Mitigations

| Risk | Why it happens | How we handle it |
|---|---|---|
| Slow first answer | Model loads into memory on the first request after server start | Send a warm-up query before the demo; show a "responding…" indicator + stream tokens |
| Answers feel slow (>5s) | Too much context, or many users at once | Keep to top ~3 chunks, use the GPU, stream word-by-word so it *feels* instant |
| OCR mistakes on messy scans | Low-quality images or odd layouts | Show a confidence flag; let the admin re-upload a cleaner file or fix the text |
| Small model gets a tricky case wrong | Less reasoning power than big models | OKF curated rules for known exceptions; say "not found" instead of guessing; citations to verify |
| Made-up answer (hallucination) | Model tries to fill gaps | Temperature 0, strict "answer only from the context" prompt, citations, evaluation set |
| One company's data leaking to another | Bug in the isolation logic | Company ID enforced at every layer; automated isolation tests; audit logs |
| Private file accidentally made public | Human error | "Private by default" + explicit publish gate with a confirmation step |
| Malicious document (prompt injection) | Hidden instructions inside a file | Treat document text as data, not commands; AI locked to its own company's context |
| Server cost overrun | GPU left running | Manual (or scheduled) start/stop; billed only while running; a spend alert |
| Losing data | Disk failure or accidental delete | S3 stores files durably; database backups; soft-delete before permanent delete |

*(A panel almost always asks "what are the risks?" — having this table ready is a strong move.)*

---

## 22. How to Defend It to the Panel

- **"Is it just a management system?"** → No. Management is a small supporting part. The contribution is *secure, isolated, faithful AI answering* from private data.
- **"Is it just a chatbot?"** → No. It answers *only* from the company's own documents, with citations and provable isolation — a private knowledge system with a security core.
- **"What's novel?"** → Per-company isolation as a provable feature, a self-hosted private model, OKF curated-knowledge handling, and a public visibility portal — combined in one platform, backed by accuracy and isolation *metrics*.
- **"How do you know it's accurate?"** → Show the evaluation numbers and the citations.

---

## 23. Glossary (Simple Definitions)

- **RAG:** the AI reads *your* documents to answer, instead of guessing from the internet.
- **OKF (Open Knowledge Format):** simple text files of curated rules/context that help the AI handle tricky cases.
- **Multi-tenant:** many companies share one platform, but each is completely walled off from the others.
- **Embedding / vector database:** a way to search text by *meaning*, not just keywords.
- **Tenant isolation:** the guarantee that one company can never see another's data.
- **S3:** Amazon's secure file storage.
- **Cognito:** Amazon's secure login service.
- **Ollama:** a tool that runs the AI model on our own server.
- **Docker / ECR:** packaging the app so it runs the same everywhere / Amazon's store for those packages.
- **CI/CD:** automatically testing and deploying code when you push changes.
- **OCR:** technology that reads text out of scanned images/PDFs.
- **Presigned URL:** a secure, temporary download link.

---

*End of document.*
