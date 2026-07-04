import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Experience from './Experience';

const blankEntry = { company: '', position: '', location: '', start_date: '', end_date: '', description: '', achievements: [] };

describe('Experience entries', () => {
  it('shows an empty hint when there are no entries', () => {
    render(<Experience data={[]} onChange={vi.fn()} onFieldBlur={vi.fn()} />);
    expect(screen.getByText(/No experience entries yet/)).toBeInTheDocument();
  });

  it('adds a blank entry when "+ Add Entry" is clicked', () => {
    const onChange = vi.fn();
    render(<Experience data={[]} onChange={onChange} onFieldBlur={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Entry' }));
    expect(onChange).toHaveBeenCalledWith([blankEntry]);
  });

  it('disables "+ Add Entry" at 20 items', () => {
    const many = Array.from({ length: 20 }, () => ({ ...blankEntry }));
    render(<Experience data={many} onChange={vi.fn()} onFieldBlur={vi.fn()} />);
    expect(screen.getByRole('button', { name: '+ Add Entry' })).toBeDisabled();
  });

  it('removes an entry', () => {
    const onChange = vi.fn();
    render(<Experience data={[{ ...blankEntry, position: 'Engineer' }]} onChange={onChange} onFieldBlur={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('updates the position and company fields', () => {
    const onChange = vi.fn();
    render(<Experience data={[{ ...blankEntry }]} onChange={onChange} onFieldBlur={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Position *'), { target: { value: 'Engineer' } });
    expect(onChange.mock.calls.at(-1)[0][0].position).toBe('Engineer');
    fireEvent.change(screen.getByLabelText('Company *'), { target: { value: 'Acme' } });
    expect(onChange.mock.calls.at(-1)[0][0].company).toBe('Acme');
  });

  it('calls onFieldBlur with the right path for position/company', () => {
    const onFieldBlur = vi.fn();
    render(<Experience data={[{ ...blankEntry }]} onChange={vi.fn()} onFieldBlur={onFieldBlur} />);
    fireEvent.blur(screen.getByLabelText('Position *'));
    expect(onFieldBlur).toHaveBeenCalledWith('0.position');
    fireEvent.blur(screen.getByLabelText('Company *'));
    expect(onFieldBlur).toHaveBeenCalledWith('0.company');
  });

  it('adds, updates, and removes an achievement', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Experience data={[{ ...blankEntry }]} onChange={onChange} onFieldBlur={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(onChange.mock.calls.at(-1)[0][0].achievements).toEqual(['']);

    const withAch = [{ ...blankEntry, achievements: ['Shipped X'] }];
    rerender(<Experience data={withAch} onChange={onChange} onFieldBlur={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Achievement 1'), { target: { value: 'Shipped Y' } });
    expect(onChange.mock.calls.at(-1)[0][0].achievements).toEqual(['Shipped Y']);

    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onChange.mock.calls.at(-1)[0][0].achievements).toEqual([]);
  });

  it('disables "+ Add" achievement at 10 items', () => {
    const withMany = [{ ...blankEntry, achievements: Array.from({ length: 10 }, (_, i) => `A${i}`) }];
    render(<Experience data={withMany} onChange={vi.fn()} onFieldBlur={vi.fn()} />);
    expect(screen.getByRole('button', { name: '+ Add' })).toBeDisabled();
  });
});
