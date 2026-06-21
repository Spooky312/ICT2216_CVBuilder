import React, { useEffect, useRef, useState } from 'react';
import FieldError, { errorProps } from '../common/FieldError';

const MONTHS = [
  ['01', 'Jan'], ['02', 'Feb'], ['03', 'Mar'], ['04', 'Apr'],
  ['05', 'May'], ['06', 'Jun'], ['07', 'Jul'], ['08', 'Aug'],
  ['09', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dec'],
];

function parseDate(value) {
  const match = String(value || '').match(/^(\d{4})(?:-(\d{2}))?$/);
  return {
    year: match ? Number(match[1]) : new Date().getFullYear(),
    month: match?.[2] || '',
  };
}

function displayDate(value, placeholder) {
  if (value === 'Present') return 'Present';
  const parsed = parseDate(value);
  if (!value) return placeholder;
  const month = MONTHS.find(([number]) => number === parsed.month)?.[1];
  return month ? `${month}, ${parsed.year}` : String(parsed.year);
}

export default function MonthYearPicker({
  id, label, value, onChange, onBlur, allowPresent = false,
  presentLabel = 'Currently here', errors, errorName,
}) {
  const parsed = parseDate(value);
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(parsed.year);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const isPresent = value === 'Present';

  useEffect(() => {
    if (value !== 'Present') setVisibleYear(parseDate(value).year);
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        onBlur?.();
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onBlur]);

  const finishSelection = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    onBlur?.();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div className="form-group month-year-field" ref={containerRef}>
      <label id={`${id}-label`} htmlFor={id}>{label}</label>
      <button id={id} ref={triggerRef} type="button" className="month-year-trigger"
        onClick={() => setOpen((current) => !current)} aria-haspopup="dialog"
        aria-expanded={open} aria-labelledby={`${id}-label ${id}`}
        {...errorProps(errors, errorName, id)}>
        <span className={value ? '' : 'placeholder'}>{displayDate(value, `Select ${label.toLowerCase()}`)}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="month-year-popover" role="dialog" aria-label={`Choose ${label.toLowerCase()}`}>
          <div className="month-year-heading">
            <button type="button" onClick={() => setVisibleYear((year) => year - 1)}
              aria-label="Previous year">‹</button>
            <strong>{visibleYear}</strong>
            <button type="button" onClick={() => setVisibleYear((year) => year + 1)}
              aria-label="Next year">›</button>
          </div>
          <div className="month-grid">
            {MONTHS.map(([number, name]) => {
              const selected = !isPresent && parsed.year === visibleYear && parsed.month === number;
              return (
                <button key={number} type="button" className={selected ? 'selected' : ''}
                  aria-pressed={selected}
                  onClick={() => finishSelection(`${visibleYear}-${number}`)}>
                  {name}
                </button>
              );
            })}
          </div>
          <div className="month-year-actions">
            {allowPresent && (
              <button type="button" role="switch" aria-checked={isPresent}
                className="present-toggle" onClick={() => {
                  if (isPresent) onChange('');
                  else finishSelection('Present');
                }}>
                <span className="toggle-track" aria-hidden="true"><i /></span>
                {presentLabel}
              </button>
            )}
            {value && !isPresent && (
              <button type="button" className="clear-date" onClick={() => finishSelection('')}>Clear date</button>
            )}
          </div>
        </div>
      )}
      <FieldError errors={errors} name={errorName} inputId={id} />
    </div>
  );
}
