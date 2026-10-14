import { describe, it, expect } from 'vitest';
import { scoreLead } from './activities.js';
import type { BusinessLead } from '../types.js';

const lead = (signals: string[]): BusinessLead =>
  ({
    id: '1',
    name: 'Ace Auto',
    address: '1 Main St',
    signals: signals.map((type) => ({ type, description: type, severity: 'high' })),
    score: 0,
  }) as unknown as BusinessLead;

describe('scoreLead', () => {
  it('scores a business with no website higher than one with a website', () => {
    const noSite = scoreLead(lead(['no_website']), 70);
    const hasSite = scoreLead(lead([]), 70);

    expect(noSite).toBeGreaterThan(hasSite);
  });

  it('rises above 80 when there is no website to start with', () => {
    expect(scoreLead(lead(['no_website']), 70)).toBeGreaterThan(80);
  });

  it('keeps a business with a website out of the top band', () => {
    expect(scoreLead(lead([]), 70)).toBeLessThan(70);
  });

  it('does not produce the same score for every lead', () => {
    const scores = new Set([
      scoreLead(lead([]), 70),
      scoreLead(lead(['no_website']), 70),
      scoreLead(lead(['no_website', 'bad_reviews_no_response']), 70),
    ]);

    expect(scores.size).toBe(3);
  });

  it('lets the model move the score within a limited range', () => {
    const low = scoreLead(lead(['no_website']), 0);
    const high = scoreLead(lead(['no_website']), 100);

    // A fully trusted model could shift a 100-based lead by at most 25.
    expect(high - low).toBe(25);
  });

  it('never returns a score outside 0-100', () => {
    expect(scoreLead(lead(['no_website', 'bad_reviews_no_response']), 1000)).toBeLessThanOrEqual(100);
    expect(scoreLead(lead([]), -50)).toBeGreaterThanOrEqual(0);
  });

  it('handles a lead with no signals at all', () => {
    expect(Number.isFinite(scoreLead(lead([]), 50))).toBe(true);
  });
});