'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Lock,
  RefreshCw,
  Save,
  Settings,
  Sliders,
  X,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description?: string | null;
  category: string;
  dataType: string;
  updatedByAdminId?: number | null;
  updatedAt: string;
}

interface GroupedCategory {
  category: string;
  settings: SystemSetting[];
}

interface SettingsResponse {
  settings: SystemSetting[];
  grouped: GroupedCategory[];
}

/* ============================================================
   HELPERS
   ============================================================ */

function formatDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function categoryIcon(cat: string) {
  switch (cat) {
    case 'GENERAL': return <Settings size={16} />;
    case 'SECURITY': return <Lock size={16} />;
    case 'LIMITS': return <Sliders size={16} />;
    case 'NOTIFICATIONS': return <Bell size={16} />;
    default: return <ChevronRight size={16} />;
  }
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'GENERAL': return 'General';
    case 'SECURITY': return 'Security';
    case 'LIMITS': return 'Transaction Limits';
    case 'NOTIFICATIONS': return 'Notifications';
    default: return cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatKeyLabel(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ============================================================
   SETTING ROW
   ============================================================ */

function SettingRow({
  setting,
  onSave,
}: {
  setting: SystemSetting;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(setting.value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (draft === setting.value) {
      setEditing(false);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave(setting.key, draft);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(setting.value);
    setEditing(false);
    setError(null);
  }

  const isBoolean = setting.dataType === 'BOOLEAN';
  const isNumber = setting.dataType === 'NUMBER';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        padding: '14px 0',
        borderBottom: '1px solid #f1f5f9',
        alignItems: 'start',
      }}
    >
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>
          {formatKeyLabel(setting.key)}
        </div>
        {setting.description && (
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>{setting.description}</div>
        )}
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
          Last updated: {formatDate(setting.updatedAt)}
          {setting.updatedByAdminId ? ` by Admin #${setting.updatedByAdminId}` : ''}
        </div>
      </div>

      <div>
        {editing ? (
          <div>
            {isBoolean ? (
              <select
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  border: '1px solid #3b82f6',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '8px',
                  background: '#fff',
                }}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type={isNumber ? 'number' : 'text'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  border: '1px solid #3b82f6',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '8px',
                  boxSizing: 'border-box',
                }}
              />
            )}
            {error && (
              <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <X size={12} />{error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? <RefreshCw size={12} className="compliance-spin" /> : <Save size={12} />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                style={{
                  padding: '5px 12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              {isBoolean ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: setting.value === 'true' ? '#dcfce7' : '#fee2e2',
                    color: setting.value === 'true' ? '#15803d' : '#dc2626',
                  }}
                >
                  {setting.value === 'true' ? <Check size={11} /> : <X size={11} />}
                  {setting.value}
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: '#1e293b', fontFamily: 'monospace', background: '#f8fafc', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  {setting.value}
                </span>
              )}
              {saved && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#16a34a', fontSize: '12px', marginLeft: '8px' }}>
                  <Check size={12} /> Saved
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setDraft(setting.value); setEditing(true); }}
              style={{
                padding: '4px 10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFetch<SettingsResponse>('/admin/settings');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(key: string, value: string) {
    await apiFetch(`/admin/settings/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
    setData((prev) => {
      if (!prev) return prev;
      const updatedSettings = prev.settings.map((s) =>
        s.key === key ? { ...s, value, updatedAt: new Date().toISOString() } : s,
      );
      const updatedGrouped = prev.grouped.map((g) => ({
        ...g,
        settings: g.settings.map((s) =>
          s.key === key ? { ...s, value, updatedAt: new Date().toISOString() } : s,
        ),
      }));
      return { settings: updatedSettings, grouped: updatedGrouped };
    });
  }

  function toggleCollapse(cat: string) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <main className="compliance-page">
      {/* HEADER */}
      <div className="compliance-page-header">
        <div>
          <div className="compliance-breadcrumb">
            <span>Admin</span><span>/</span><span>Settings</span>
          </div>
          <div className="compliance-title-row">
            <div className="compliance-title-icon"><Settings size={24} /></div>
            <div>
              <h1>System Settings</h1>
              <p>Configure platform behaviour, security policies, transaction limits, and notifications.</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="compliance-refresh-button"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? 'compliance-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="compliance-state compliance-error-state" style={{ marginBottom: '24px' }}>
          <XCircle size={28} /><h3>Unable to load settings</h3><p>{error}</p>
          <button type="button" onClick={() => void load()}>Try again</button>
        </div>
      )}

      {loading && !data && (
        <div className="compliance-state">
          <RefreshCw size={30} className="compliance-spin" /><h3>Loading settings…</h3>
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data.grouped.map((group) => {
            const isOpen = !collapsed[group.category];
            return (
              <div key={group.category} className="compliance-content-card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.category)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '16px 24px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderBottom: isOpen ? '1px solid #f1f5f9' : 'none',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: '#3b82f6' }}>{categoryIcon(group.category)}</span>
                  <span style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                    {categoryLabel(group.category)}
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8', marginRight: '8px' }}>
                    {group.settings.length} setting{group.settings.length !== 1 ? 's' : ''}
                  </span>
                  {isOpen ? <ChevronDown size={16} style={{ color: '#94a3b8' }} /> : <ChevronRight size={16} style={{ color: '#94a3b8' }} />}
                </button>

                {isOpen && (
                  <div style={{ padding: '0 24px 8px' }}>
                    {/* Column headers */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        padding: '10px 0 4px',
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Setting</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Value</span>
                    </div>
                    {group.settings.map((setting) => (
                      <SettingRow
                        key={setting.key}
                        setting={setting}
                        onSave={handleSave}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
