const STUDIO_SLUG_ALIASES: Record<string, string> = {
  'empire-arial-arts': 'empire-aerial-arts',
}

export function resolveStudioSlug(slug: string): string {
  const normalized = decodeURIComponent(slug).trim().toLowerCase()
  return STUDIO_SLUG_ALIASES[normalized] ?? normalized
}
