const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+\-()]{7,20}$/;
const URL_RE = /^https?:\/\/.+\..+/i;
const DATE_RE = /^\d{4}(-\d{2})?$/;
const END_DATE_RE = /^(\d{4}(-\d{2})?|Present)$/;
const GPA_RE = /^\d(\.\d{1,2})?(\/\d(\.\d)?)?$/;

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
    add(errors, field, maxLength(personal[field], 255, field === 'linkedin' ? 'LinkedIn URL' : 'Portfolio URL'));
    if (text(personal[field]) && !URL_RE.test(text(personal[field]))) {
      add(errors, field, 'Enter a complete URL beginning with http:// or https://.');
    }
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
    add(errors, `${index}.gpa`, text(entry.gpa) && !GPA_RE.test(text(entry.gpa))
      ? 'Use a value such as 3.8 or 3.8/4.0.' : '');
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
    add(errors, `${index}.url`, maxLength(entry.url, 255, 'Project URL'));
    if (text(entry.url) && !URL_RE.test(text(entry.url))) {
      add(errors, `${index}.url`, 'Enter a complete URL beginning with http:// or https://.');
    }
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

export function validateResumeStep(step, content, templateId) {
  switch (step) {
    case 0: return validatePersonal(content.personal_info);
    case 1: return validateEducation(content.education);
    case 2: return validateExperience(content.experience);
    case 3: return validateProjects(content.projects);
    case 4: return validateSkills(content.skills);
    case 5: return ['modern', 'classic', 'minimal'].includes(templateId)
      ? {} : { template_id: 'Choose an available template.' };
    default: return {};
  }
}

export function validateResume(content, templateId, title) {
  const errors = {};
  for (let step = 0; step < 6; step += 1) {
    const stepErrors = validateResumeStep(step, content, templateId);
    if (Object.keys(stepErrors).length) errors[step] = stepErrors;
  }
  if (!text(title)) errors.title = 'Resume title is required.';
  else if (text(title).length > 100) errors.title = 'Resume title must be 100 characters or fewer.';
  return errors;
}

export function firstInvalidStep(errors) {
  return Object.keys(errors).map(Number).filter(Number.isInteger).sort((a, b) => a - b)[0] ?? 0;
}
