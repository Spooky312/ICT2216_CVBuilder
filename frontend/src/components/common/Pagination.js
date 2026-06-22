
/**
 * Pagination — Prev / Page-of-N / Next controls.
 *
 * Props:
 *   page        {number}   current 1-based page
 *   totalPages  {number}   total page count
 *   onPage      {function} called with the new page number
 */
export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <button
        className="btn-secondary-sm"
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
      >
        ← Prev
      </button>
      <span>Page {page} of {totalPages}</span>
      <button
        className="btn-secondary-sm"
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
      >
        Next →
      </button>
    </div>
  );
}
