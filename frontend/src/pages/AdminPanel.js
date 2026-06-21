import React, { useEffect, useState, useCallback } from 'react';
import {
  adminListUsers, adminLockUser, adminUnlockUser,
  adminGetAuditLog, adminListTemplates, adminUpdateTemplate,
} from '../services/api';
import Spinner from '../components/common/Spinner';
import Pagination from '../components/common/Pagination';

function fmtDate(iso) {
  if (!iso) return 'â€”';
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
  const lockedCount   = users.filter(isLocked).length;
  const adminCount    = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="admin-stats">
      <div className="stat-card">
        <span className="stat-value">{users.length}</span>
        <span className="stat-label">Total Users</span>
      </div>
      <div className="stat-card">
        <span className="stat-value stat-value-red">{lockedCount}</span>
        <span className="stat-label">Locked</span>
      </div>
      <div className="stat-card">
        <span className="stat-value stat-value-purple">{adminCount}</span>
        <span className="stat-label">Admins</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{logs.length}</span>
        <span className="stat-label">Recent Events</span>
      </div>
    </div>
  );
}

function UsersTab({ users, setUsers, onRefresh }) {
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [lockTarget, setLockTarget] = useState(null);
  const [lockMins,   setLockMins]   = useState('60');
  const [actionId,   setActionId]   = useState(null);
  const [page,       setPage]       = useState(1);
  const PER_PAGE = 10;

  const filtered = users.filter((u) => {
    const term = search.toLowerCase();
    const matchSearch = !term ||
      u.full_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const visible    = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleLockConfirm = async () => {
    const mins = parseInt(lockMins, 10);
    if (!mins || mins < 1 || !lockTarget) return;
    setActionId(lockTarget.user_id);
    try {
      // Use server's locked_until to avoid local clock skew and respect server-side clamping.
      const res = await adminLockUser(lockTarget.user_id, mins);
      const until = res.data.locked_until;
      setUsers((prev) =>
        prev.map((u) => u.user_id === lockTarget.user_id ? { ...u, locked_until: until } : u)
      );
      setLockTarget(null);
    } catch {
      alert('Failed to lock user.');
    } finally {
      setActionId(null);
    }
  };

  const handleUnlock = async (uid) => {
    setActionId(uid);
    try {
      await adminUnlockUser(uid);
      setUsers((prev) =>
        prev.map((u) => u.user_id === uid ? { ...u, locked_until: null, failed_logins: 0 } : u)
      );
    } catch {
      alert('Failed to unlock user.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="Search by name or emailâ€¦"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="admin-filter-select"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn-secondary-sm" onClick={onRefresh}>â†» Refresh</button>
      </div>

      <p className="admin-count">
        {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        {(search || roleFilter) && ` (filtered from ${users.length})`}
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-empty">No users match your filters.</td>
              </tr>
            )}
            {visible.map((u) => {
              const locked = isLocked(u);
              const busy   = actionId === u.user_id;
              return (
                <React.Fragment key={u.user_id}>
                  <tr>
                    <td className="user-name">{u.full_name}</td>
                    <td className="user-email">{u.email}</td>
                    <td>
                      <span className={`badge badge-${u.role}`}>{u.role}</span>
                    </td>
                    <td>
                      {locked
                        ? <span className="badge badge-locked" title={`Until ${fmtDate(u.locked_until)}`}>ðŸ”’ Locked</span>
                        : <span className="badge badge-active">Active</span>}
                    </td>
                    <td className="log-time">{fmtDate(u.created_at)}</td>
                    <td>
                      <div className="action-cell">
                        {busy ? (
                          <Spinner size={16} />
                        ) : locked ? (
                          <button className="btn-secondary-sm" onClick={() => handleUnlock(u.user_id)}>
                            Unlock
                          </button>
                        ) : (
                          <button
                            className="btn-danger-sm"
                            onClick={() => { setLockTarget(u); setLockMins('60'); }}
                          >
                            Lock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {lockTarget?.user_id === u.user_id && (
                    <tr className="lock-form-row">
                      <td colSpan={6}>
                        <div className="lock-form">
                          <span>Lock <strong>{u.full_name}</strong> for</span>
                          <input
                            type="number"
                            className="lock-mins-input"
                            value={lockMins}
                            min={1}
                            max={10080}
                            onChange={(e) => setLockMins(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLockConfirm()}
                            autoFocus
                          />
                          <span>minutes
                            {lockMins >= 1440 && ` (${Math.round(lockMins / 1440)} day${Math.round(lockMins / 1440) > 1 ? 's' : ''})`}
                          </span>
                          <button className="btn-danger-sm" onClick={handleLockConfirm}>
                            Confirm Lock
                          </button>
                          <button className="btn-secondary-sm" onClick={() => setLockTarget(null)}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
  // Success / good
  login_success:              'event-success',
  user_registered:            'event-success',
  password_changed:           'event-success',
  // Informational
  resume_created:             'event-info',
  resume_updated:             'event-info',
  resume_duplicated:          'event-info',
  resume_exported:            'event-info',
  profile_updated:            'event-info',
  // Warnings
  resume_deleted:             'event-warn',
  account_deleted:            'event-warn',
  logout:                     'event-warn',
  // Danger / security
  login_failed:               'event-danger',
  login_failed_unknown:       'event-danger',
  login_blocked_locked:       'event-danger',
  admin_access_denied:        'event-danger',
  account_delete_bad_password:'event-danger',
  profile_update_bad_password:'event-danger',
  pdf_generation_failed:      'event-danger',
};

function LogsTab({ logs, onRefresh }) {
  const [filter,   setFilter]   = useState('');
  const [expanded, setExpanded] = useState(null);
  const [page,     setPage]     = useState(1);
  const PER_PAGE = 20;

  const eventTypes = [...new Set(logs.map((l) => l.event_type))].sort();
  const filtered   = filter ? logs.filter((l) => l.event_type === filter) : logs;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const visible    = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="admin-tab-content">
      <div className="admin-toolbar">
        <select
          className="admin-filter-select"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
        >
          <option value="">All event types</option>
          {eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-secondary-sm" onClick={onRefresh}>â†» Refresh</button>
      </div>

      <p className="admin-count">
        {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        {filter && ` â€” filtered to "${filter}"`}
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>User ID</th>
              <th>IP Address</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="admin-empty">No events found.</td>
              </tr>
            )}
            {visible.map((l) => {
              const colorClass  = EVENT_COLORS[l.event_type] || 'event-neutral';
              const hasMetadata = l.metadata && Object.keys(l.metadata).length > 0;
              const isOpen      = expanded === l.log_id;
              return (
                <React.Fragment key={l.log_id}>
                  <tr>
                    <td className="log-time">{fmtDate(l.occurred_at)}</td>
                    <td>
                      <span className={`event-badge ${colorClass}`}>{l.event_type}</span>
                    </td>
                    <td className="log-uuid">
                      <small title={l.user_id}>{l.user_id ? l.user_id.slice(0, 8) + 'â€¦' : 'â€”'}</small>
                    </td>
                    <td>{l.ip_address || 'â€”'}</td>
                    <td>
                      {hasMetadata && (
                        <button
                          className="btn-link-sm"
                          onClick={() => setExpanded(isOpen ? null : l.log_id)}
                        >
                          {isOpen ? 'Hide â–²' : 'Details â–¼'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="log-meta-row">
                      <td colSpan={5}>
                        <pre className="log-meta">{JSON.stringify(l.metadata, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
  const [editing, setEditing] = useState(null); // template id being edited
  const [editDesc, setEditDesc] = useState('');
  const [saving,  setSaving]  = useState(null);

  const startEdit = (t) => { setEditing(t.id); setEditDesc(t.description); };

  const saveDesc = async (t) => {
    setSaving(t.id);
    try {
      await adminUpdateTemplate(t.id, { description: editDesc });
      setTemplates((prev) => prev.map((x) => x.id === t.id ? { ...x, description: editDesc } : x));
      setEditing(null);
    } catch {
      alert('Failed to save description.');
    } finally {
      setSaving(null);
    }
  };

  const toggleActive = async (t) => {
    setSaving(t.id);
    try {
      const next = !t.active;
      await adminUpdateTemplate(t.id, { active: next });
      setTemplates((prev) => prev.map((x) => x.id === t.id ? { ...x, active: next } : x));
    } catch {
      alert('Failed to update template.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="admin-tab-content">
      <p className="admin-count">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
      <div className="template-admin-list">
        {templates.map((t) => (
          <div key={t.id} className={`entry-card ${!t.active ? 'entry-card-inactive' : ''}`}>
            <div className="entry-card-header">
              <div>
                <strong>{t.name}</strong>
                <code className="tmpl-id"> ({t.id})</code>
              </div>
              <div className="action-cell">
                <span className={`badge ${t.active ? 'badge-active' : 'badge-inactive'}`}>
                  {t.active ? 'Active' : 'Inactive'}
                </span>
                <button
                  className={t.active ? 'btn-danger-sm' : 'btn-secondary-sm'}
                  onClick={() => toggleActive(t)}
                  disabled={saving === t.id}
                >
                  {saving === t.id ? <Spinner size={14} /> : t.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>

            {editing === t.id ? (
              <div className="template-edit-form">
                <textarea
                  rows={2}
                  value={editDesc}
                  maxLength={200}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
                <small>{editDesc.length} / 200</small>
                <div className="action-cell" style={{ marginTop: '0.5rem' }}>
                  <button
                    className="btn-primary-sm"
                    onClick={() => saveDesc(t)}
                    disabled={saving === t.id}
                  >
                    {saving === t.id ? <Spinner size={14} /> : 'Save'}
                  </button>
                  <button className="btn-secondary-sm" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="template-desc-row">
                <p className="text-muted" style={{ margin: 0 }}>{t.description}</p>
                <button className="btn-link-sm" onClick={() => startEdit(t)}>Edit</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'users',     label: 'Users'     },
  { key: 'logs',      label: 'Audit Log' },
  { key: 'templates', label: 'Templates' },
];

export default function AdminPanel() {
  const [tab,       setTab]       = useState('users');
  const [users,     setUsers]     = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const loadTab = useCallback(async (t) => {
    setError('');
    setLoading(true);
    try {
      if (t === 'users') {
        const r = await adminListUsers(1, 100);
        setUsers(r.data.users || []);
      } else if (t === 'logs') {
        const r = await adminGetAuditLog(1, 100);
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
  }, []);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const tabLabel = (t) => {
    if (t === 'users' && users.length)     return `Users (${users.length})`;
    if (t === 'logs'  && logs.length)      return `Audit Log (${logs.length})`;
    return TABS.find((x) => x.key === t)?.label ?? t;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <span className="badge badge-admin" style={{ fontSize: 13, padding: '4px 12px' }}>
          Administrator
        </span>
      </div>

      <StatsBar users={users} logs={logs} />

      <div className="tab-bar">
        {TABS.map(({ key }) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {tabLabel(key)}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button className="btn-link-sm" onClick={() => loadTab(tab)}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="center-page" style={{ minHeight: 200 }}>
          <Spinner size={40} />
        </div>
      ) : (
        <>
          {tab === 'users'     && <UsersTab     users={users}     setUsers={setUsers}         onRefresh={() => loadTab('users')} />}
          {tab === 'logs'      && <LogsTab      logs={logs}                                   onRefresh={() => loadTab('logs')}  />}
          {tab === 'templates' && <TemplatesTab templates={templates} setTemplates={setTemplates} />}
        </>
      )}
    </div>
  );
}

