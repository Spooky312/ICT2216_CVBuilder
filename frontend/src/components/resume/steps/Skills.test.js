import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Skills from './Skills';

describe('Skills certifications parsing', () => {
  it('parses newline-separated certifications on change and blur', () => {
    const onChange = vi.fn();
    const onFieldBlur = vi.fn();
    const { container } = render(
      <Skills data={{ certifications: [] }} onChange={onChange} onFieldBlur={onFieldBlur} />
    );

    const textarea = container.querySelector('#skills-certifications');
    fireEvent.change(textarea, { target: { value: 'AWS SA\n  \nGCP DE\n' } });

    // Latest onChange payload should carry the trimmed, non-empty list.
    const lastCall = onChange.mock.calls.at(-1)[0];
    expect(lastCall.certifications).toEqual(['AWS SA', 'GCP DE']);

    // Blur re-parses the raw buffer (onCertBlur -> set('certifications')).
    onChange.mockClear();
    fireEvent.blur(textarea);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)[0].certifications).toEqual(['AWS SA', 'GCP DE']);
  });

  it('adds a technical skill via the tag input', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Skills data={{ technical: [] }} onChange={onChange} onFieldBlur={vi.fn()} />
    );
    const input = container.querySelector('#skills-technical');
    fireEvent.change(input, { target: { value: 'React' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const lastCall = onChange.mock.calls.at(-1)[0];
    expect(lastCall.technical).toContain('React');
  });
});
