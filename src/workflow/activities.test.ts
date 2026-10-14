import { describe, it, expect } from 'vitest';
import { scoreLead, dropPeerTypes } from './activities.js';
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

describe('dropPeerTypes', () => {
  it('drops a design studio when the trade is graphic designer', () => {
    // "design studio" does not contain the word "designer".
    expect(
      dropPeerTypes(['coffee shop', 'design studio', 'gym'], 'graphic designer'),
    ).toEqual(['coffee shop', 'gym']);
  });

  it('drops the exact trade wording', () => {
    expect(
      dropPeerTypes(['web design', 'restaurant', 'salon'], 'web developer'),
    ).toEqual(['restaurant', 'salon']);
  });

  it('drops agencies and consultants for any trade', () => {
    expect(
      dropPeerTypes(['marketing agency', 'restaurant', 'consulting firm'], 'content writer'),
    ).toEqual(['restaurant']);
  });

  it('keeps a yoga studio, because a studio is only a peer of its own trade', () => {
    expect(
      dropPeerTypes(['yoga studio', 'coffee shop'], 'social media marketer'),
    ).toEqual(['yoga studio', 'coffee shop']);
  });

  it('keeps ordinary client businesses for a graphic designer', () => {
    const kept = dropPeerTypes(
      ['coffee shop', 'food truck', 'real estate agent', 'wedding venue', 'boutique'],
      'graphic designer',
    );
    expect(kept).toHaveLength(5);
  });

  it('returns an empty list unchanged', () => {
    expect(dropPeerTypes([], 'web developer')).toEqual([]);
  });
});