import { describe, expect, it } from 'vitest';

import {
  derivePracticeSetTitle,
  sanitizeGeneratedPracticeSetTitle,
} from './contracts';

describe('derivePracticeSetTitle', () => {
  it('avoids section headers like About the job', () => {
    expect(
      derivePracticeSetTitle('About the job\n\nWe need a senior backend engineer…'),
    ).toBe('Interview practice set');
  });

  it('uses a short role-like first line', () => {
    expect(derivePracticeSetTitle('Senior Platform Engineer\n\nBuild APIs…')).toBe(
      'Senior Platform Engineer',
    );
  });
});

describe('sanitizeGeneratedPracticeSetTitle', () => {
  it('keeps a good AI title', () => {
    expect(
      sanitizeGeneratedPracticeSetTitle(
        'Senior Backend Interview Drill',
        'About the job\nJava, Kafka…',
      ),
    ).toBe('Senior Backend Interview Drill');
  });

  it('strips Practice set: prefix from AI output', () => {
    expect(
      sanitizeGeneratedPracticeSetTitle(
        'Practice set: React Frontend Prep',
        'Frontend Engineer',
      ),
    ).toBe('React Frontend Prep');
  });

  it('falls back when title is missing or junk', () => {
    expect(sanitizeGeneratedPracticeSetTitle(null, 'Staff SRE\nOwn reliability')).toBe(
      'Staff SRE',
    );
    expect(sanitizeGeneratedPracticeSetTitle('About the job', 'Staff SRE')).toBe('Staff SRE');
  });
});
