// Normalize studio-entered social/website values into openable URLs.
// Owners often save bare handles ("@empireaerialarts") or domains ("empireaerial.nz").
export type SocialKind = 'instagram' | 'facebook' | 'website'

const HANDLE_RE = /^[A-Za-z0-9_.]+$/
const DOMAIN_RE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/\S*)?$/

export function socialUrl(kind: SocialKind, value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw

  if (kind === 'instagram' || kind === 'facebook') {
    const handle = raw.replace(/^@/, '')
    if (HANDLE_RE.test(handle)) {
      return kind === 'instagram'
        ? `https://instagram.com/${handle}`
        : `https://facebook.com/${handle}`
    }
  }

  if (DOMAIN_RE.test(raw)) return `https://${raw}`
  return null
}
