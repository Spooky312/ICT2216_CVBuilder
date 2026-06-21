import React, { useState } from 'react';
import EntryCard from '../EntryCard';
import FieldError, { errorProps } from '../../common/FieldError';

const BLANK = { name: '', description: '', technologies: [], url: '', start_date: '', end_date: '' };

export default function Projects({ data, onChange, errors = {}, onFieldBlur }) {
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
              <label htmlFor={`project-${i}-name`}>Project Name *</label>
              <input id={`project-${i}-name`} value={proj.name}
                onChange={(e) => update(i, 'name', e.target.value)} onBlur={() => onFieldBlur(`${i}.name`)}
                maxLength={200} {...errorProps(errors, `${i}.name`, `project-${i}-name`)} />
              <FieldError errors={errors} name={`${i}.name`} inputId={`project-${i}-name`} />
            </div>
            <div className="form-group">
              <label htmlFor={`project-${i}-url`}>URL</label>
              <input
                id={`project-${i}-url`}
                type="url"
                value={proj.url}
                onChange={(e) => update(i, 'url', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.url`)}
                maxLength={255}
                placeholder="https://github.com/you/project"
                {...errorProps(errors, `${i}.url`, `project-${i}-url`)}
              />
              <small className="field-hint">Must start with http:// or https://, or leave blank</small>
              <FieldError errors={errors} name={`${i}.url`} inputId={`project-${i}-url`} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor={`project-${i}-start`}>Start Date</label>
              <input id={`project-${i}-start`} value={proj.start_date}
                onChange={(e) => update(i, 'start_date', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.start_date`)} placeholder="2023" maxLength={7}
                {...errorProps(errors, `${i}.start_date`, `project-${i}-start`)} />
              <FieldError errors={errors} name={`${i}.start_date`} inputId={`project-${i}-start`} />
            </div>
            <div className="form-group">
              <label htmlFor={`project-${i}-end`}>End Date</label>
              <input id={`project-${i}-end`} value={proj.end_date}
                onChange={(e) => update(i, 'end_date', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.end_date`)} placeholder="2024 or Present" maxLength={7}
                {...errorProps(errors, `${i}.end_date`, `project-${i}-end`)} />
              <FieldError errors={errors} name={`${i}.end_date`} inputId={`project-${i}-end`} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor={`project-${i}-technologies`}>Technologies <small>(comma-separated)</small></label>
            <input
              id={`project-${i}-technologies`}
              value={rawTechs[i] !== undefined ? rawTechs[i] : (proj.technologies || []).join(', ')}
              onChange={(e) => onTechChange(i, e.target.value)}
              onBlur={() => {
                onTechBlur(i);
                window.requestAnimationFrame(() => onFieldBlur(`${i}.technologies`));
              }}
              placeholder="Python, React, PostgreSQL"
            />
            <FieldError errors={errors} name={`${i}.technologies`} inputId={`project-${i}-technologies`} />
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
