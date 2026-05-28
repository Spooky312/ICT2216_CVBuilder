import React from 'react';

const STEPS = ['Personal', 'Education', 'Experience', 'Projects', 'Skills', 'Template'];

export default function WizardSteps({ current }) {
  return (
    <div className="wizard-steps">
      {STEPS.map((label, i) => (
        <div
          key={label}
          className={`wizard-step ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}`}
        >
          <div className="step-circle">{i < current ? '✓' : i + 1}</div>
          <span className="step-label">{label}</span>
          {i < STEPS.length - 1 && <div className="step-connector" />}
        </div>
      ))}
    </div>
  );
}
