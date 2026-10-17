export function isAdminRole(role?: string | null): boolean {
  return role === 'admin';
}

export function isAdminProfile(profile?: { rol?: string | null } | null): boolean {
  return isAdminRole(profile?.rol ?? null);
}
