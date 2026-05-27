import { describe, expect, it } from 'vitest';
import { hashInviteCode, normalizeInviteCode } from './_db';

describe('invite code helpers', () => {
  it('normalizes invite code with trim and case-insensitive policy', () => {
    expect(normalizeInviteCode('  AbC-123  ')).toBe('abc-123');
  });

  it('hashes normalized value consistently', () => {
    expect(hashInviteCode('  AbC-123  ')).toBe(hashInviteCode('abc-123'));
  });
});
