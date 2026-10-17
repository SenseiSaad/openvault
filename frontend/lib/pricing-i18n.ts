// Strings for the public /pricing page in English and Roman Urdu. Kept in
// its own file so the workspace i18n dictionary (lib/i18n.ts) stays untouched.

export type PricingLang = 'en' | 'ur'

export interface PricingContent {
  eyebrow: string
  titleA: string
  titleB: string
  lede: string
  langToggle: string
  perMonth: string
  fromLabel: string
  getStarted: string
  contactUs: string
  members: (n: number | null) => string
  docs: (n: number | null) => string
  asks: (n: number | null) => string
  versioning: string
  departments: string
  byoKey: string
  bestValue: string
  liveNote: string
  coverTitle: string
  cover: { title: string; body: string }[]
  mathTitle: string
  mathBody: string
  faqTitle: string
  faq: { q: string; a: string }[]
  ctaTitle: string
  ctaBody: string
  ctaButton: string
}

export const PRICING_CONTENT: Record<PricingLang, PricingContent> = {
  en: {
    eyebrow: 'Pricing',
    titleA: 'Priced at cost.',
    titleB: 'No markup. No surprises.',
    lede:
      'One monthly price covers the whole stack — hosting, managed database, document storage, AI usage, and backups. Each tier is set at what it actually costs to run it reliably, with headroom for redundancy.',
    langToggle: 'Roman Urdu',
    perMonth: '/month',
    fromLabel: 'from',
    getStarted: 'Get Started',
    contactUs: 'Contact us',
    members: (n) => (n == null ? 'Unlimited members' : `${n} members`),
    docs: (n) => (n == null ? 'Unlimited documents' : `${n} documents`),
    asks: (n) => (n == null ? 'Unlimited AI questions' : `${n.toLocaleString('en-PK')} AI questions / month`),
    versioning: 'File versioning',
    departments: 'Departments',
    byoKey: 'Bring your own AI key',
    bestValue: 'Best value',
    liveNote: 'Prices shown are live from the platform — what you see is what the server enforces.',
    coverTitle: 'What your subscription covers',
    cover: [
      {
        title: 'Compute & managed database',
        body: 'Application servers and a managed PostgreSQL 16 cluster in the AWS Mumbai region, with nightly automated backups.',
      },
      {
        title: 'Document storage',
        body: 'Your files live in object storage with per-tenant isolation, integrity checks, and tenant-scoped retrieval.',
      },
      {
        title: 'AI usage',
        body: 'Retrieval plus answer tokens for every question your team asks. Business and Enterprise can bring their own key instead.',
      },
      {
        title: 'Security & email',
        body: 'HTTPS everywhere, HttpOnly session cookies, rate limiting, audit logging, and transactional email for verification and resets.',
      },
    ],
    mathTitle: 'The honest math',
    mathBody:
      'We priced each tier at its real infrastructure cost — compute, database, storage, AI tokens, backups — at the tenant density each tier is designed for, plus headroom so a busy month never degrades your workspace. No venture-subsidized launch pricing that doubles later, no per-question overage bills. When our costs move, we publish new numbers instead of quietly changing yours.',
    faqTitle: 'Questions, answered',
    faq: [
      {
        q: 'What happens if I hit a limit?',
        a: 'Nothing breaks and nothing is deleted. The action simply returns a clear upgrade message, and everything resumes the moment you move to a bigger tier.',
      },
      {
        q: 'How do we pay?',
        a: 'Monthly invoice in PKR — bank transfer (IBFT), JazzCash, or Easypaisa. No card required, and you can cancel at the end of any month.',
      },
      {
        q: 'Where does our data live?',
        a: 'In the AWS Mumbai region (ap-south-1), encrypted at rest and in transit. Documents are never used to train AI models. Stricter residency needs can use the on-server or Bedrock-India AI options.',
      },
      {
        q: 'Can we bring our own AI key?',
        a: 'Yes — on Business and Enterprise. Your questions then run through your own provider account, and the AI portion of your usage is billed by that provider, not us.',
      },
    ],
    ctaTitle: 'Start with the free tier.',
    ctaBody: 'Register your company, upload a few policies, and ask your first question in under ten minutes.',
    ctaButton: 'Create your company',
  },
  ur: {
    eyebrow: 'Pricing',
    titleA: 'Cost ke hisaab se pricing.',
    titleB: 'No markup. No surprise.',
    lede:
      'Ek monthly price mein poora stack shamil hai — hosting, managed database, document storage, AI usage, aur backups. Har tier ki price uski asal running cost ke hisaab se set ki gayi hai, redundancy ke liye extra headroom ke sath.',
    langToggle: 'English',
    perMonth: '/month',
    fromLabel: 'kam az kam',
    getStarted: 'Shuru karein',
    contactUs: 'Rabta karein',
    members: (n) => (n == null ? 'Unlimited members' : `${n} members`),
    docs: (n) => (n == null ? 'Unlimited documents' : `${n} documents`),
    asks: (n) => (n == null ? 'Unlimited AI sawal' : `${n.toLocaleString('en-PK')} AI sawal / month`),
    versioning: 'File versioning',
    departments: 'Departments',
    byoKey: 'Apni AI key use karein',
    bestValue: 'Best value',
    liveNote: 'Ye prices live platform se aa rahi hain — jo dikhta hai, server wahi enforce karta hai.',
    coverTitle: 'Aapki subscription mein kya shamil hai',
    cover: [
      {
        title: 'Compute aur managed database',
        body: 'AWS Mumbai region mein application servers aur managed PostgreSQL 16, rozana automated backups ke sath.',
      },
      {
        title: 'Document storage',
        body: 'Aapki files object storage mein rehti hain — har company ka data alag, integrity checks ke sath.',
      },
      {
        title: 'AI usage',
        body: 'Har sawal ki retrieval aur answer tokens. Business aur Enterprise apni khud ki key bhi use kar sakte hain.',
      },
      {
        title: 'Security aur email',
        body: 'Har jagah HTTPS, HttpOnly session cookies, rate limiting, audit logging, aur verification/reset emails.',
      },
    ],
    mathTitle: 'Seedha hisaab',
    mathBody:
      'Hum ne har tier ki price uski asal infrastructure cost par rakhi hai — compute, database, storage, AI tokens, backups — us tenant density ke hisaab se jis ke liye wo tier banaya gaya hai, plus headroom taake busy month mein bhi performance na gire. Na venture-subsidized launch pricing jo baad mein double ho jaye, na per-question overage bill. Jab hamari cost badalti hai, hum naye numbers publish karte hain — chupke se aapke numbers nahi badalte.',
    faqTitle: 'Aksar pooche gaye sawal',
    faq: [
      {
        q: 'Agar limit poori ho jaye to kya hoga?',
        a: 'Kuch toot-ta nahi aur kuch delete nahi hota. Bas clear upgrade message milta hai, aur baray tier par shift hotay hi sab dobara chal parhta hai.',
      },
      {
        q: 'Payment kaise hoti hai?',
        a: 'PKR mein monthly invoice — bank transfer (IBFT), JazzCash, ya Easypaisa. Card ki zaroorat nahi, aur kisi bhi month ke aakhir mein cancel kar sakte hain.',
      },
      {
        q: 'Hamara data kahan rehta hai?',
        a: 'AWS Mumbai region (ap-south-1) mein, rest aur transit dono mein encrypted. Documents kabhi AI models ki training ke liye use nahi hote. Zyada sakht residency ke liye on-server ya Bedrock-India options hain.',
      },
      {
        q: 'Kya hum apni AI key use kar sakte hain?',
        a: 'Ji haan — Business aur Enterprise par. Phir aapke sawal aapke apne provider account se chalte hain, aur AI usage ka bill wo provider karta hai, hum nahi.',
      },
    ],
    ctaTitle: 'Free tier se shuru karein.',
    ctaBody: 'Apni company register karein, kuch policies upload karein, aur das minute mein apna pehla sawal poochein.',
    ctaButton: 'Apni company banayein',
  },
}