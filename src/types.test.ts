import { describe, it, expect } from 'vitest';
import { ScanRequestSchema } from './types';

describe('ScanRequestSchema', () => {
  it('accepts a valid minimal request', () => {
    const result = ScanRequestSchema.safeParse({
      service: 'web design',
      location: 'Austin, TX',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.service).toBe('web design');
      expect(result.data.location).toBe('Austin, TX');
    }
  });

  it('applies correct defaults for criteria and maxLeads', () => {
    const result = ScanRequestSchema.safeParse({
      service: 'landscaping',
      location: 'Denver, CO',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.criteria.noWebsite).toBe(true);
      expect(result.data.criteria.outdatedWebsite).toBe(true);
      expect(result.data.criteria.noGoogleBusiness).toBe(true);
      expect(result.data.criteria.badReviewsNoResponse).toBe(false);
      expect(result.data.maxLeads).toBe(50);
    }
  });

  it('accepts explicit criteria and maxLeads values', () => {
    const result = ScanRequestSchema.safeParse({
      service: 'plumbing',
      location: 'Seattle, WA',
      criteria: {
        noWebsite: false,
        outdatedWebsite: false,
        noGoogleBusiness: false,
        badReviewsNoResponse: true,
      },
      maxLeads: 25,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.criteria.noWebsite).toBe(false);
      expect(result.data.maxLeads).toBe(25);
    }
  });

  it('rejects service shorter than 2 characters', () => {
    const result = ScanRequestSchema.safeParse({
      service: 'a',
      location: 'Portland, OR',
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing location', () => {
    const result = ScanRequestSchema.safeParse({
      service: ' roofing',
    });

    expect(result.success).toBe(false);
  });

  it('rejects maxLeads below minimum of 5', () => {
    const result = ScanRequestSchema.safeParse({
      service: 'cleaning',
      location: 'Miami, FL',
      maxLeads: 3,
    });

    expect(result.success).toBe(false);
  });

  it('rejects maxLeads above maximum of 100', () => {
    const result = ScanRequestSchema.safeParse({
      service: 'cleaning',
      location: 'Miami, FL',
      maxLeads: 200,
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-integer maxLeads', () => {
    const result = ScanRequestSchema.safeParse({
      service: 'painting',
      location: 'Chicago, IL',
      maxLeads: 10.5,
    });

    expect(result.success).toBe(false);
  });
});
