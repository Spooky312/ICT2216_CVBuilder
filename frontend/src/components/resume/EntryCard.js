
/**
 * EntryCard — shared card wrapper for wizard list entries (Education, Experience, Projects).
 *
 * Props:
 *   index    {number}    0-based index (displays as "Entry N" or custom label)
 *   label    {string?}   Override display label (default: "Entry")
 *   onRemove {function}  Called when the Remove button is clicked
 *   children {ReactNode} Card body content
 */
export default function EntryCard({ index, label = 'Entry', onRemove, children }) {
  return (
    <div className="entry-card">
      <div className="entry-card-header">
        <span>{label} {index + 1}</span>
        <button type="button" className="btn-danger-sm" onClick={onRemove}>Remove</button>
      </div>
      {children}
    </div>
  );
}
