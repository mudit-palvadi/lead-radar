import { describe, it, expect } from 'vitest';
import { detectSignals, isUsableResult } from './serpapi.js';

const types = (result: Parameters<typeof detectSignals>[0]) =>
  detectSignals(result).map((s) => s.type);

describe('detectSignals', () => {
  it('flags a business with no website', () => {
    expect(types({ title: 'Ace Auto' })).toContain('no_website');
  });

  it('does not flag a business that has a website', () => {
    expect(types({ title: 'Ace Auto', website: 'https://aceauto.com' })).not.toContain('no_website');
  });

  it('flags a poorly rated business with enough reviews to be meaningful', () => {
    expect(types({ title: 'Ace Auto', rating: 2.9, reviews: 40 })).toContain('bad_reviews_no_response');
  });

  it('ignores a low rating that rests on a single review', () => {
    expect(types({ title: 'Ace Auto', rating: 1.5, reviews: 1 })).not.toContain('bad_reviews_no_response');
  });

  it('ignores a low rating with no review count at all', () => {
    expect(types({ title: 'Ace Auto', rating: 2.0 })).not.toContain('bad_reviews_no_response');
  });

  it('ignores a well rated business with many reviews', () => {
    expect(types({ title: 'Ace Auto', rating: 4.5, reviews: 200 })).not.toContain('bad_reviews_no_response');
  });

  it('never reports the same signal twice', () => {
    const signals = detectSignals({ title: 'Ace Auto', rating: 2.1, reviews: 30 });
    expect(new Set(signals.map((s) => s.type)).size).toBe(signals.length);
  });

  it('reports nothing for a healthy business', () => {
    expect(types({ title: 'Ace Auto', website: 'https://aceauto.com', rating: 4.7, reviews: 88 })).toEqual([]);
  });
});

describe('isUsableResult', () => {
  it('keeps a real business', () => {
    expect(isUsableResult({ title: 'Ace Auto Repair' }, 'Austin, TX')).toBe(true);
  });

  it('drops a result that is just the city name back', () => {
    expect(isUsableResult({ title: 'Austin' }, 'Austin, TX')).toBe(false);
  });

  it('drops a result named after the city regardless of case or punctuation', () => {
    expect(isUsableResult({ title: 'austin!' }, 'Austin, TX')).toBe(false);
  });

  it('drops a result with no title at all', () => {
    expect(isUsableResult({}, 'Austin, TX')).toBe(false);
  });

  it('drops a title too short to be a business', () => {
    expect(isUsableResult({ title: 'AC' }, 'Austin, TX')).toBe(false);
  });

  it('keeps a business whose name contains the city as a word', () => {
    expect(isUsableResult({ title: 'Austin Coffee Bar' }, 'Austin, TX')).toBe(true);
  });
});