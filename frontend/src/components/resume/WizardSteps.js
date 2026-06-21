import React from 'react';
import { RESUME_STEPS } from './resumeSteps';

export default function WizardSteps({ current }) {
  return (
    <div className="wizard-steps" aria-label="Resume creation progress">
      {RESUME_STEPS.map(({ id, label }, i) => (
        <div
          key={id}
          className={`wizard-step ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}`}
          aria-current={i === current ? 'step' : undefined}
        >
          <div className="step-circle">{i < current ? '✓' : i + 1}</div>
          <span className="step-label">{label}</span>
          {i < RESUME_STEPS.length - 1 && <div className="step-connector" />}
        </div>
      ))}
    </div>
  );
}
