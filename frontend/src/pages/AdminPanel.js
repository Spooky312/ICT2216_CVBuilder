import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  adminListUsers, adminLockUser, adminUnlockUser, adminDeactivateUser, adminDeleteUser,
  adminGetAuditLog, adminListTemplates, adminCreateTemplate, adminUploadTemplate, adminUpdateTemplate,
} from '../services/api';
import Spinner from '../components/common/Spinner';
import Pagination from '../components/common/Pagination';

function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isLocked(user) {
  if (!user.locked_until) return false;
  return new Date(user.locked_until) > new Date();
}

function StatsBar({ users, logs }) {
  const activeCount = users.filter((u) => u.is_active !== false).length;
  const inactiveCount = users.filter((u) => u.is_active === false).length;
  const lockedCount = users.filter((u) => u.is_active !== false && isLocked(u)).length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="admin-stats">
      <div className="stat-card"><span className="stat-value">{users.length}</span><span className="stat-label">Total Users</span></div>
      <div className="stat-card"><span className="stat-value stat-value-green">{activeCount}</span><span className="stat-label">Active</span></div>
      <div className="stat-card"><span className="stat-value stat-value-red">{inactiveCount}</span><span className="stat-label">Deactivated</span></div>
      <div className="stat-card"><span className="stat-value stat-value-red">{lockedCount}</span><span className="stat-label">Locked</span></div>
      <div className="stat-card"><span className="stat-value stat-value-purple">{adminCount}</span><span className="stat-label">Admins</span></div>
      <div className="stat-card"><span className="stat-value">{logs.length}</span><span className="stat-label">Recent Events</span></div>
    </div>
  );
}

function UsersTab({ users, setUsers, onRefresh }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lockTarget, setLockTarget] = useState(null);
  const [lockMins, setLockMins] = useState('60');
  const [actionId, setActionId] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const filtered = users.filter((u) => {
    const term = search.toLowerCase();
    const active = u.is_active !== false;
    const locked = active && isLocked(u);
    const matchSearch = !term ||
      u.full_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term);
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchStatus = !statusFilter ||
      (statusFilter === 'active' && active && !locked) ||
      (statusFilter === 'locked' && locked) ||
      (statusFilter === 'deactivated' && !active);
    return matchSearch && matchRole && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const patchUser = (uid, patch) => {
    setUsers((prev) => prev.map((u) => u.user_id === uid ? { ...u, ...patch } : u));
  };

  const handleLockConfirm = async () => {
    const mins = parseInt(lockMins, 10);
    if (!mins || mins < 1 || !lockTarget) return;
    setActionId(lockTarget.user_id);
    try {
      const res = await adminLockUser(lockTarget.user_id, mins);
      patchUser(lockTarget.user_id, { locked_until: res.data.locked_until });
      setLockTarget(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to lock user.');
    } finally {
      setActionId(null);
    }
  };

  const handleUnlock = async (uid) => {
    setActionId(uid);
    try {
      await adminUnlockUser(uid);
      patchUser(uid, { locked_until: null, failed_logins: 0 });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unlock user.');
    } finally {
      setActionId(null);
    }
  };

  const handleDeactivate = async (user) => {
    if (!window.confirm(`Deactivate ${user.full_name}? They will not be able to log in.`)) return;
    setActionId(user.user_id);
    try {
      const res = await adminDeactivateUser(user.user_id);
      patchUser(user.user_id, res.data.user || { is_active: false, locked_until: null, failed_logins: 0 });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate user.');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Permanently delete ${user.full_name} and all their resumes?`)) return;
    setActionId(user.user_id);
    try {
      await adminDeleteUser(user.user_id);
      setUsers((prev) => prev.filter((u) => u.user_id !== user.user_id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Search by name or email" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="admin-filter-select" value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select className="admin-filter-select" value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="locked">Locked</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <button className="btn-secondary-sm" onClick={onRefresh}>Refresh</button>
      </div>

      <p className="admin-count">
        {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        {(search || roleFilter || statusFilter) && ` (filtered from ${users.length})`}
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} className="admin-empty">No users match your filters.</td></tr>
            )}
            {visible.map((u) => {
              const active = u.is_active !== false;
              const locked = active && isLocked(u);
              const busy = actionId === u.user_id;
              return (
                <Fragment key={u.user_id}>
                  <tr>
                    <td className="user-name">{u.full_name}</td>
                    <td className="user-email">{u.email}</td>
                    <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                    <td>
                      {!active ? <span className="badge badge-inactive">Deactivated</span>
                        : locked ? <span className="badge badge-locked" title={`Until ${fmtDate(u.locked_until)}`}>Locked</span>
                        : <span className="badge badge-active">Active</span>}
                    </td>
                    <td className="log-time">{fmtDate(u.created_at)}</td>
                    <td>
                      <div className="action-cell">
                        {busy ? <Spinner size={16} /> : (
                          <>
                            {active && (locked
                              ? <button className="btn-secondary-sm" onClick={() => handleUnlock(u.user_id)}>Unlock</button>
                              : <button className="btn-danger-sm" onClick={() => { setLockTarget(u); setLockMins('60'); }}>Lock</button>)}
                            {active && <button className="btn-danger-sm" onClick={() => handleDeactivate(u)}>Deactivate</button>}
                            <button className="btn-danger-sm" onClick={() => handleDelete(u)}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {lockTarget?.user_id === u.user_id && (
                    <tr className="lock-form-row">
                      <td colSpan={6}>
                        <div className="lock-form">
                          <span>Lock <strong>{u.full_name}</strong> for</span>
                          <input type="number" className="lock-mins-input" value={lockMins} min={1} max={10080}
                            onChange={(e) => setLockMins(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLockConfirm()} autoFocus />
                          <span>minutes</span>
                          <button className="btn-danger-sm" onClick={handleLockConfirm}>Confirm Lock</button>
                          <button className="btn-secondary-sm" onClick={() => setLockTarget(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

const EVENT_COLORS = {
  login_success: 'event-success',
  user_registered: 'event-success',
  password_changed: 'event-success',
  resume_created: 'event-info',
  resume_updated: 'event-info',
  resume_duplicated: 'event-info',
  resume_exported: 'event-info',
  profile_updated: 'event-info',
  admin_user_deactivated: 'event-warn',
  admin_user_deleted: 'event-warn',
  admin_user_locked: 'event-warn',
  admin_user_unlocked: 'event-info',
  resume_deleted: 'event-warn',
  account_deleted: 'event-warn',
  logout: 'event-warn',
  login_failed: 'event-danger',
  login_failed_unknown: 'event-danger',
  login_blocked_locked: 'event-danger',
  login_blocked_deactivated: 'event-danger',
  admin_access_denied: 'event-danger',
  account_delete_bad_password: 'event-danger',
  profile_update_bad_password: 'event-danger',
  pdf_generation_failed: 'event-danger',
};

function LogsTab({ logs, filters, onApplyFilters, onRefresh }) {
  const [draftFilters, setDraftFilters] = useState(filters);
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;


  const updateFilter = (field, value) => {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    setExpanded(null);
    setPage(1);
    onApplyFilters(draftFilters);
  };

  const clearFilters = () => {
    const emptyFilters = { event_type: '', user_id: '', date_from: '', date_to: '' };
    setDraftFilters(emptyFilters);
    setExpanded(null);
    setPage(1);
    onApplyFilters(emptyFilters);
  };

  const hasAppliedFilters = Object.values(filters).some(Boolean);
  const hasDraftFilters = Object.values(draftFilters).some(Boolean);
  const totalPages = Math.max(1, Math.ceil(logs.length / PER_PAGE));
  const visible = logs.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="admin-tab-content">
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Event type" value={draftFilters.event_type}
          onChange={(e) => updateFilter('event_type', e.target.value)} />
        <input className="admin-search" placeholder="User ID" value={draftFilters.user_id}
          onChange={(e) => updateFilter('user_id', e.target.value)} />
        <input className="admin-filter-select" type="date" value={draftFilters.date_from}
          onChange={(e) => updateFilter('date_from', e.target.value)} aria-label="Date from" />
        <input className="admin-filter-select" type="date" value={draftFilters.date_to}
          onChange={(e) => updateFilter('date_to', e.target.value)} aria-label="Date to" />
        <button className="btn-primary-sm" onClick={applyFilters}>Apply</button>
        <button className="btn-secondary-sm" onClick={clearFilters} disabled={!hasAppliedFilters && !hasDraftFilters}>Clear</button>
        <button className="btn-secondary-sm" onClick={onRefresh}>Refresh</button>
      </div>
      <p className="admin-count">
        {logs.length} event{logs.length !== 1 ? 's' : ''}{hasAppliedFilters && ' matching filters'}
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Time</th><th>Event</th><th>User ID</th><th>IP Address</th><th>Detail</th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={5} className="admin-empty">No events found.</td></tr>}
            {visible.map((l) => {
              const colorClass = EVENT_COLORS[l.event_type] || 'event-neutral';
              const hasMetadata = l.metadata && Object.keys(l.metadata).length > 0;
              const isOpen = expanded === l.log_id;
              return (
                <Fragment key={l.log_id}>
                  <tr>
                    <td className="log-time">{fmtDate(l.occurred_at)}</td>
                    <td><span className={`event-badge ${colorClass}`}>{l.event_type}</span></td>
                    <td className="log-uuid"><small title={l.user_id}>{l.user_id ? `${l.user_id.slice(0, 8)}...` : '-'}</small></td>
                    <td>{l.ip_address || '-'}</td>
                    <td>{hasMetadata && <button className="btn-link-sm" onClick={() => setExpanded(isOpen ? null : l.log_id)}>{isOpen ? 'Hide' : 'Details'}</button>}</td>
                  </tr>
                  {isOpen && <tr className="log-meta-row"><td colSpan={5}><pre className="log-meta">{JSON.stringify(l.metadata, null, 2)}</pre></td></tr>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}
function TemplatesTab({ templates, setTemplates }) {
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [createForm, setCreateForm] = useState({
    template_id: '', name: '', description: '', source_template_id: 'modern', active: true,
  });
  const [uploadForm, setUploadForm] = useState({
    template_id: '', name: '', description: '', active: true, template_file: null,
  });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', source_template_id: 'modern' });
  const [saving, setSaving] = useState(null);
  const sourceOptions = ['modern', 'classic', 'minimal'];

  const updateCreate = (field, value) => setCreateForm((prev) => ({ ...prev, [field]: value }));
  const updateUpload = (field, value) => setUploadForm((prev) => ({ ...prev, [field]: value }));
  const updateEdit = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }));

  const upsertTemplate = (template) => {
    setTemplates((prev) => {
      const exists = prev.some((x) => x.id === template.id);
      const next = exists ? prev.map((x) => x.id === template.id ? template : x) : [...prev, template];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const startEdit = (t) => {
    setEditing(t.id);
    setEditForm({
      name: t.name,
      description: t.description || '',
      source_template_id: t.source_template_id || t.id,
    });
  };

  const createTemplate = async (e) => {
    e.preventDefault();
    setSaving('create');
    try {
      const res = await adminCreateTemplate(createForm);
      upsertTemplate(res.data);
      setCreateForm({ template_id: '', name: '', description: '', source_template_id: 'modern', active: true });
      setCreating(false);
    } catch (err) {
      const data = err.response?.data;
      alert(data?.message || JSON.stringify(data?.errors || 'Failed to create template.'));
    } finally {
      setSaving(null);
    }
  };

  const uploadTemplate = async (e) => {
    e.preventDefault();
    if (!uploadForm.template_file) {
      alert('Choose an HTML template file.');
      return;
    }
    setSaving('upload');
    const formData = new FormData();
    formData.append('template_id', uploadForm.template_id);
    formData.append('name', uploadForm.name);
    formData.append('description', uploadForm.description);
    formData.append('active', uploadForm.active ? 'true' : 'false');
    formData.append('template_file', uploadForm.template_file);
    try {
      const res = await adminUploadTemplate(formData);
      upsertTemplate(res.data);
      setUploadForm({ template_id: '', name: '', description: '', active: true, template_file: null });
      e.target.reset();
      setUploading(false);
    } catch (err) {
      const data = err.response?.data;
      alert(data?.message || JSON.stringify(data?.errors || 'Failed to upload template.'));
    } finally {
      setSaving(null);
    }
  };

  const saveTemplate = async (t) => {
    setSaving(t.id);
    const payload = t.is_uploaded
      ? { name: editForm.name, description: editForm.description }
      : editForm;
    try {
      const res = await adminUpdateTemplate(t.id, payload);
      setTemplates((prev) => prev.map((x) => x.id === t.id ? res.data : x));
      setEditing(null);
    } catch (err) {
      const data = err.response?.data;
      alert(data?.message || JSON.stringify(data?.errors || 'Failed to save template.'));
    } finally {
      setSaving(null);
    }
  };

  const toggleActive = async (t) => {
    setSaving(t.id);
    try {
      const res = await adminUpdateTemplate(t.id, { active: !t.active });
      setTemplates((prev) => prev.map((x) => x.id === t.id ? res.data : x));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update template.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-toolbar">
        <p className="admin-count" style={{ margin: 0 }}>{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        <button className="btn-primary-sm" onClick={() => { setCreating((value) => !value); setUploading(false); }}>
          {creating ? 'Cancel' : 'Add Template'}
        </button>
        <button className="btn-secondary-sm" onClick={() => { setUploading((value) => !value); setCreating(false); }}>
          {uploading ? 'Cancel Upload' : 'Upload HTML'}
        </button>
      </div>

      {creating && (
        <form className="entry-card template-edit-form" onSubmit={createTemplate}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="new-template-id">Template ID</label>
              <input id="new-template-id" value={createForm.template_id}
                onChange={(e) => updateCreate('template_id', e.target.value)} placeholder="professional" required />
            </div>
            <div className="form-group">
              <label htmlFor="new-template-name">Name</label>
              <input id="new-template-name" value={createForm.name}
                onChange={(e) => updateCreate('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="new-template-source">Render Layout</label>
              <select id="new-template-source" value={createForm.source_template_id}
                onChange={(e) => updateCreate('source_template_id', e.target.value)}>
                {sourceOptions.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="new-template-description">Description</label>
            <textarea id="new-template-description" rows={2} value={createForm.description} maxLength={250}
              onChange={(e) => updateCreate('description', e.target.value)} />
          </div>
          <button className="btn-primary-sm" type="submit" disabled={saving === 'create'}>
            {saving === 'create' ? <Spinner size={14} /> : 'Create Template'}
          </button>
        </form>
      )}

      {uploading && (
        <form className="entry-card template-edit-form" onSubmit={uploadTemplate}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="upload-template-id">Template ID</label>
              <input id="upload-template-id" value={uploadForm.template_id}
                onChange={(e) => updateUpload('template_id', e.target.value)} placeholder="custom-html" required />
            </div>
            <div className="form-group">
              <label htmlFor="upload-template-name">Name</label>
              <input id="upload-template-name" value={uploadForm.name}
                onChange={(e) => updateUpload('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="upload-template-file">HTML File</label>
              <input id="upload-template-file" type="file" accept=".html,.htm,text/html"
                onChange={(e) => updateUpload('template_file', e.target.files?.[0] || null)} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="upload-template-description">Description</label>
            <textarea id="upload-template-description" rows={2} value={uploadForm.description} maxLength={250}
              onChange={(e) => updateUpload('description', e.target.value)} />
          </div>
          <label className="template-active-toggle">
            <input type="checkbox" checked={uploadForm.active} onChange={(e) => updateUpload('active', e.target.checked)} />
            Active
          </label>
          <button className="btn-primary-sm" type="submit" disabled={saving === 'upload'}>
            {saving === 'upload' ? <Spinner size={14} /> : 'Upload Template'}
          </button>
        </form>
      )}

      <div className="template-admin-list">
        {templates.map((t) => (
          <div key={t.id} className={`entry-card ${!t.active ? 'entry-card-inactive' : ''}`}>
            <div className="entry-card-header">
              <div>
                <strong>{t.name}</strong>
                <code className="tmpl-id"> ({t.id})</code>
                {t.is_uploaded && <span className="badge badge-user" style={{ marginLeft: 8 }}>Uploaded</span>}
              </div>
              <div className="action-cell">
                <span className={`badge ${t.active ? 'badge-active' : 'badge-inactive'}`}>{t.active ? 'Active' : 'Inactive'}</span>
                <button className="btn-link-sm" onClick={() => startEdit(t)}>Edit</button>
                <button className={t.active ? 'btn-danger-sm' : 'btn-secondary-sm'} onClick={() => toggleActive(t)} disabled={saving === t.id}>
                  {saving === t.id ? <Spinner size={14} /> : t.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
            {editing === t.id ? (
              <div className="template-edit-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input value={editForm.name} onChange={(e) => updateEdit('name', e.target.value)} />
                  </div>
                  {!t.is_uploaded && (
                    <div className="form-group">
                      <label>Render Layout</label>
                      <select value={editForm.source_template_id} onChange={(e) => updateEdit('source_template_id', e.target.value)}>
                        {sourceOptions.map((id) => <option key={id} value={id}>{id}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <label>Description</label>
                <textarea rows={2} value={editForm.description} maxLength={250}
                  onChange={(e) => updateEdit('description', e.target.value)} />
                <small>{editForm.description.length} / 250</small>
                <div className="action-cell" style={{ marginTop: '0.5rem' }}>
                  <button className="btn-primary-sm" onClick={() => saveTemplate(t)} disabled={saving === t.id}>
                    {saving === t.id ? <Spinner size={14} /> : 'Save'}
                  </button>
                  <button className="btn-secondary-sm" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="template-desc-row">
                <p className="text-muted" style={{ margin: 0 }}>{t.description}</p>
                <small className="text-muted">
                  {t.is_uploaded ? `Uploaded file: ${t.original_filename || 'HTML template'}` : `Render layout: ${t.source_template_id}`}
                </small>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'logs', label: 'Audit Log' },
  { key: 'templates', label: 'Templates' },
];

export default function AdminPanel() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logFilters, setLogFilters] = useState({ event_type: '', user_id: '', date_from: '', date_to: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTab = useCallback(async (t, filtersOverride = null) => {
    setError('');
    setLoading(true);
    try {
      if (t === 'users') {
        const r = await adminListUsers(1, 100);
        setUsers(r.data.users || []);
      } else if (t === 'logs') {
        const r = await adminGetAuditLog(1, 100, filtersOverride || logFilters);
        setLogs(r.data.logs || []);
      } else if (t === 'templates') {
        const r = await adminListTemplates();
        setTemplates(r.data || []);
      }
    } catch {
      setError('Failed to load data. Make sure you have admin access and try again.');
    } finally {
      setLoading(false);
    }
  }, [logFilters]);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const applyLogFilters = (nextFilters) => {
    setLogFilters(nextFilters);
  };

  const tabLabel = (t) => {
    if (t === 'users' && users.length) return `Users (${users.length})`;
    if (t === 'logs' && logs.length) return `Audit Log (${logs.length})`;
    return TABS.find((x) => x.key === t)?.label ?? t;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <span className="badge badge-admin" style={{ fontSize: 13, padding: '4px 12px' }}>Administrator</span>
      </div>
      <StatsBar users={users} logs={logs} />
      <div className="tab-bar">
        {TABS.map(({ key }) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {tabLabel(key)}
          </button>
        ))}
      </div>
      {error && <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{error}</span><button className="btn-link-sm" onClick={() => loadTab(tab)}>Retry</button></div>}
      {loading ? (
        <div className="center-page" style={{ minHeight: 200 }}><Spinner size={40} /></div>
      ) : (
        <>
          {tab === 'users' && <UsersTab users={users} setUsers={setUsers} onRefresh={() => loadTab('users')} />}
          {tab === 'logs' && <LogsTab logs={logs} filters={logFilters} onApplyFilters={applyLogFilters} onRefresh={() => loadTab('logs')} />}
          {tab === 'templates' && <TemplatesTab templates={templates} setTemplates={setTemplates} />}
        </>
      )}
    </div>
  );
}
