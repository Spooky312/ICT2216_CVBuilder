// import React from 'react';
// import FieldError from '../../common/FieldError';

// const TEMPLATES = [
//   {
//     id: 'modern',
//     name: 'Modern',
//     description: 'Clean two-column layout with blue accent colors. Great for tech roles.',
//     preview: '🟦',
//   },
//   {
//     id: 'classic',
//     name: 'Classic',
//     description: 'Traditional serif single-column format. Ideal for academic and professional roles.',
//     preview: '📄',
//   },
//   {
//     id: 'minimal',
//     name: 'Minimal',
//     description: 'Whitespace-focused, clean sans-serif. Works across all industries.',
//     preview: '⬜',
//   },
// ];

// export default function TemplateSelect({ selected, onChange, errors = {} }) {
//   return (
//     <div className="step-form">
//       <h3>Choose a Template</h3>
//       <p className="text-muted">All templates are ATS-friendly and parse cleanly.</p>
//       <div className="template-grid" role="radiogroup" aria-label="Resume template">
//         {TEMPLATES.map((t) => (
//           <button
//             key={t.id}
//             type="button"
//             className={`template-card ${selected === t.id ? 'selected' : ''}`}
//             onClick={() => onChange(t.id)}
//             role="radio"
//             aria-checked={selected === t.id}
//           >
//             <div className="template-preview">{t.preview}</div>
//             <div className="template-name">{t.name}</div>
//             <div className="template-desc">{t.description}</div>
//             {selected === t.id && <div className="template-check">✓ Selected</div>}
//           </button>
//         ))}
//       </div>
//       <FieldError errors={errors} name="template_id" inputId="template-choice" />
//     </div>
//   );
// }

import React, { useState, useEffect } from 'react';
import FieldError from '../../common/FieldError';
import { getTemplates } from '../../../services/api'; // Import our new API function
import Spinner from '../../common/Spinner';

export default function TemplateSelect({ selected, onChange, errors = {} }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await getTemplates();
        setTemplates(res.data);
      } catch (err) {
        console.error("Failed to load templates", err);
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, []);

  // Helper to assign a fallback emoji preview icon
  const getPreviewIcon = (t) => {
    if (t.is_uploaded) return '🌐'; // Custom HTML indicator
    if (t.id === 'modern') return '🟦';
    if (t.id === 'classic') return '📄';
    return '⬜'; // minimal or unknown
  };

  if (loading) {
    return <div className="step-form center-page"><Spinner size={30} /></div>;
  }

  return (
    <div className="step-form">
      <h3>Choose a Template</h3>
      <p className="text-muted">All templates are ATS-friendly and parse cleanly.</p>
      
      <div className="template-grid" role="radiogroup" aria-label="Resume template">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`template-card ${selected === t.id ? 'selected' : ''}`}
            onClick={() => onChange(t.id)}
            role="radio"
            aria-checked={selected === t.id}
          >
            <div className="template-preview">{getPreviewIcon(t)}</div>
            <div className="template-name">
              {t.name}
              {t.is_uploaded && <span className="badge badge-user" style={{marginLeft: '6px', fontSize: '0.7rem'}}>Custom</span>}
            </div>
            <div className="template-desc">{t.description || 'Custom template layout.'}</div>
            {selected === t.id && <div className="template-check">✓ Selected</div>}
          </button>
        ))}
      </div>
      
      {templates.length === 0 && (
        <div className="alert alert-warning">No active templates available. Please contact an administrator.</div>
      )}

      <FieldError errors={errors} name="template_id" inputId="template-choice" />
    </div>
  );
}
