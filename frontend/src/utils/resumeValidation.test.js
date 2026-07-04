import { describe, it, expect } from 'vitest';
import {
  validateResumeStep,
  validateResume,
  firstInvalidStep,
} from './resumeValidation';

describe('validateResumeStep - template', () => {
  it('requires a template selection', () => {
    expect(validateResumeStep('template', {}, '')).toEqual({
      template_id: 'Choose an available template.',
    });
    expect(validateResumeStep('template', {}, 'modern')).toEqual({});
  });
});

describe('validateResumeStep - personal', () => {
  const personal = (over) => ({ personal_info: { full_name: 'A', email: 'a@b.co', ...over } });

  it('requires full name and email', () => {
    const errors = validateResumeStep('personal', { personal_info: {} }, 'm');
    expect(errors.full_name).toMatch(/required/);
    expect(errors.email).toMatch(/required/);
  });

  it('rejects malformed email shapes', () => {
    expect(validateResumeStep('personal', personal({ email: 'no-at' }), 'm').email)
      .toMatch(/valid email/);
    expect(validateResumeStep('personal', personal({ email: 'a@b@c.co' }), 'm').email)
      .toMatch(/valid email/);
    expect(validateResumeStep('personal', personal({ email: '@nolocal.co' }), 'm').email)
      .toMatch(/valid email/);
    expect(validateResumeStep('personal', personal({ email: 'a@singlelabel' }), 'm').email)
      .toMatch(/valid email/);
  });

  it('accepts a well-formed email', () => {
    expect(validateResumeStep('personal', personal({ email: 'jane.doe@example.com' }), 'm').email)
      .toBeUndefined();
  });

  it('requires a country code and valid phone characters', () => {
    expect(validateResumeStep('personal', personal({ phone: '12345678' }), 'm').phone)
      .toMatch(/country code/);
    expect(validateResumeStep('personal', personal({ phone: '+65 abc!' }), 'm').phone)
      .toMatch(/7.20 digits|phone symbols/);
    expect(validateResumeStep('personal', personal({ phone: '+65 9123 4567' }), 'm').phone)
      .toBeUndefined();
  });

  it('enforces max lengths', () => {
    const long = 'x'.repeat(101);
    expect(validateResumeStep('personal', personal({ full_name: long }), 'm').full_name)
      .toMatch(/100 characters/);
    expect(validateResumeStep('personal', personal({ location: long }), 'm').location)
      .toMatch(/100 characters/);
    expect(validateResumeStep('personal', personal({ summary: 'y'.repeat(501) }), 'm').summary)
      .toMatch(/500 characters/);
  });

  it('validates web URLs for linkedin and portfolio', () => {
    expect(validateResumeStep('personal', personal({ linkedin: 'has space' }), 'm').linkedin)
      .toMatch(/valid web address/);
    expect(validateResumeStep('personal', personal({ portfolio: 'ftp://x.com' }), 'm').portfolio)
      .toMatch(/valid web address/);
    expect(validateResumeStep('personal', personal({ portfolio: 'singlelabel' }), 'm').portfolio)
      .toMatch(/valid web address/);
    expect(validateResumeStep('personal', personal({ linkedin: 'example.com' }), 'm').linkedin)
      .toBeUndefined();
    expect(validateResumeStep('personal', personal({ linkedin: 'https://in.example.com/x' }), 'm').linkedin)
      .toBeUndefined();
  });

  it('rejects credentials and overly long hostnames in URLs', () => {
    expect(validateResumeStep('personal', personal({ portfolio: 'https://u:p@example.com' }), 'm').portfolio)
      .toMatch(/valid web address/);
    const longLabel = `https://${'a'.repeat(64)}.com`;
    expect(validateResumeStep('personal', personal({ portfolio: longLabel }), 'm').portfolio)
      .toMatch(/valid web address/);
  });

  it('flags URLs longer than 255 characters', () => {
    const longUrl = `https://example.com/${'a'.repeat(250)}`;
    expect(validateResumeStep('personal', personal({ portfolio: longUrl }), 'm').portfolio)
      .toMatch(/255 characters/);
  });
});

describe('validateResumeStep - education/experience/projects dates', () => {
  it('validates date formats and ordering', () => {
    const edu = {
      education: [{
        institution: 'Uni', degree: 'BSc',
        start_date: '2020-13', end_date: '2019',
      }],
    };
    const errors = validateResumeStep('education', edu, 'm');
    expect(errors['0.start_date']).toMatch(/Month must be between/);

    const ordered = {
      education: [{
        institution: 'Uni', degree: 'BSc',
        start_date: '2021', end_date: '2020',
      }],
    };
    expect(validateResumeStep('education', ordered, 'm')['0.end_date'])
      .toMatch(/must not be before/);
  });

  it('accepts Present as an end date', () => {
    const exp = {
      experience: [{
        position: 'Dev', company: 'Co',
        start_date: '2020-01', end_date: 'Present',
      }],
    };
    expect(validateResumeStep('experience', exp, 'm')['0.end_date']).toBeUndefined();
  });

  it('rejects invalid date syntax', () => {
    const proj = { projects: [{ name: 'P', start_date: 'abcd' }] };
    expect(validateResumeStep('projects', proj, 'm')['0.start_date']).toMatch(/Use YYYY/);
  });

  it('caps entry, achievement, and technology counts', () => {
    const manyEdu = { education: Array.from({ length: 21 }, () => ({ institution: 'U', degree: 'D' })) };
    expect(validateResumeStep('education', manyEdu, 'm')._entries).toMatch(/no more than 20/);

    const exp = {
      experience: [{
        position: 'Dev', company: 'Co',
        achievements: Array.from({ length: 11 }, () => 'x'),
      }],
    };
    expect(validateResumeStep('experience', exp, 'm')['0.achievements']).toMatch(/no more than 10/);

    const proj = {
      projects: [{ name: 'P', technologies: [`${'z'.repeat(51)}`] }],
    };
    expect(validateResumeStep('projects', proj, 'm')['0.technologies']).toMatch(/50 characters/);
  });
});

describe('validateResumeStep - skills', () => {
  it('caps item counts and lengths', () => {
    const skills = {
      skills: {
        technical: Array.from({ length: 31 }, () => 'x'),
        certifications: ['y'.repeat(201)],
      },
    };
    const errors = validateResumeStep('skills', skills, 'm');
    expect(errors.technical).toMatch(/no more than 30/);
    expect(errors.certifications).toMatch(/200 characters/);
  });

  it('passes for valid skills and unknown steps', () => {
    expect(validateResumeStep('skills', { skills: { technical: ['React'] } }, 'm')).toEqual({});
    expect(validateResumeStep('unknown-step', {}, 'm')).toEqual({});
  });
});

describe('validateResume + firstInvalidStep', () => {
  const validContent = {
    personal_info: { full_name: 'Jane', email: 'jane@example.com' },
    education: [],
    experience: [],
    projects: [],
    skills: {},
  };

  it('returns no errors for valid content', () => {
    expect(validateResume(validContent, 'modern', 'My Resume')).toEqual({});
  });

  it('requires a title within 100 characters', () => {
    expect(validateResume(validContent, 'modern', '').title).toMatch(/required/);
    expect(validateResume(validContent, 'modern', 't'.repeat(101)).title).toMatch(/100 characters/);
  });

  it('aggregates step errors and reports the first invalid step', () => {
    const errors = validateResume(
      { ...validContent, personal_info: {} },
      '',
      'Title',
    );
    expect(errors.template).toBeDefined();
    expect(errors.personal).toBeDefined();
    expect(firstInvalidStep(errors)).toBe('template');
  });

  it('firstInvalidStep falls back to the first step when clean', () => {
    expect(firstInvalidStep({})).toBe('template');
  });
});
