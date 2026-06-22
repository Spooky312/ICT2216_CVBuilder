import EntryCard from '../EntryCard';
import FieldError, { errorProps } from '../../common/FieldError';
import MonthYearPicker from '../MonthYearPicker';

const BLANK = { company: '', position: '', location: '', start_date: '', end_date: '', description: '', achievements: [] };

export default function Experience({ data, onChange, errors = {}, onFieldBlur }) {
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
        <p className="text-muted empty-hint">No experience entries yet. Click &quot;Add Entry&quot; to begin.</p>
      )}

      {items.map((exp, i) => (
        <EntryCard key={i} index={i} onRemove={() => remove(i)}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor={`experience-${i}-position`}>Position *</label>
              <input id={`experience-${i}-position`} value={exp.position}
                onChange={(e) => update(i, 'position', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.position`)} maxLength={200}
                {...errorProps(errors, `${i}.position`, `experience-${i}-position`)} />
              <FieldError errors={errors} name={`${i}.position`} inputId={`experience-${i}-position`} />
            </div>
            <div className="form-group">
              <label htmlFor={`experience-${i}-company`}>Company *</label>
              <input id={`experience-${i}-company`} value={exp.company}
                onChange={(e) => update(i, 'company', e.target.value)}
                onBlur={() => onFieldBlur(`${i}.company`)} maxLength={200}
                {...errorProps(errors, `${i}.company`, `experience-${i}-company`)} />
              <FieldError errors={errors} name={`${i}.company`} inputId={`experience-${i}-company`} />
            </div>
          </div>
          <div className="form-group">
            <label>Location</label>
            <input value={exp.location} onChange={(e) => update(i, 'location', e.target.value)} maxLength={100} />
          </div>
          <div className="form-row">
            <MonthYearPicker id={`experience-${i}-start`} label="Start Date" value={exp.start_date}
              onChange={(value) => update(i, 'start_date', value)}
              onBlur={() => window.requestAnimationFrame(() => onFieldBlur(`${i}.start_date`))}
              errors={errors} errorName={`${i}.start_date`} />
            <MonthYearPicker id={`experience-${i}-end`} label="End Date" value={exp.end_date}
              onChange={(value) => update(i, 'end_date', value)}
              onBlur={() => window.requestAnimationFrame(() => onFieldBlur(`${i}.end_date`))}
              allowPresent presentLabel="Currently working here"
              errors={errors} errorName={`${i}.end_date`} />
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
                <input value={ach} onChange={(e) => updateAchievement(i, ai, e.target.value)}
                  onBlur={() => onFieldBlur(`${i}.achievement.${ai}`)} maxLength={500}
                  placeholder="Quantified achievement…" aria-label={`Achievement ${ai + 1}`} />
                <button type="button" className="btn-danger-sm" onClick={() => removeAchievement(i, ai)}>×</button>
              </div>
            ))}
          </div>
        </EntryCard>
      ))}
    </div>
  );
}
