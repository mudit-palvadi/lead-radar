import { describe, it, expect } from 'vitest';
import { cleanEmailBody, ensureSignOff, pitchGuidance } from './index.js';

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

describe('cleanEmailBody', () => {
  it('strips a confession about not checking the website', () => {
    const body =
      'Hi Rosa. I noticed you have no website. ' +
      "I haven't checked your website in detail, so I can't confirm. " +
      'Would you be open to a call?';
    const result = cleanEmailBody(body);
    expect(result).not.toMatch(/haven't checked/i);
    expect(result).toContain('no website');
    expect(result).toContain('open to a call');
  });

  it('strips a confession about not visiting', () => {
    const result = cleanEmailBody(
      'Hi there. I did not visit your site. I can help with marketing.',
    );
    expect(result).not.toMatch(/did not visit/i);
    expect(result).toContain('marketing');
  });

  it('leaves a clean email untouched', () => {
    const body = 'Hi Rosa. You have 4.7 stars from 212 reviews. Can I help?';
    expect(cleanEmailBody(body)).toBe(body);
  });

  it('never returns an empty string when given a non-empty body', () => {
    expect(cleanEmailBody("I haven't checked anything.").length).toBeGreaterThan(0);
  });
});

describe('pitchGuidance', () => {
  it('tells a non-web freelancer never to offer a website', () => {
    const guidance = pitchGuidance('social media marketing', false);
    expect(guidance).toMatch(/never offer to build/i);
    expect(guidance).toMatch(/social media marketing/);
  });

  it('lets a web freelancer pitch building the site', () => {
    const guidance = pitchGuidance('Web Development', false);
    expect(guidance).toMatch(/natural pitch/i);
  });

  it('tells anyone with an existing-site lead not to pitch building one', () => {
    for (const service of ['social media marketing', 'Web Development']) {
      expect(pitchGuidance(service, true)).toMatch(/already has a website/i);
    }
  });
});