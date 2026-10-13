import { describe, it, expect } from 'vitest';
import { ScanRequestSchema, normalizeCriteria } from './types';

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
      expect(result.data.criteria).toEqual(['noWebsite', 'outdatedWebsite', 'noGoogleBusiness']);
      expect(result.data.maxLeads).toBe(50);
    }
  });

  it('accepts criteria as an array of keys, as the front end sends them', () => {
    const result = ScanRequestSchema.safeParse({
      service: 'plumbing',
      location: 'Seattle, WA',
      criteria: ['noWebsite', 'badReviewsNoResponse'],
      maxLeads: 25,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.criteria).toEqual(['noWebsite', 'badReviewsNoResponse']);
      expect(result.data.maxLeads).toBe(25);
    }
  });

  it('rejects unknown criteria keys', () => {
    const result = ScanRequestSchema.safeParse({
      service: 'plumbing',
      location: 'Seattle, WA',
      criteria: ['notARealCriterion'],
    });

    expect(result.success).toBe(false);
  });

  it('normalizes criteria into the stored object shape', () => {
    expect(normalizeCriteria(['noWebsite'])).toEqual({
      noWebsite: true,
      outdatedWebsite: false,
      noGoogleBusiness: false,
      badReviewsNoResponse: false,
    });
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
      service: 'roofing',
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
