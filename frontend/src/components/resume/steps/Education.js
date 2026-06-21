import React from 'react';
import EntryCard from '../EntryCard';
import FieldError, { errorProps } from '../../common/FieldError';

const BLANK = { institution: '', degree: '', field_of_study: '', start_date: '', end_date: '', gpa: '', description: '' };

export default function Education({ data, onChange, errors = {}, onFieldBlur }) {
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
          disabled={items.length >= 20}>+ Add Entry</button>
      </div>

      {items.length === 0 && (
        <p className="text-muted empty-hint">No education entries yet. Click "Add Entry" to begin.</p>
      )}

      {items.map((edu, i) => (
        <EntryCard key={i} index={i} onRemove={() => remove(i)}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor={`education-${i}-institution`}>Institution *</label>
              <input id={`education-${i}-institution`} value={edu.institution}
                onChange={(e) => update(i, 'institution', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.institution`)} maxLength={200}
                {...errorProps(errors, `${i}.institution`, `education-${i}-institution`)} />
              <FieldError errors={errors} name={`${i}.institution`} inputId={`education-${i}-institution`} />
            </div>
            <div className="form-group">
              <label htmlFor={`education-${i}-degree`}>Degree *</label>
              <input id={`education-${i}-degree`} value={edu.degree}
                onChange={(e) => update(i, 'degree', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.degree`)} maxLength={200}
                {...errorProps(errors, `${i}.degree`, `education-${i}-degree`)} />
              <FieldError errors={errors} name={`${i}.degree`} inputId={`education-${i}-degree`} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Field of Study</label>
              <input value={edu.field_of_study} onChange={(e) => update(i, 'field_of_study', e.target.value)} maxLength={200} />
            </div>
            <div className="form-group">
              <label htmlFor={`education-${i}-gpa`}>GPA</label>
              <input id={`education-${i}-gpa`} value={edu.gpa} onChange={(e) => update(i, 'gpa', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.gpa`)} maxLength={10} inputMode="decimal"
                placeholder="3.8 or 3.8/4.0" {...errorProps(errors, `${i}.gpa`, `education-${i}-gpa`)} />
              <FieldError errors={errors} name={`${i}.gpa`} inputId={`education-${i}-gpa`} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor={`education-${i}-start`}>Start Date</label>
              <input id={`education-${i}-start`} value={edu.start_date}
                onChange={(e) => update(i, 'start_date', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.start_date`)} placeholder="2020 or 2020-09" maxLength={7}
                {...errorProps(errors, `${i}.start_date`, `education-${i}-start`)} />
              <FieldError errors={errors} name={`${i}.start_date`} inputId={`education-${i}-start`} />
            </div>
            <div className="form-group">
              <label htmlFor={`education-${i}-end`}>End Date</label>
              <input id={`education-${i}-end`} value={edu.end_date}
                onChange={(e) => update(i, 'end_date', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.end_date`)} placeholder="2024 or Present" maxLength={7}
                {...errorProps(errors, `${i}.end_date`, `education-${i}-end`)} />
              <FieldError errors={errors} name={`${i}.end_date`} inputId={`education-${i}-end`} />
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
