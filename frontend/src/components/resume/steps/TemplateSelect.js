import React from 'react';

const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean two-column layout with blue accent colors. Great for tech roles.',
    preview: '🟦',
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional serif single-column format. Ideal for academic and professional roles.',
    preview: '📄',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Whitespace-focused, clean sans-serif. Works across all industries.',
    preview: '⬜',
  },
];

export default function TemplateSelect({ selected, onChange }) {
  return (
    <div className="step-form">
      <h3>Choose a Template</h3>
      <p className="text-muted">All templates are ATS-friendly and parse cleanly.</p>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`template-card ${selected === t.id ? 'selected' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <div className="template-preview">{t.preview}</div>
            <div className="template-name">{t.name}</div>
            <div className="template-desc">{t.description}</div>
            {selected === t.id && <div className="template-check">✓ Selected</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
