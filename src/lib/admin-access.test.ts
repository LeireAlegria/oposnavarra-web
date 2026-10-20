import { describe, expect, it } from 'vitest';

import { isAdminProfile, isAdminRole } from './admin-access';

describe('admin access', () => {
  it('accepts the admin role only', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('usuario')).toBe(false);
    expect(isAdminRole()).toBe(false);
  });

  it('rejects missing or non-admin profiles', () => {
    expect(isAdminProfile(null)).toBe(false);
    expect(isAdminProfile({ rol: 'usuario' })).toBe(false);
    expect(isAdminProfile({ rol: 'admin' })).toBe(true);
  });
});
