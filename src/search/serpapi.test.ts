import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BusinessLead } from '../types';

vi.mock('../config', () => ({
  config: {
    serpapi: { key: '' },
  },
}));

import { searchBusinesses } from './serpapi';

describe('searchBusinesses', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates the requested number of sample leads', async () => {
    const leads = await searchBusinesses('web design', 'Austin, TX', 15);

    expect(leads).toHaveLength(15);
  });

  it('returns leads with the expected shape', async () => {
    const leads = await searchBusinesses('salon', 'Denver, CO', 3);

    for (const lead of leads) {
      expect(lead.id).toBeDefined();
      expect(typeof lead.id).toBe('string');
      expect(lead.name).toContain('Denver, CO');
      expect(lead.address).toContain('Denver, CO');
      expect(typeof lead.hasWebsite).toBe('boolean');
      expect(Array.isArray(lead.signals)).toBe(true);
      expect(lead.signals.length).toBeGreaterThan(0);
      expect(lead.score).toBe(0);
    }
  });

  it('assigns correct signal types based on hasWebsite', async () => {
    const leads = await searchBusinesses('cafe', 'Seattle, WA', 10);

    for (const lead of leads) {
      if (lead.hasWebsite) {
        expect(lead.signals[0].type).toBe('outdated_website');
      } else {
        expect(lead.signals[0].type).toBe('no_website');
      }
    }
  });

  it('handles a single lead request', async () => {
    const leads = await searchBusinesses('dentist', 'Boston, MA', 1);

    expect(leads).toHaveLength(1);
    expect(leads[0].name).toContain('Boston, MA');
  });
});
