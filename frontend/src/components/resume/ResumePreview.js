import Spinner from '../common/Spinner';

export default function ResumePreview({ url, loading, error, stale, paused, onClose }) {
  return (
    <aside className="resume-preview" aria-label="Resume preview">
      <div className="resume-preview-header">
        <div>
          <div className="resume-preview-title-row">
            <h2>Resume preview</h2>
            {paused && <span className="preview-stale-badge">Waiting for valid fields</span>}
            {!paused && stale && <span className="preview-stale-badge">Updating automatically</span>}
          </div>
          <p>{paused
            ? 'Complete the required fields to refresh the preview.'
            : (stale ? 'Your latest changes will appear shortly.' : 'This matches the exported PDF.')}</p>
        </div>
        <button type="button" className="preview-close" onClick={onClose}
          aria-label="Close resume preview">
          <span className="preview-close-desktop" aria-hidden="true">×</span>
          <span className="preview-close-mobile">Back to editing</span>
        </button>
      </div>

      {error && <div className="preview-error" role="alert">{error}</div>}

      <div className="resume-preview-canvas" aria-live="polite">
        {loading && (
          <div className={`preview-loading ${url ? 'preview-loading-overlay' : ''}`}>
            <Spinner size={28} />
            <span>Rendering PDF…</span>
          </div>
        )}
        {url ? (
          <iframe src={url} title="Generated resume PDF preview" />
        ) : !loading && (
          <div className="preview-empty">
            <strong>No preview yet</strong>
            <span>{paused
              ? 'Complete the required fields to generate it.'
              : 'It will render automatically when your changes settle.'}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
