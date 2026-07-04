import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResumeWizard, { errorPathLabel, flattenErrors, pruneVisibleErrors } from './ResumeWizard';
import * as api from '../../services/api';

vi.mock('../../services/api');
vi.mock('../../utils/resumeValidation', async () => {
  const actual = await vi.importActual('../../utils/resumeValidation');
  return { ...actual, validateResumeStep: () => ({}), validateResume: () => ({}) };
});

const { paramsMock, navigateMock } = vi.hoisted(() => ({
  paramsMock: vi.fn(() => ({})),
  navigateMock: vi.fn(),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: paramsMock, useNavigate: () => navigateMock };
});

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

describe('ResumeWizard create vs edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paramsMock.mockReturnValue({});
    globalThis.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    api.getTemplates.mockResolvedValue({ data: [] });
  });

  it('does not load an existing resume in create mode', async () => {
    render(<MemoryRouter><ResumeWizard /></MemoryRouter>);
    expect(await screen.findByText('1 / 6')).toBeInTheDocument();
    expect(api.getResume).not.toHaveBeenCalled();
  });

  it('loads the existing resume in edit mode', async () => {
    paramsMock.mockReturnValue({ id: '123' });
    api.getResume.mockResolvedValue({ data: { title: 'My CV', template_id: 'modern', content_json: null } });
    render(<MemoryRouter><ResumeWizard /></MemoryRouter>);
    await waitFor(() => expect(api.getResume).toHaveBeenCalledWith('123'));
    expect(await screen.findByDisplayValue('My CV')).toBeInTheDocument();
  });

  it('advances through steps via Next', async () => {
    render(<MemoryRouter><ResumeWizard /></MemoryRouter>);
    await screen.findByText('1 / 6');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('2 / 6')).toBeInTheDocument();
  });

  it('calls createResume when saving in create mode', async () => {
    api.createResume.mockResolvedValue({});
    render(<MemoryRouter><ResumeWizard /></MemoryRouter>);
    await screen.findByText('1 / 6');
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Create Resume' }));
    await waitFor(() => expect(api.createResume).toHaveBeenCalled());
    expect(api.updateResume).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('calls updateResume when saving in edit mode', async () => {
    paramsMock.mockReturnValue({ id: '123' });
    api.getResume.mockResolvedValue({ data: { title: 'My CV', template_id: 'modern', content_json: null } });
    api.updateResume.mockResolvedValue({});
    render(<MemoryRouter><ResumeWizard /></MemoryRouter>);
    await screen.findByDisplayValue('My CV');
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Update Resume' }));
    await waitFor(() => expect(api.updateResume).toHaveBeenCalledWith('123', expect.any(Object)));
  });
});
