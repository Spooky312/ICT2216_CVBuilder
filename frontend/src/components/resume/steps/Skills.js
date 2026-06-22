import { useState } from 'react';
import FieldError from '../../common/FieldError';

function TagInput({ id, label, values, onChange, max = 30, error, onBlur }) {
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
      <label htmlFor={id}>{label}</label>
      <div className="tag-input-row">
        <input id={id} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
          onBlur={onBlur}
          maxLength={50} placeholder="Type and press Enter or comma" />
        <button type="button" className="btn-secondary-sm" onClick={add}
          disabled={values.length >= max}>Add</button>
      </div>
      {error && <small id={`${id}-error`} className="field-error">{error}</small>}
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

export default function Skills({ data, onChange, errors = {}, onFieldBlur }) {
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
      <TagInput id="skills-technical" label="Technical Skills" values={skills.technical || []}
        onChange={set('technical')} max={30} error={errors.technical}
        onBlur={() => onFieldBlur('technical')} />
      <TagInput id="skills-soft" label="Soft Skills" values={skills.soft || []}
        onChange={set('soft')} max={15} error={errors.soft}
        onBlur={() => onFieldBlur('soft')} />
      <TagInput id="skills-languages" label="Languages" values={skills.languages || []}
        onChange={set('languages')} max={10} error={errors.languages}
        onBlur={() => onFieldBlur('languages')} />

      <div className="form-group">
        <label htmlFor="skills-certifications">Certifications <small>(one per line)</small></label>
        <textarea
          id="skills-certifications"
          rows={4}
          value={rawCerts}
          onChange={(e) => setRawCerts(e.target.value)}
          onBlur={() => {
            onCertBlur();
            window.requestAnimationFrame(() => onFieldBlur('certifications'));
          }}
          placeholder={"AWS Certified Solutions Architect\nGoogle Professional Data Engineer"}
        />
        <FieldError errors={errors} name="certifications" inputId="skills-certifications" />
        <small>{rawCerts.split('\n').filter(Boolean).length} / 10 certifications</small>
      </div>
    </div>
  );
}
