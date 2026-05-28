import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getResumeLimits, listResumes, deleteResume, duplicateResume, exportResume,
} from '../services/api';
import Spinner from '../components/common/Spinner';
import { useAsyncAction } from '../hooks/useAsyncAction';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [resumes, setResumes] = useState([]);
  const [maxResumes, setMaxResumes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { loading: actionLoading, run: runAction } = useAsyncAction();
  const navigate = useNavigate();

  const fetchResumes = useCallback(async () => {
    try {
      const [resumesRes, limitsRes] = await Promise.all([listResumes(), getResumeLimits()]);
      setResumes(resumesRes.data);
      setMaxResumes(limitsRes.data.max_resumes);
    } catch {
      setError('Failed to load resumes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResumes(); }, [fetchResumes]);

  const withAction = async (key, fn) => {
    try {
      await runAction(key, fn);
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Action failed. Please try again.');
    }
  };

  const handleDelete = (id) => withAction(`${id}:delete`, async () => {
    if (!window.confirm('Delete this resume? This cannot be undone.')) return;
    await deleteResume(id);
    setResumes((prev) => prev.filter((r) => r.resume_id !== id));
  });

  const handleDuplicate = (id) => withAction(`${id}:duplicate`, async () => {
    const res = await duplicateResume(id);
    setResumes((prev) => [res.data, ...prev]);
  });

  const handleExport = (id, title) => withAction(`${id}:export`, async () => {
    const res = await exportResume(id);
    downloadBlob(res.data, `${title || 'resume'}.pdf`);
  });

  if (loading) return <div className="center-page"><Spinner size={40} /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Resumes</h1>
        {maxResumes !== null && resumes.length < maxResumes && (
          <Link to="/resumes/new" className="btn-primary">+ New Resume</Link>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {resumes.length === 0 ? (
        <div className="empty-state">
          <h2>No resumes yet</h2>
          <p>Create your first ATS-friendly resume in minutes.</p>
          <Link to="/resumes/new" className="btn-primary">Create Resume</Link>
        </div>
      ) : (
        <div className="resume-grid">
          {resumes.map((r) => (
            <div key={r.resume_id} className="resume-card">
              <div className="resume-card-header">
                <span className="resume-template-badge">{r.template_id}</span>
              </div>
              <h3 className="resume-title">{r.title}</h3>
              <p className="resume-date">
                Updated {new Date(r.updated_at).toLocaleDateString()}
              </p>
              <div className="resume-card-actions">
                <button className="btn-secondary-sm"
                  onClick={() => navigate(`/resumes/${r.resume_id}/edit`)}
                  disabled={!!actionLoading[`${r.resume_id}:delete`] || !!actionLoading[`${r.resume_id}:duplicate`] || !!actionLoading[`${r.resume_id}:export`]}>
                  Edit
                </button>
                <button className="btn-secondary-sm"
                  onClick={() => handleDuplicate(r.resume_id)}
                  disabled={!!actionLoading[`${r.resume_id}:duplicate`] || resumes.length >= (maxResumes ?? Infinity)}>
                  {actionLoading[`${r.resume_id}:duplicate`] ? <Spinner size={14} /> : 'Copy'}
                </button>
                <button className="btn-primary-sm"
                  onClick={() => handleExport(r.resume_id, r.title)}
                  disabled={!!actionLoading[`${r.resume_id}:export`]}>
                  {actionLoading[`${r.resume_id}:export`] ? <Spinner size={14} /> : 'Export PDF'}
                </button>
                <button className="btn-danger-sm"
                  onClick={() => handleDelete(r.resume_id)}
                  disabled={!!actionLoading[`${r.resume_id}:delete`]}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {maxResumes !== null && resumes.length >= maxResumes && (
        <p className="text-muted" style={{ marginTop: '1rem' }}>
          You've reached the limit of {maxResumes} resumes. Delete one to create another.
        </p>
      )}
    </div>
  );
}
