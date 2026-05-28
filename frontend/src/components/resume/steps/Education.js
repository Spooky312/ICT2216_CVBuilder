import React from 'react';
import EntryCard from '../EntryCard';

const BLANK = { institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', gpa: '', description: '' };

export default function Education({ data, onChange }) {
  const items = data || [];

  const add = () => onChange([...items, { ...BLANK }]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="step-form">
      <div className="step-form-header">
        <h3>Education</h3>
        <button type="button" className="btn-secondary-sm" onClick={add}
          disabled={items.length >= 10}>+ Add Entry</button>
      </div>

      {items.length === 0 && (
        <p className="text-muted empty-hint">No education entries yet. Click "Add Entry" to begin.</p>
      )}

      {items.map((edu, i) => (
        <EntryCard key={i} index={i} onRemove={() => remove(i)}>
          <div className="form-row">
            <div className="form-group">
              <label>Institution *</label>
              <input value={edu.institution} onChange={(e) => update(i, 'institution', e.target.value)} maxLength={200} />
            </div>
            <div className="form-group">
              <label>Degree *</label>
              <input value={edu.degree} onChange={(e) => update(i, 'degree', e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Field of Study</label>
              <input value={edu.field_of_study} onChange={(e) => update(i, 'field_of_study', e.target.value)} maxLength={200} />
            </div>
            <div className="form-group">
              <label>GPA</label>
              <input value={edu.gpa} onChange={(e) => update(i, 'gpa', e.target.value)} maxLength={10} placeholder="3.8/4.0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input value={edu.start_date} onChange={(e) => update(i, 'start_date', e.target.value)} placeholder="2020 or 2020-09" maxLength={7} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input value={edu.end_date} onChange={(e) => update(i, 'end_date', e.target.value)} placeholder="2024 or Present" maxLength={7} />
            </div>
          </div>
          <div className="form-group">
            <label>Description / Achievements</label>
            <textarea rows={2} value={edu.description} onChange={(e) => update(i, 'description', e.target.value)} maxLength={500} />
          </div>
        </EntryCard>
      ))}
    </div>
  );
}
