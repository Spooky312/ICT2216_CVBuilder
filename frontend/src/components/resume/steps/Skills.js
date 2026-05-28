import React, { useState } from 'react';

function TagInput({ label, values, onChange, max = 30 }) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed) && values.length < max) {
      onChange([...values, trimmed]);
      setInput('');
    }
  };

  const remove = (v) => onChange(values.filter((x) => x !== v));

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
  };

  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="tag-input-row">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
          maxLength={50} placeholder="Type and press Enter or comma" />
        <button type="button" className="btn-secondary-sm" onClick={add}
          disabled={values.length >= max}>Add</button>
      </div>
      <div className="tags">
        {values.map((v) => (
          <span key={v} className="tag">
            {v}
            <button type="button" onClick={() => remove(v)} aria-label={`Remove ${v}`}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Skills({ data, onChange }) {
  const skills = data || {};
  const set = (field) => (val) => onChange({ ...skills, [field]: val });

  // Keep certifications as raw text while the user is typing so that pressing
  // Enter to go to a new line isn't immediately swallowed by filter(Boolean).
  // We convert to array only when the textarea loses focus.
  const [rawCerts, setRawCerts] = useState(
    () => (skills.certifications || []).join('\n')
  );

  const onCertBlur = () => {
    const parsed = rawCerts
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    set('certifications')(parsed);
  };

  return (
    <div className="step-form">
      <h3>Skills</h3>
      <TagInput label="Technical Skills" values={skills.technical || []} onChange={set('technical')} max={30} />
      <TagInput label="Soft Skills" values={skills.soft || []} onChange={set('soft')} max={15} />
      <TagInput label="Languages" values={skills.languages || []} onChange={set('languages')} max={10} />

      <div className="form-group">
        <label>Certifications <small>(one per line)</small></label>
        <textarea
          rows={4}
          value={rawCerts}
          onChange={(e) => setRawCerts(e.target.value)}
          onBlur={onCertBlur}
          placeholder={"AWS Certified Solutions Architect\nGoogle Professional Data Engineer"}
        />
        <small>{rawCerts.split('\n').filter(Boolean).length} / 10 certifications</small>
      </div>
    </div>
  );
}
