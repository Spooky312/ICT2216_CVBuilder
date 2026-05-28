import React, { useState } from 'react';
import EntryCard from '../EntryCard';

const BLANK = { name: '', description: '', technologies: [], url: '', start_date: '', end_date: '' };

export default function Projects({ data, onChange }) {
  const items = data || [];

  // Keep a raw string per entry for the technologies field so the user can
  // type "Python, React" freely without the comma being consumed immediately.
  // We only parse into an array when the field loses focus (onBlur).
  const [rawTechs, setRawTechs] = useState(
    () => items.reduce((acc, proj, i) => ({
      ...acc,
      [i]: (proj.technologies || []).join(', '),
    }), {})
  );

  const add = () => {
    onChange([...items, { ...BLANK, technologies: [] }]);
  };

  const remove = (i) => {
    onChange(items.filter((_, idx) => idx !== i));
    setRawTechs((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k, 10);
        if (ki < i) next[ki] = v;
        else if (ki > i) next[ki - 1] = v;
      });
      return next;
    });
  };

  const update = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  // Update display text while typing — does NOT parse yet
  const onTechChange = (i, raw) => {
    setRawTechs((prev) => ({ ...prev, [i]: raw }));
  };

  // Parse into array only when the field loses focus
  const onTechBlur = (i) => {
    const parsed = (rawTechs[i] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    update(i, 'technologies', parsed);
  };

  return (
    <div className="step-form">
      <div className="step-form-header">
        <h3>Projects</h3>
        <button type="button" className="btn-secondary-sm" onClick={add}
          disabled={items.length >= 20}>+ Add Project</button>
      </div>

      {items.length === 0 && (
        <p className="text-muted empty-hint">No projects yet. Click "Add Project" to begin.</p>
      )}

      {items.map((proj, i) => (
        <EntryCard key={i} index={i} label="Project" onRemove={() => remove(i)}>
          <div className="form-row">
            <div className="form-group">
              <label>Project Name *</label>
              <input value={proj.name} onChange={(e) => update(i, 'name', e.target.value)} maxLength={200} />
            </div>
            <div className="form-group">
              <label>URL</label>
              <input
                type="text"
                value={proj.url}
                onChange={(e) => update(i, 'url', e.target.value)}
                maxLength={255}
                placeholder="https://github.com/you/project"
              />
              <small className="field-hint">Must start with https:// or leave blank</small>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input value={proj.start_date} onChange={(e) => update(i, 'start_date', e.target.value)}
                placeholder="2023" maxLength={7} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input value={proj.end_date} onChange={(e) => update(i, 'end_date', e.target.value)}
                placeholder="2024 or Present" maxLength={7} />
            </div>
          </div>

          <div className="form-group">
            <label>Technologies <small>(comma-separated, press Tab or click away to apply)</small></label>
            <input
              value={rawTechs[i] !== undefined ? rawTechs[i] : (proj.technologies || []).join(', ')}
              onChange={(e) => onTechChange(i, e.target.value)}
              onBlur={() => onTechBlur(i)}
              placeholder="Python, React, PostgreSQL"
            />
            {(proj.technologies || []).length > 0 && (
              <div className="tags" style={{ marginTop: '0.4rem' }}>
                {proj.technologies.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea rows={3} value={proj.description}
              onChange={(e) => update(i, 'description', e.target.value)} maxLength={500} />
          </div>
        </EntryCard>
      ))}
    </div>
  );
}
