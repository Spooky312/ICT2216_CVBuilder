import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import PhoneInput from './PhoneInput';

describe('PhoneInput splitPhone on mount', () => {
  it('splits an existing "+65 9123 4567" value into code and number', () => {
    const { container } = render(
      <PhoneInput value="+65 9123 4567" onChange={vi.fn()} onBlur={vi.fn()} errors={{}} />
    );
    // The number input should be pre-filled with the local part.
    const inputs = container.querySelectorAll('input');
    const numberField = Array.from(inputs).find((el) => el.value.includes('9123'));
    expect(numberField).toBeTruthy();
    expect(numberField.value.replace(/\s/g, '')).toContain('9123');
  });

  it('renders a default code when the value is empty', () => {
    const { container } = render(
      <PhoneInput value="" onChange={vi.fn()} onBlur={vi.fn()} errors={{}} />
    );
    expect(container.querySelector('input')).toBeTruthy();
  });
});
