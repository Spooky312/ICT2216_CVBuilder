import React from 'react';
import Spinner from '../common/Spinner';

export default function ResumePreview({ url, loading, error, stale, onClose }) {
  return (
    <aside className="resume-preview" aria-label="Resume preview">
      <div className="resume-preview-header">
        <div>
          <div className="resume-preview-title-row">
            <h2>Resume preview</h2>
            {stale && <span className="preview-stale-badge">Changes not previewed</span>}
          </div>
          <p>{stale ? 'Select Update preview to render your latest changes.' : 'This matches the exported PDF.'}</p>
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
            <strong>No preview generated</strong>
            <span>Select Preview to render the current draft.</span>
          </div>
        )}
      </div>
    </aside>
  );
}
