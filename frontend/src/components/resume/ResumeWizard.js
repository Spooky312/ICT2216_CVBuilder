import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WizardSteps from './WizardSteps';
import ResumePreview from './ResumePreview';
import PersonalInfo from './steps/PersonalInfo';
import Education from './steps/Education';
import Experience from './steps/Experience';
import Projects from './steps/Projects';
import Skills from './steps/Skills';
import TemplateSelect from './steps/TemplateSelect';
import { RESUME_STEPS, stepIndex } from './resumeSteps';
import { TEMPLATE_DEMO_CONTENT } from './templateDemoContent';
import {
  createResume, getResume, previewResume, updateResume,
} from '../../services/api';
import Spinner from '../common/Spinner';
import {
  firstInvalidStep, validateResume, validateResumeStep,
} from '../../utils/resumeValidation';

const TOTAL_STEPS = RESUME_STEPS.length;

// Recursively collect all leaf error strings from a nested Marshmallow error object.
function flattenErrors(obj, path = []) {
  if (Array.isArray(obj)) return obj.map((msg) => `${path.join(' → ')}: ${msg}`);
  if (typeof obj === 'string') return [`${path.join(' → ')}: ${obj}`];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([key, val]) => {
      const label = /^\d+$/.test(key) ? `entry ${parseInt(key, 10) + 1}` : key.replace(/_/g, ' ');
      return flattenErrors(val, [...path, label]);
    });
  }
  return [];
}

async function previewErrorMessage(error) {
  let data = error.response?.data;
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch {
      data = null;
    }
  }
  if (data?.errors) return flattenErrors(data.errors).join(' • ') || 'Preview validation failed.';
  return data?.message || 'Could not generate the resume preview. Please try again.';
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
  const [previewOpen, setPreviewOpen] = useState(
    () => window.matchMedia('(min-width: 1051px)').matches,
  );
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewStale, setPreviewStale] = useState(false);
  const [previewPaused, setPreviewPaused] = useState(false);

  const previewUrlRef = useRef('');
  const previewButtonRef = useRef(null);
  const draftVersionRef = useRef(0);
  const previewRequestRef = useRef(0);
  const renderedVersionRef = useRef(-1);
  const renderingVersionRef = useRef(-1);

  const currentStep = RESUME_STEPS[step];

  useEffect(() => {
    if (!isEdit) return;
    getResume(id)
      .then((res) => {
        const resume = res.data;
        setTitle(resume.title);
        setTemplateId(resume.template_id);
        setContent(resume.content_json || EMPTY_CONTENT);
      })
      .catch(() => setError('Failed to load resume.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => () => {
    previewRequestRef.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const markPreviewStale = () => {
    draftVersionRef.current += 1;
    if (previewUrlRef.current) setPreviewStale(true);
  };

  const setSection = (key) => (value) => {
    const nextContent = { ...content, [key]: value };
    setContent(nextContent);
    markPreviewStale();
    const currentErrors = validateResumeStep(currentStep.id, nextContent, templateId);
    setStepErrors((visibleErrors) => Object.keys(visibleErrors).reduce((next, field) => {
      if (currentErrors[field]) next[field] = currentErrors[field];
      return next;
    }, {}));
    setError('');
  };

  const validateField = (field) => {
    const currentErrors = validateResumeStep(currentStep.id, content, templateId);
    setStepErrors((visibleErrors) => {
      const next = { ...visibleErrors };
      if (currentErrors[field]) next[field] = currentErrors[field];
      else delete next[field];
      return next;
    });
  };

  const focusFirstInvalid = () => {
    window.requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
  };

  const validateCurrentStep = () => {
    const currentErrors = validateResumeStep(currentStep.id, content, templateId);
    setStepErrors(currentErrors);
    if (!Object.keys(currentErrors).length) return true;
    setError('Check the highlighted fields before continuing.');
    focusFirstInvalid();
    return false;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep.id === 'template') discardPreviewDocument();
    setError('');
    setStep((current) => current + 1);
  };

  const renderPreview = useCallback(async () => {
    const requestedVersion = draftVersionRef.current;
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    renderingVersionRef.current = requestedVersion;
    setError('');
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const previewContent = currentStep.id === 'template' ? TEMPLATE_DEMO_CONTENT : content;
      const response = await previewResume({ template_id: templateId, content_json: previewContent });
      const nextUrl = URL.createObjectURL(response.data);
      if (requestId !== previewRequestRef.current) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = nextUrl;
      setPreviewUrl(nextUrl);
      renderedVersionRef.current = requestedVersion;
      setPreviewStale(draftVersionRef.current !== requestedVersion);
    } catch (previewFailure) {
      const message = await previewErrorMessage(previewFailure);
      if (requestId === previewRequestRef.current) setPreviewError(message);
    } finally {
      if (requestId === previewRequestRef.current) {
        renderingVersionRef.current = -1;
        setPreviewLoading(false);
      }
    }
  }, [content, currentStep.id, templateId]);

  useEffect(() => {
    if (!previewOpen || loading) return undefined;
    const currentErrors = validateResumeStep(currentStep.id, content, templateId);
    if (Object.keys(currentErrors).length) {
      setPreviewPaused(true);
      return undefined;
    }

    setPreviewPaused(false);
    const timer = window.setTimeout(() => {
      const version = draftVersionRef.current;
      if (renderedVersionRef.current === version || renderingVersionRef.current === version) return;
      renderPreview();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [content, currentStep.id, loading, previewOpen, renderPreview, templateId]);

  const handlePreview = () => {
    if (!validateCurrentStep()) return;
    setPreviewPaused(false);
    setPreviewOpen(true);
    renderPreview();
  };

  const discardPreviewDocument = () => {
    previewRequestRef.current += 1;
    renderingVersionRef.current = -1;
    renderedVersionRef.current = -1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setPreviewUrl('');
    setPreviewLoading(false);
    setPreviewError('');
    setPreviewStale(false);
    setPreviewPaused(false);
  };

  const handleClosePreview = () => {
    discardPreviewDocument();
    setPreviewOpen(false);
    window.requestAnimationFrame(() => previewButtonRef.current?.focus());
  };

  const handleSave = async () => {
    const allErrors = validateResume(content, templateId, title);
    if (Object.keys(allErrors).length) {
      const invalidStep = firstInvalidStep(allErrors);
      setStep(stepIndex(invalidStep));
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
    } catch (saveError) {
      const data = saveError.response?.data;
      if (data?.errors) setError(flattenErrors(data.errors).join(' • ') || 'Validation failed.');
      else setError(data?.message || 'Failed to save resume.');
    } finally {
      setSaving(false);
    }
  };

  const stepContent = {
    template: <TemplateSelect selected={templateId} onChange={(value) => {
      setTemplateId(value);
      setStepErrors({});
      setError('');
      markPreviewStale();
    }} errors={stepErrors} />,
    personal: <PersonalInfo data={content.personal_info} onChange={setSection('personal_info')}
      errors={stepErrors} onFieldBlur={validateField} />,
    education: <Education data={content.education} onChange={setSection('education')}
      errors={stepErrors} onFieldBlur={validateField} />,
    experience: <Experience data={content.experience} onChange={setSection('experience')}
      errors={stepErrors} onFieldBlur={validateField} />,
    projects: <Projects data={content.projects} onChange={setSection('projects')}
      errors={stepErrors} onFieldBlur={validateField} />,
    skills: <Skills data={content.skills} onChange={setSection('skills')}
      errors={stepErrors} onFieldBlur={validateField} />,
  };

  if (loading) return <div className="center-page"><Spinner size={40} /></div>;

  return (
    <div className={`wizard-container ${previewOpen ? 'preview-open' : ''}`}>
      <div className="wizard-toolbar">
        <div className="form-group wizard-title-group">
          <label htmlFor="resume-title">Resume Title</label>
          <input id="resume-title" value={title} onChange={(event) => {
            setTitle(event.target.value);
            setTitleError('');
          }} onBlur={() => {
            setTitleError(!title.trim() ? 'Resume title is required.' : '');
          }} maxLength={100} className="wizard-title-input"
            aria-invalid={Boolean(titleError)} aria-describedby={titleError ? 'resume-title-error' : undefined} />
          {titleError && <small id="resume-title-error" className="field-error">{titleError}</small>}
        </div>
      </div>

      <div className="wizard-workspace">
        <section className="wizard-editor" aria-label={`${currentStep.label} resume step`}>
          <WizardSteps current={step} />

          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <div className="wizard-body">{stepContent[currentStep.id]}</div>

          <div className="wizard-nav">
            <button className="btn-secondary" onClick={() => {
              if (currentStep.id === 'personal') discardPreviewDocument();
              setStepErrors({});
              setError('');
              setStep((current) => current - 1);
            }} disabled={step === 0}>
              Back
            </button>

            <span className="step-counter">{step + 1} / {TOTAL_STEPS}</span>

            <div className="wizard-nav-actions">
              {!previewOpen && (
                <button ref={previewButtonRef} type="button" className="btn-preview"
                  onClick={handlePreview}>Preview</button>
              )}
              {step < TOTAL_STEPS - 1 ? (
                <button className="btn-primary" onClick={handleNext}>Next</button>
              ) : (
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><Spinner size={16} /> Saving…</> : (isEdit ? 'Update Resume' : 'Create Resume')}
                </button>
              )}
            </div>
          </div>
        </section>

        {previewOpen && <ResumePreview url={previewUrl} loading={previewLoading}
          error={previewError} stale={previewStale} paused={previewPaused}
          onClose={handleClosePreview} />}
      </div>
    </div>
  );
}
