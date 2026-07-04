import { describe, it, expect } from 'vitest';
import { RESUME_STEPS, stepIndex } from './resumeSteps';

describe('stepIndex', () => {
  it('returns the index of a known step', () => {
    expect(stepIndex('personal')).toBe(1);
    expect(stepIndex('skills')).toBe(RESUME_STEPS.length - 1);
  });

  it('clamps unknown steps to 0', () => {
    expect(stepIndex('does-not-exist')).toBe(0);
  });
});
