import { describe, expect, it } from 'vitest';

import { decodeJwtRole } from './validate-service-role';

// JWT payloads only — not real secrets.
const SERVICE_ROLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature';
const ANON_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature';

describe('decodeJwtRole', () => {
  it('reads service_role from a service-role JWT', () => {
    expect(decodeJwtRole(SERVICE_ROLE_JWT)).toBe('service_role');
  });

  it('reads anon from an anon JWT', () => {
    expect(decodeJwtRole(ANON_JWT)).toBe('anon');
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwtRole('not-a-jwt')).toBeNull();
  });
});
