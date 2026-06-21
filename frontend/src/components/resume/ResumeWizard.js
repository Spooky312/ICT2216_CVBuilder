import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WizardSteps from './WizardSteps';
import PersonalInfo from './steps/PersonalInfo';
import Education from './steps/Education';
import Experience from './steps/Experience';
import Projects from './steps/Projects';
import Skills from './steps/Skills';
import TemplateSelect from './steps/TemplateSelect';
import { createResume, updateResume, getResume } from '../../services/api';
import Spinner from '../common/Spinner';
import {
  firstInvalidStep, validateResume, validateResumeStep,
} from '../../utils/resumeValidation';

const TOTAL_STEPS = 6;

// Recursively collect all leaf error strings from a nested Marshmallow error object.
// e.g. { content_json: { projects: { 0: { url: ["URL must start with..."] } } } }
// → ["Projects entry 1 → url: URL must start with http:// or https://"]
function flattenErrors(obj, path = []) {
  if (Array.isArray(obj)) return obj.map((msg) => `${path.join(' → ')}: ${msg}`);
  if (typeof obj === 'string') return [`${path.join(' → ')}: ${obj}`];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([key, val]) => {
      // Make numeric keys (array indices) human-friendly: "0" → "entry 1"
      const label = /^\d+$/.test(key) ? `entry ${parseInt(key, 10) + 1}` : key.replace(/_/g, ' ');
      return flattenErrors(val, [...path, label]);
    });
  }
  return [];
}

const EMPTY_CONTENT = {
  personal_info: { full_name: '', email: '', phone: '', location: '', linkedin: '', portfolio: '', summary: '' },
  education: [],
  experience: [],
  projects: [],
  skills: { technical: [], soft: [], languages: [], certifications: [] },
};

export default function ResumeWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('My Resume');
  const [templateId, setTemplateId] = useState('modern');
  const [content, setContent] = useState(EMPTY_CONTENT);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stepErrors, setStepErrors] = useState({});
  const [titleError, setTitleError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    getResume(id)
      .then((res) => {
        const r = res.data;
        setTitle(r.title);
        setTemplateId(r.template_id);
        setContent(r.content_json || EMPTY_CONTENT);
      })
      .catch(() => setError('Failed to load resume.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const setSection = (key) => (val) => {
    const nextContent = { ...content, [key]: val };
    setContent(nextContent);
    const currentErrors = validateResumeStep(step, nextContent, templateId);
    setStepErrors((visibleErrors) => Object.keys(visibleErrors).reduce((next, field) => {
      if (currentErrors[field]) next[field] = currentErrors[field];
      return next;
    }, {}));
    setError('');
  };

  const validateField = (field) => {
    const currentErrors = validateResumeStep(step, content, templateId);
    setStepErrors((visibleErrors) => {
      const next = { ...visibleErrors };
      if (currentErrors[field]) next[field] = currentErrors[field];
      else delete next[field];
      return next;
    });
  };

  const steps = [
    <PersonalInfo data={content.personal_info} onChange={setSection('personal_info')}
      errors={stepErrors} onFieldBlur={validateField} />,
    <Education data={content.education} onChange={setSection('education')}
      errors={stepErrors} onFieldBlur={validateField} />,
    <Experience data={content.experience} onChange={setSection('experience')}
      errors={stepErrors} onFieldBlur={validateField} />,
    <Projects data={content.projects} onChange={setSection('projects')}
      errors={stepErrors} onFieldBlur={validateField} />,
    <Skills data={content.skills} onChange={setSection('skills')}
      errors={stepErrors} onFieldBlur={validateField} />,
    <TemplateSelect selected={templateId} onChange={(value) => {
      setTemplateId(value);
      setStepErrors({});
    }} errors={stepErrors} />,
  ];

  const handleNext = () => {
    const currentErrors = validateResumeStep(step, content, templateId);
    setStepErrors(currentErrors);
    if (Object.keys(currentErrors).length) {
      setError('Check the highlighted fields before continuing.');
      window.requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setError('');
    setStep((current) => current + 1);
  };

  const handleSave = async () => {
    const allErrors = validateResume(content, templateId, title);
    if (Object.keys(allErrors).length) {
      const invalidStep = firstInvalidStep(allErrors);
      setStep(invalidStep);
      setStepErrors(allErrors[invalidStep] || {});
      setTitleError(allErrors.title || '');
      setError('Check the highlighted fields before saving your resume.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { title, template_id: templateId, content_json: content };
      if (isEdit) await updateResume(id, payload);
      else await createResume(payload);
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setError(flattenErrors(data.errors).join(' • ') || 'Validation failed.');
      } else {
        setError(data?.message || 'Failed to save resume.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="center-page"><Spinner size={40} /></div>;

  return (
    <div className="wizard-container">
      <div className="wizard-header">
        <div className="form-group wizard-title-group">
          <label htmlFor="resume-title">Resume Title</label>
          <input id="resume-title" value={title} onChange={(e) => {
            setTitle(e.target.value);
            setTitleError('');
          }} onBlur={() => {
            const message = !title.trim() ? 'Resume title is required.' : '';
            setTitleError(message);
          }} maxLength={100} className="wizard-title-input"
            aria-invalid={Boolean(titleError)} aria-describedby={titleError ? 'resume-title-error' : undefined} />
          {titleError && <small id="resume-title-error" className="field-error">{titleError}</small>}
        </div>
      </div>

      <WizardSteps current={step} />

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="wizard-body">{steps[step]}</div>

      <div className="wizard-nav">
        <button
          className="btn-secondary"
          onClick={() => {
            setStepErrors({});
            setError('');
            setStep((s) => s - 1);
          }}
          disabled={step === 0}
        >
          Back
        </button>

        <span className="step-counter">{step + 1} / {TOTAL_STEPS}</span>

        {step < TOTAL_STEPS - 1 ? (
          <button className="btn-primary" onClick={handleNext}>
            Next
          </button>
        ) : (
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner size={16} /> Saving…</> : (isEdit ? 'Update Resume' : 'Create Resume')}
          </button>
        )}
      </div>
    </div>
  );
}
