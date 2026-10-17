export function getSafeInternalPath(value: string | null | undefined, fallback = '/plataforma'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }

  try {
    const parsed = new URL(value, 'https://oposnavarra.invalid');
    if (parsed.origin !== 'https://oposnavarra.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
