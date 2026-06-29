import { RESUME_STEPS } from '../components/resume/resumeSteps';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+\-()]{7,20}$/;
const DATE_RE = /^\d{4}(-\d{2})?$/;
const END_DATE_RE = /^(\d{4}(-\d{2})?|Present)$/;

function add(errors, field, message) {
  if (message) errors[field] = message;
}

function text(value) {
  return String(value || '').trim();
}

function required(value, label) {
  return text(value) ? '' : `${label} is required.`;
}

function maxLength(value, max, label) {
  return text(value).length > max ? `${label} must be ${max} characters or fewer.` : '';
}

function normaliseWebUrl(value) {
  const clean = text(value);
  if (!clean) return '';
  if (/\s/.test(clean)) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(clean) && !/^https?:\/\//i.test(clean)) return null;

  const candidate = /^https?:\/\//i.test(clean)
    ? clean
    : (clean.startsWith('//') ? `https:${clean}` : `https://${clean}`);
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    const labels = parsed.hostname.replace(/\.$/, '').split('.');
    if (labels.length < 2 || labels.some((label) => !label || label.length > 63
      || label.startsWith('-') || label.endsWith('-') || !/^[a-z\d-]+$/i.test(label))) return null;
    return candidate;
  } catch {
    return null;
  }
}

function webUrlError(value, label) {
  const clean = text(value);
  if (!clean) return '';
  const normalised = normaliseWebUrl(clean);
  if (!normalised) return 'Enter a valid web address, such as example.com.';
  return normalised.length > 255 ? `${label} must be 255 characters or fewer.` : '';
}

function dateError(value, allowPresent = false) {
  const clean = text(value);
  if (!clean) return '';
  const pattern = allowPresent ? END_DATE_RE : DATE_RE;
  if (!pattern.test(clean)) return allowPresent
    ? 'Use YYYY, YYYY-MM, or Present.'
    : 'Use YYYY or YYYY-MM.';
  if (clean === 'Present') return '';
  const month = clean.split('-')[1];
  return month && (Number(month) < 1 || Number(month) > 12)
    ? 'Month must be between 01 and 12.'
    : '';
}

function dateKey(value, isEnd = false) {
  if (value === 'Present') return null;
  const [year, month] = value.split('-').map(Number);
  return [year, month || (isEnd ? 12 : 1)];
}

function dateOrderError(start, end) {
  if (!text(start) || !text(end) || end === 'Present' || dateError(start) || dateError(end, true)) return '';
  const startKey = dateKey(start);
  const endKey = dateKey(end, true);
  return endKey[0] < startKey[0] || (endKey[0] === startKey[0] && endKey[1] < startKey[1])
    ? 'End date must not be before start date.'
    : '';
}

function validatePersonal(personal = {}) {
  const errors = {};
  add(errors, 'full_name', required(personal.full_name, 'Full name') || maxLength(personal.full_name, 100, 'Full name'));
  add(errors, 'email', required(personal.email, 'Email'));
  if (text(personal.email) && !EMAIL_RE.test(text(personal.email))) add(errors, 'email', 'Enter a valid email address.');
  if (text(personal.phone) && !/^\+\d{1,4}\s/.test(text(personal.phone))) {
    add(errors, 'phone', 'Enter a country code beginning with +, such as +65.');
  } else if (text(personal.phone) && !PHONE_RE.test(text(personal.phone))) {
    add(errors, 'phone', 'Use 7–20 digits and common phone symbols only.');
  }
  add(errors, 'location', maxLength(personal.location, 100, 'Location'));
  ['linkedin', 'portfolio'].forEach((field) => {
    add(errors, field, webUrlError(personal[field], field === 'linkedin' ? 'LinkedIn URL' : 'Portfolio URL'));
  });
  add(errors, 'summary', maxLength(personal.summary, 500, 'Summary'));
  return errors;
}

function validateDatedEntry(errors, entry, index) {
  add(errors, `${index}.start_date`, dateError(entry.start_date));
  add(errors, `${index}.end_date`, dateError(entry.end_date, true)
    || dateOrderError(text(entry.start_date), text(entry.end_date)));
}

function validateEducation(entries = []) {
  const errors = {};
  if (entries.length > 20) add(errors, '_entries', 'Add no more than 20 education entries.');
  entries.forEach((entry, index) => {
    add(errors, `${index}.institution`, required(entry.institution, 'Institution')
      || maxLength(entry.institution, 200, 'Institution'));
    add(errors, `${index}.degree`, required(entry.degree, 'Degree') || maxLength(entry.degree, 200, 'Degree'));
    add(errors, `${index}.field_of_study`, maxLength(entry.field_of_study, 200, 'Field of study'));
    add(errors, `${index}.gpa`, maxLength(entry.gpa, 20, 'Grade'));
    add(errors, `${index}.description`, maxLength(entry.description, 500, 'Description'));
    validateDatedEntry(errors, entry, index);
  });
  return errors;
}

function validateExperience(entries = []) {
  const errors = {};
  if (entries.length > 20) add(errors, '_entries', 'Add no more than 20 experience entries.');
  entries.forEach((entry, index) => {
    add(errors, `${index}.position`, required(entry.position, 'Position') || maxLength(entry.position, 200, 'Position'));
    add(errors, `${index}.company`, required(entry.company, 'Company') || maxLength(entry.company, 200, 'Company'));
    add(errors, `${index}.location`, maxLength(entry.location, 100, 'Location'));
    add(errors, `${index}.description`, maxLength(entry.description, 500, 'Description'));
    if ((entry.achievements || []).length > 10) add(errors, `${index}.achievements`, 'Add no more than 10 achievements.');
    (entry.achievements || []).forEach((item, itemIndex) => {
      add(errors, `${index}.achievement.${itemIndex}`, maxLength(item, 500, 'Achievement'));
    });
    validateDatedEntry(errors, entry, index);
  });
  return errors;
}

function validateProjects(entries = []) {
  const errors = {};
  if (entries.length > 20) add(errors, '_entries', 'Add no more than 20 projects.');
  entries.forEach((entry, index) => {
    add(errors, `${index}.name`, required(entry.name, 'Project name') || maxLength(entry.name, 200, 'Project name'));
    add(errors, `${index}.description`, maxLength(entry.description, 500, 'Description'));
    add(errors, `${index}.url`, webUrlError(entry.url, 'Project URL'));
    if ((entry.technologies || []).length > 15) add(errors, `${index}.technologies`, 'Add no more than 15 technologies.');
    (entry.technologies || []).forEach((item) => {
      if (text(item).length > 50) add(errors, `${index}.technologies`, 'Each technology must be 50 characters or fewer.');
    });
    validateDatedEntry(errors, entry, index);
  });
  return errors;
}

function validateSkills(skills = {}) {
  const errors = {};
  const rules = {
    technical: [30, 50, 'technical skills'],
    soft: [15, 50, 'soft skills'],
    languages: [10, 50, 'languages'],
    certifications: [10, 200, 'certifications'],
  };
  Object.entries(rules).forEach(([field, [maxItems, maxChars, label]]) => {
    const values = skills[field] || [];
    if (values.length > maxItems) add(errors, field, `Add no more than ${maxItems} ${label}.`);
    if (values.some((value) => text(value).length > maxChars)) {
      add(errors, field, `Each entry must be ${maxChars} characters or fewer.`);
    }
  });
  return errors;
}

export function validateResumeStep(stepId, content, templateId) {
  switch (stepId) {
    case 'template': return text(templateId)
      ? {} : { template_id: 'Choose an available template.' };
    case 'personal': return validatePersonal(content.personal_info);
    case 'education': return validateEducation(content.education);
    case 'experience': return validateExperience(content.experience);
    case 'projects': return validateProjects(content.projects);
    case 'skills': return validateSkills(content.skills);
    default: return {};
  }
}

export function validateResume(content, templateId, title) {
  const errors = {};
  RESUME_STEPS.forEach(({ id }) => {
    const stepErrors = validateResumeStep(id, content, templateId);
    if (Object.keys(stepErrors).length) errors[id] = stepErrors;
  });
  if (!text(title)) errors.title = 'Resume title is required.';
  else if (text(title).length > 100) errors.title = 'Resume title must be 100 characters or fewer.';
  return errors;
}

export function firstInvalidStep(errors) {
  return RESUME_STEPS.find(({ id }) => errors[id])?.id || RESUME_STEPS[0].id;
}
