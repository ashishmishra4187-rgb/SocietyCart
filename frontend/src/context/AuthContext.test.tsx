import { beforeEach, describe, expect, it } from 'vitest';
import { readStoredSession } from './AuthContext';

describe('readStoredSession', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns null and clears storage for corrupted JSON instead of crashing', () => {
    window.localStorage.setItem('sc_session', '{not json');
    expect(readStoredSession()).toBeNull();
    expect(window.localStorage.getItem('sc_session')).toBeNull();
  });
  it('rejects objects that do not look like a session', () => {
    window.localStorage.setItem('sc_session', JSON.stringify({ admin: true }));
    expect(readStoredSession()).toBeNull();
  });
  it('returns a valid session', () => {
    const s = { residentId: 'r', societyId: 's', flatNumber: 'A-1' };
    window.localStorage.setItem('sc_session', JSON.stringify(s));
    expect(readStoredSession()).toEqual(s);
  });
  it('never stores a credential', () => {
    expect(window.localStorage.getItem('sc_token')).toBeNull();
  });
});
