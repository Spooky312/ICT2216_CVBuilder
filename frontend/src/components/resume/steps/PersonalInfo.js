import React from 'react';

export default function PersonalInfo({ data, onChange }) {
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });

  return (
    <div className="step-form">
      <h3>Personal Information</h3>
      <div className="form-row">
        <div className="form-group">
          <label>Full Name *</label>
          <input value={data.full_name || ''} onChange={set('full_name')} maxLength={100} />
        </div>
        <div className="form-group">
          <label>Email *</label>
          <input type="email" value={data.email || ''} onChange={set('email')} maxLength={255} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Phone</label>
          <input value={data.phone || ''} onChange={set('phone')} maxLength={20} />
        </div>
        <div className="form-group">
          <label>Location</label>
          <input value={data.location || ''} onChange={set('location')} maxLength={100}
            placeholder="City, Country" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>LinkedIn URL</label>
          <input type="url" value={data.linkedin || ''} onChange={set('linkedin')} maxLength={255}
            placeholder="https://linkedin.com/in/yourname" />
        </div>
        <div className="form-group">
          <label>Portfolio / Website</label>
          <input type="url" value={data.portfolio || ''} onChange={set('portfolio')} maxLength={255}
            placeholder="https://yourwebsite.com" />
        </div>
      </div>
      <div className="form-group">
        <label>Professional Summary</label>
        <textarea rows={4} value={data.summary || ''} onChange={set('summary')} maxLength={500}
          placeholder="Brief overview of your professional background and goals…" />
        <small>{(data.summary || '').length}/500</small>
      </div>
    </div>
  );
}
