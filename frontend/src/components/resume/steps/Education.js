import EntryCard from '../EntryCard';
import FieldError, { errorProps } from '../../common/FieldError';
import MonthYearPicker from '../MonthYearPicker';

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
        <p className="text-muted empty-hint">No education entries yet. Click &quot;Add Entry&quot; to begin.</p>
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
              <label htmlFor={`education-${i}-gpa`}>Grade</label>
              <input id={`education-${i}-gpa`} value={edu.gpa} onChange={(e) => update(i, 'gpa', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.gpa`)} maxLength={20}
                {...errorProps(errors, `${i}.gpa`, `education-${i}-gpa`)} />
              <FieldError errors={errors} name={`${i}.gpa`} inputId={`education-${i}-gpa`} />
            </div>
          </div>
          <div className="form-row">
            <MonthYearPicker id={`education-${i}-start`} label="Start Date" value={edu.start_date}
              onChange={(value) => update(i, 'start_date', value)}
              onBlur={() => window.requestAnimationFrame(() => onFieldBlur(`${i}.start_date`))}
              errors={errors} errorName={`${i}.start_date`} />
            <MonthYearPicker id={`education-${i}-end`} label="End Date" value={edu.end_date}
              onChange={(value) => update(i, 'end_date', value)}
              onBlur={() => window.requestAnimationFrame(() => onFieldBlur(`${i}.end_date`))}
              allowPresent presentLabel="Currently studying here"
              errors={errors} errorName={`${i}.end_date`} />
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
