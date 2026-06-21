import React from 'react';
import FieldError, { errorProps } from '../../common/FieldError';
import PhoneInput from '../PhoneInput';

export default function PersonalInfo({ data, onChange, errors = {}, onFieldBlur }) {
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });

  return (
    <div className="step-form">
      <h3>Personal Information</h3>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="personal-full-name">Full Name *</label>
          <input id="personal-full-name" value={data.full_name || ''} onChange={set('full_name')}
            onBlur={() => onFieldBlur('full_name')} maxLength={100}
            {...errorProps(errors, 'full_name', 'personal-full-name')} />
          <FieldError errors={errors} name="full_name" inputId="personal-full-name" />
        </div>
        <div className="form-group">
          <label htmlFor="personal-email">Email *</label>
          <input id="personal-email" type="email" value={data.email || ''} onChange={set('email')}
            onBlur={() => onFieldBlur('email')} maxLength={255} placeholder="name@example.com"
            {...errorProps(errors, 'email', 'personal-email')} />
          <FieldError errors={errors} name="email" inputId="personal-email" />
        </div>
      </div>
      <div className="form-row">
        <PhoneInput value={data.phone || ''}
          onChange={(phone) => onChange({ ...data, phone })}
          onBlur={() => onFieldBlur('phone')} errors={errors} />
        <div className="form-group phone-location-group">
          <label htmlFor="personal-location">Location</label>
          <input id="personal-location" value={data.location || ''} onChange={set('location')}
            onBlur={() => onFieldBlur('location')} maxLength={100}
            placeholder="City, Country" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="personal-linkedin">LinkedIn URL</label>
          <input id="personal-linkedin" type="url" value={data.linkedin || ''} onChange={set('linkedin')}
            onBlur={() => onFieldBlur('linkedin')} maxLength={255}
            placeholder="linkedin.com/in/yourname"
            {...errorProps(errors, 'linkedin', 'personal-linkedin')} />
          <FieldError errors={errors} name="linkedin" inputId="personal-linkedin" />
        </div>
        <div className="form-group">
          <label htmlFor="personal-portfolio">Portfolio / Website</label>
          <input id="personal-portfolio" type="url" value={data.portfolio || ''} onChange={set('portfolio')}
            onBlur={() => onFieldBlur('portfolio')} maxLength={255} placeholder="yourwebsite.com"
            {...errorProps(errors, 'portfolio', 'personal-portfolio')} />
          <FieldError errors={errors} name="portfolio" inputId="personal-portfolio" />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="personal-summary">Professional Summary</label>
        <textarea id="personal-summary" rows={4} value={data.summary || ''} onChange={set('summary')}
          onBlur={() => onFieldBlur('summary')} maxLength={500}
          placeholder="Brief overview of your professional background and goals…" />
        <small>{(data.summary || '').length}/500</small>
      </div>
    </div>
  );
}
