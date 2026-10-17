// Minimal UI string dictionary: English (default) and Roman Urdu (Urdu written
// in Latin script). Users switch via the language toggle in the workspace;
// the choice persists on their profile and also sets the AI reply language.
import type { UiLanguage } from './api'

const STRINGS = {
  // workspace sidebar / nav
  overview: { en: 'Overview', ur: 'Khulasa' },
  askAi: { en: 'Ask AI', ur: 'AI se poochein' },
  documents: { en: 'Documents', ur: 'Documents' },
  shared: { en: 'Shared with me', ur: 'Mere sath share' },
  attendance: { en: 'Attendance', ur: 'Haziri' },
  members: { en: 'Members', ur: 'Members' },
  audit: { en: 'Audit log', ur: 'Audit record' },
  usagePlan: { en: 'Usage & plan', ur: 'Istemaal aur plan' },
  settings: { en: 'AI settings', ur: 'AI settings' },
  backToLanding: { en: '← Back to landing', ur: '← Wapis home' },
  logout: { en: 'Log out', ur: 'Log out' },
  // chat
  askPlaceholder: { en: 'Ask anything about your documents…', ur: 'Documents ke bare mein kuch bhi poochein…' },
  stop: { en: 'Stop', ur: 'Rukein' },
  newChat: { en: 'New chat', ur: 'Nayi chat' },
  history: { en: 'History', ur: 'Purani batein' },
  sources: { en: 'Sources', ur: 'Zariye' },
  helpful: { en: 'Helpful', ur: 'Acha laga' },
  notHelpful: { en: 'Not helpful', ur: 'Acha nahi laga' },
  // documents
  uploadDocument: { en: 'Upload document', ur: 'Document upload karein' },
  download: { en: 'Download', ur: 'Download' },
  preview: { en: 'Preview', ur: 'Dekhein' },
  share: { en: 'Share', ur: 'Share' },
  delete: { en: 'Delete', ur: 'Delete' },
  searchDocs: { en: 'Search your permitted documents…', ur: 'Apne documents talash karein…' },
  indexing: { en: 'Indexing…', ur: 'Index ho raha hai…' },
  indexFailed: { en: 'Index failed — retry', ur: 'Index fail — dobara karein' },
  allCategories: { en: 'All categories', ur: 'Tamam categories' },
  // common
  loading: { en: 'Loading…', ur: 'Load ho raha hai…' },
  save: { en: 'Save', ur: 'Mehfooz karein' },
  cancel: { en: 'Cancel', ur: ' Mansookh', },
  language: { en: 'Language', ur: 'Zuban' },
  // attendance
  markedPresent: { en: 'You are marked present for today.', ur: 'Aaj ki haziri ho gayi.' },
  markPresent: { en: "I'm at the office — mark me present", ur: 'Main daftar mein hoon — haziri lagayein' },
  // overview
  welcomeBack: { en: 'Welcome back,', ur: 'Khush amdeed,' },
  announcements: { en: 'Announcements', ur: 'Elaan' },
  noAnnouncements: { en: 'No announcements yet.', ur: 'Koi elaan nahi.' },
} as const

export type StringKey = keyof typeof STRINGS

// Translate a key. Falls back to English, then to the key itself.
export function t(key: StringKey, lang: UiLanguage = 'en'): string {
  const entry = STRINGS[key] as { en: string; ur: string } | undefined
  if (!entry) return key
  return entry[lang] ?? entry.en
}

export function makeT(lang: UiLanguage) {
  return (key: StringKey) => t(key, lang)
}
