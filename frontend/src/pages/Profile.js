import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, deleteAccount } from '../services/api';
import { useAsyncAction } from '../hooks/useAsyncAction';

export default function Profile() {
  const { user, logout, refetch } = useAuth();
  const navigate = useNavigate();

  const [nameForm, setNameForm] = useState({ full_name: user?.full_name || '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [deleteForm, setDeleteForm] = useState({ password: '' });

  const [nameMsg, setNameMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');
  const { loading, run } = useAsyncAction();

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setNameMsg('');
    try {
      await run('name', () => updateProfile({ full_name: nameForm.full_name }));
      await refetch();
      setNameMsg('Name updated successfully.');
    } catch (err) {
      setNameMsg(err.response?.data?.message || 'Update failed.');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwMsg('');
    try {
      await run('pw', () => updateProfile(pwForm));
      setPwForm({ current_password: '', new_password: '' });
      setPwMsg('Password updated successfully.');
    } catch (err) {
      setPwMsg(err.response?.data?.message || 'Update failed.');
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteMsg('');
    if (!window.confirm('Permanently delete your account and all resumes? This cannot be undone.')) return;
    try {
      await run('delete', () => deleteAccount({ password: deleteForm.password }));
      await logout();
      navigate('/');
    } catch (err) {
      setDeleteMsg(err.response?.data?.message || 'Deletion failed.');
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '640px' }}>
      <h1>Your Profile</h1>

      <div className="profile-section">
        <h2>Account Details</h2>
        <dl className="profile-dl">
          <dt>Email</dt><dd>{user?.email}</dd>
          <dt>Member since</dt><dd>{new Date(user?.created_at).toLocaleDateString()}</dd>
          <dt>Role</dt><dd>{user?.role}</dd>
        </dl>
      </div>

      <div className="profile-section">
        <h2>Update Name</h2>
        <form onSubmit={handleUpdateName}>
          <div className="form-group">
            <label>Full Name</label>
            <input value={nameForm.full_name}
              onChange={(e) => setNameForm({ full_name: e.target.value })}
              maxLength={100} required />
          </div>
          {nameMsg && <div className={`alert ${nameMsg.includes('success') ? 'alert-success' : 'alert-error'}`}>{nameMsg}</div>}
          <button type="submit" className="btn-primary" disabled={loading.name}>
            {loading.name ? 'Saving…' : 'Update Name'}
          </button>
        </form>
      </div>

      <div className="profile-section">
        <h2>Change Password</h2>
        <form onSubmit={handleUpdatePassword}>
          <div className="form-group">
            <label>Current Password</label>
            <input type="password" value={pwForm.current_password}
              onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
              autoComplete="current-password" required />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={pwForm.new_password}
              onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
              autoComplete="new-password" minLength={12} required />
          </div>
          {pwMsg && <div className={`alert ${pwMsg.includes('success') ? 'alert-success' : 'alert-error'}`}>{pwMsg}</div>}
          <button type="submit" className="btn-primary" disabled={loading.pw}>
            {loading.pw ? 'Updating…' : 'Change Password'}
          </button>
        </form>
      </div>

      <div className="profile-section danger-zone">
        <h2>Danger Zone</h2>
        <p>Deleting your account permanently removes all your resumes and personal data.</p>
        <form onSubmit={handleDeleteAccount}>
          <div className="form-group">
            <label>Confirm your password to delete</label>
            <input type="password" value={deleteForm.password}
              onChange={(e) => setDeleteForm({ password: e.target.value })}
              autoComplete="current-password" required />
          </div>
          {deleteMsg && <div className="alert alert-error">{deleteMsg}</div>}
          <button type="submit" className="btn-danger" disabled={loading.delete}>
            {loading.delete ? 'Deleting…' : 'Delete My Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
