import { describe, it, expect } from 'vitest';
import { errorPathLabel, flattenErrors, pruneVisibleErrors } from './ResumeWizard';

describe('errorPathLabel', () => {
  it('formats numeric keys as 1-based entry labels', () => {
    expect(errorPathLabel('0')).toBe('entry 1');
    expect(errorPathLabel('3')).toBe('entry 4');
  });

  it('humanises underscore-separated field names', () => {
    expect(errorPathLabel('start_date')).toBe('start date');
    expect(errorPathLabel('field_of_study')).toBe('field of study');
  });
});

describe('flattenErrors', () => {
  it('collects leaf messages from nested marshmallow errors', () => {
    const nested = {
      personal: { email: ['Invalid email.'] },
      experience: { 0: { company: 'Required.' } },
    };
    const flat = flattenErrors(nested);
    expect(flat).toContain('personal → email: Invalid email.');
    expect(flat).toContain('experience → entry 1 → company: Required.');
  });

  it('returns an empty list for non-error values', () => {
    expect(flattenErrors(42)).toEqual([]);
  });
});

describe('pruneVisibleErrors', () => {
  it('keeps only fields still present in current errors', () => {
    const visible = { a: 'x', b: 'y' };
    const current = { a: 'new-x' };
    expect(pruneVisibleErrors(visible, current)).toEqual({ a: 'new-x' });
  });
});
