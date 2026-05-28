import React from 'react';
import EntryCard from '../EntryCard';

const BLANK = { company: '', position: '', location: '', start_date: '', end_date: '', description: '', achievements: [] };

export default function Experience({ data, onChange }) {
  const items = data || [];

  const add = () => onChange([...items, { ...BLANK }]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const addAchievement = (i) => {
    const next = [...items];
    next[i] = { ...next[i], achievements: [...(next[i].achievements || []), ''] };
    onChange(next);
  };
  const updateAchievement = (i, ai, val) => {
    const next = [...items];
    const achs = [...(next[i].achievements || [])];
    achs[ai] = val;
    next[i] = { ...next[i], achievements: achs };
    onChange(next);
  };
  const removeAchievement = (i, ai) => {
    const next = [...items];
    next[i] = { ...next[i], achievements: (next[i].achievements || []).filter((_, idx) => idx !== ai) };
    onChange(next);
  };

  return (
    <div className="step-form">
      <div className="step-form-header">
        <h3>Work Experience</h3>
        <button type="button" className="btn-secondary-sm" onClick={add}
          disabled={items.length >= 20}>+ Add Entry</button>
      </div>

      {items.length === 0 && (
        <p className="text-muted empty-hint">No experience entries yet. Click "Add Entry" to begin.</p>
      )}

      {items.map((exp, i) => (
        <EntryCard key={i} index={i} onRemove={() => remove(i)}>
          <div className="form-row">
            <div className="form-group">
              <label>Position *</label>
              <input value={exp.position} onChange={(e) => update(i, 'position', e.target.value)} maxLength={200} />
            </div>
            <div className="form-group">
              <label>Company *</label>
              <input value={exp.company} onChange={(e) => update(i, 'company', e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Location</label>
              <input value={exp.location} onChange={(e) => update(i, 'location', e.target.value)} maxLength={100} />
            </div>
            <div className="form-group form-row" style={{ gap: '0.5rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Start Date</label>
                <input value={exp.start_date} onChange={(e) => update(i, 'start_date', e.target.value)} placeholder="2022-01" maxLength={7} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>End Date</label>
                <input value={exp.end_date} onChange={(e) => update(i, 'end_date', e.target.value)} placeholder="Present" maxLength={7} />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={2} value={exp.description} onChange={(e) => update(i, 'description', e.target.value)} maxLength={500} />
          </div>
          <div className="form-group">
            <div className="step-form-header" style={{ marginBottom: '0.5rem' }}>
              <label>Key Achievements</label>
              <button type="button" className="btn-secondary-sm"
                onClick={() => addAchievement(i)}
                disabled={(exp.achievements || []).length >= 10}>+ Add</button>
            </div>
            {(exp.achievements || []).map((ach, ai) => (
              <div key={ai} className="achievement-row">
                <input value={ach} onChange={(e) => updateAchievement(i, ai, e.target.value)} maxLength={500} placeholder="Quantified achievement…" />
                <button type="button" className="btn-danger-sm" onClick={() => removeAchievement(i, ai)}>×</button>
              </div>
            ))}
          </div>
        </EntryCard>
      ))}
    </div>
  );
}
