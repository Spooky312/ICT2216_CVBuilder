import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Education from './Education';

const blankEntry = { institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', gpa: '', description: '' };

describe('Education entries', () => {
  it('shows an empty hint when there are no entries', () => {
    render(<Education data={[]} onChange={vi.fn()} onFieldBlur={vi.fn()} />);
    expect(screen.getByText(/No education entries yet/)).toBeInTheDocument();
  });

  it('adds a blank entry when "+ Add Entry" is clicked', () => {
    const onChange = vi.fn();
    render(<Education data={[]} onChange={onChange} onFieldBlur={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Entry' }));
    expect(onChange).toHaveBeenCalledWith([blankEntry]);
  });

  it('disables "+ Add Entry" at 20 items', () => {
    const many = Array.from({ length: 20 }, () => ({ ...blankEntry }));
    render(<Education data={many} onChange={vi.fn()} onFieldBlur={vi.fn()} />);
    expect(screen.getByRole('button', { name: '+ Add Entry' })).toBeDisabled();
  });

  it('removes an entry', () => {
    const onChange = vi.fn();
    render(<Education data={[{ ...blankEntry, institution: 'MIT' }]} onChange={onChange} onFieldBlur={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('updates institution, degree, field of study, gpa, and description', () => {
    const onChange = vi.fn();
    render(<Education data={[{ ...blankEntry }]} onChange={onChange} onFieldBlur={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Institution *'), { target: { value: 'MIT' } });
    expect(onChange.mock.calls.at(-1)[0][0].institution).toBe('MIT');
    fireEvent.change(screen.getByLabelText('Degree *'), { target: { value: 'BSc' } });
    expect(onChange.mock.calls.at(-1)[0][0].degree).toBe('BSc');
    fireEvent.change(screen.getByLabelText('Field of Study'), { target: { value: 'CS' } });
    expect(onChange.mock.calls.at(-1)[0][0].field_of_study).toBe('CS');
    fireEvent.change(screen.getByLabelText('Grade'), { target: { value: '3.9' } });
    expect(onChange.mock.calls.at(-1)[0][0].gpa).toBe('3.9');
    fireEvent.change(screen.getByLabelText('Description / Achievements'), { target: { value: "Dean's list" } });
    expect(onChange.mock.calls.at(-1)[0][0].description).toBe("Dean's list");
  });

  it('calls onFieldBlur with the right path for institution/degree/gpa', () => {
    const onFieldBlur = vi.fn();
    render(<Education data={[{ ...blankEntry }]} onChange={vi.fn()} onFieldBlur={onFieldBlur} />);
    fireEvent.blur(screen.getByLabelText('Institution *'));
    expect(onFieldBlur).toHaveBeenCalledWith('0.institution');
    fireEvent.blur(screen.getByLabelText('Degree *'));
    expect(onFieldBlur).toHaveBeenCalledWith('0.degree');
    fireEvent.blur(screen.getByLabelText('Grade'));
    expect(onFieldBlur).toHaveBeenCalledWith('0.gpa');
  });
});
