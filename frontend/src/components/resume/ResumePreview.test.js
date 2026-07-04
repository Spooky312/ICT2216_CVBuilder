import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResumePreview from './ResumePreview';

describe('ResumePreview status messaging', () => {
  it('shows the paused message and badge', () => {
    render(<ResumePreview paused onClose={vi.fn()} />);
    expect(screen.getByText('Complete the required fields to refresh the preview.')).toBeInTheDocument();
    expect(screen.getByText('Waiting for valid fields')).toBeInTheDocument();
  });

  it('shows the stale message and badge when not paused', () => {
    render(<ResumePreview stale onClose={vi.fn()} />);
    expect(screen.getByText('Your latest changes will appear shortly.')).toBeInTheDocument();
    expect(screen.getByText('Updating automatically')).toBeInTheDocument();
  });

  it('shows the default message when neither paused nor stale', () => {
    render(<ResumePreview onClose={vi.fn()} />);
    expect(screen.getByText('This matches the exported PDF.')).toBeInTheDocument();
    expect(screen.queryByText('Waiting for valid fields')).not.toBeInTheDocument();
    expect(screen.queryByText('Updating automatically')).not.toBeInTheDocument();
  });
});

describe('ResumePreview content states', () => {
  it('renders an error alert', () => {
    render(<ResumePreview error="Failed to render" onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to render');
  });

  it('renders the iframe with the given url', () => {
    render(<ResumePreview url="blob:abc" onClose={vi.fn()} />);
    expect(screen.getByTitle('Generated resume PDF preview')).toHaveAttribute('src', 'blob:abc');
  });

  it('shows the loading spinner without a url', () => {
    const { container } = render(<ResumePreview loading onClose={vi.fn()} />);
    expect(screen.getByText('Rendering PDF…')).toBeInTheDocument();
    expect(container.querySelector('.preview-loading-overlay')).not.toBeInTheDocument();
  });

  it('shows the loading overlay variant when a url is also present', () => {
    const { container } = render(<ResumePreview loading url="blob:abc" onClose={vi.fn()} />);
    expect(container.querySelector('.preview-loading-overlay')).toBeInTheDocument();
  });

  it('shows the empty state message, varying by paused', () => {
    const { rerender } = render(<ResumePreview onClose={vi.fn()} />);
    expect(screen.getByText('It will render automatically when your changes settle.')).toBeInTheDocument();
    rerender(<ResumePreview paused onClose={vi.fn()} />);
    expect(screen.getByText('Complete the required fields to generate it.')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ResumePreview onClose={onClose} />);
    screen.getByRole('button', { name: 'Close resume preview' }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
