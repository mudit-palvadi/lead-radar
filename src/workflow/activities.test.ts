import { describe, it, expect } from 'vitest';
import { mergeSignals } from './activities.js';
import type { LeadSignal } from '../types.js';

const signal = (type: string, description: string, severity: string): LeadSignal =>
  ({ type, description, severity } as LeadSignal);

describe('mergeSignals', () => {
  it('keeps one signal per type when search and model agree', () => {
    const merged = mergeSignals(
      [signal('no_website', 'No website found', 'high')],
      [signal('no_website', 'Business has no website', 'high')],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].description).toBe('No website found');
  });

  it('dedupes types that differ only by casing or padding', () => {
    const merged = mergeSignals(
      [signal('no_website', 'No website found', 'high')],
      [signal('No_Website ', 'Business has no website', 'high')],
    );

    expect(merged).toHaveLength(1);
  });

  it('drops claims the app cannot back up with data it holds', () => {
    const merged = mergeSignals([], [
      signal('outdated_website', 'Website needs a redesign', 'medium'),
      signal('no_website', 'No website found', 'high'),
    ]);

    expect(merged.map((s) => s.type)).toEqual(['no_website']);
  });

  it('orders by severity, high first', () => {
    const merged = mergeSignals(
      [
        signal('bad_reviews_no_response', 'Low rating', 'medium'),
        signal('no_website', 'No website found', 'high'),
      ],
      [],
    );

    expect(merged.map((s) => s.type)).toEqual(['no_website', 'bad_reviews_no_response']);
  });

  it('does not throw on a missing or malformed type', () => {
    const merged = mergeSignals(
      [signal(undefined as unknown as string, 'broken', 'high')],
      [signal('no_website', 'No website found', 'high')],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe('no_website');
  });

  it('keeps search signals as ground truth even if unverifiable by the model', () => {
    const merged = mergeSignals(
      [signal('outdated_website', 'Listed as needing updates', 'low')],
      [],
    );

    expect(merged.map((s) => s.type)).toEqual(['outdated_website']);
  });
});