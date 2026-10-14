import { describe, it, expect } from 'vitest';
import { ensureSignOff } from './index.js';

describe('ensureSignOff', () => {
  it('appends a signature when the model forgets one', () => {
    const result = ensureSignOff('Hi there, I noticed you have no site.', 'Alex');
    expect(result).toContain('Alex');
    expect(result.endsWith('Alex')).toBe(true);
  });

  it('leaves an existing signature alone', () => {
    const body = 'Hi there.\n\nBest,\nAlex';
    expect(ensureSignOff(body, 'Alex')).toBe(body);
  });

  it('completes a sign-off that has a closing but no name', () => {
    const result = ensureSignOff('Hi there, quick question.\n\nBest regards,', 'Alex');
    expect(result.endsWith('Alex')).toBe(true);
  });

  it('does not duplicate a name already at the end', () => {
    const body = 'Hi.\n\nThanks,\nAlex';
    expect(ensureSignOff(body, 'Alex').match(/Alex/g)).toHaveLength(1);
  });

  it('is case insensitive when checking for the name', () => {
    const body = 'Hi.\n\nBest,\nalex';
    expect(ensureSignOff(body, 'Alex')).toBe(body);
  });

  it('handles an empty body without producing an unsigned email', () => {
    expect(ensureSignOff('', 'Alex')).toContain('Alex');
  });

  it('keeps the original body text intact', () => {
    const result = ensureSignOff('I would love to chat.', 'Alex');
    expect(result).toContain('I would love to chat.');
  });
});