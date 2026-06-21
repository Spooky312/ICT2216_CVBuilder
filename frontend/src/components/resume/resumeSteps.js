export const RESUME_STEPS = [
  { id: 'template', label: 'Template' },
  { id: 'personal', label: 'Personal' },
  { id: 'education', label: 'Education' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
];

export function stepIndex(stepId) {
  const index = RESUME_STEPS.findIndex((step) => step.id === stepId);
  return index < 0 ? 0 : index;
}
