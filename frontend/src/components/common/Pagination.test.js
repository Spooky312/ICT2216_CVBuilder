import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPage={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the current page and total pages', () => {
    render(<Pagination page={2} totalPages={5} onPage={vi.fn()} />);
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
  });

  it('disables Prev on the first page and Next on the last page', () => {
    render(<Pagination page={1} totalPages={3} onPage={vi.fn()} />);
    expect(screen.getByRole('button', { name: '← Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next →' })).toBeEnabled();
  });

  it('calls onPage with page - 1 / page + 1 when enabled', () => {
    const onPage = vi.fn();
    render(<Pagination page={2} totalPages={3} onPage={onPage} />);
    fireEvent.click(screen.getByRole('button', { name: '← Prev' }));
    expect(onPage).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(onPage).toHaveBeenCalledWith(3);
  });
});
