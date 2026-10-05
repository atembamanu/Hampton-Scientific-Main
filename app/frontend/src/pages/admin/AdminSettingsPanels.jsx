import { Loader2 } from 'lucide-react';
import { liveEmailError, livePhoneError, invalidFieldClass } from '../../utils/validation';

const fieldClass = 'w-full h-10 px-3 border border-ink/15 bg-white text-sm text-ink';

const Field = ({ label, children, className = '' }) => (
  <label className={`block text-sm ${className}`}>
    <span className="block text-xs text-ink-muted mb-1.5">{label}</span>
    {children}
  </label>
);

const Toggle = ({ checked, onChange, testId }) => (
  <label className="relative inline-flex items-center cursor-pointer shrink-0" data-testid={testId}>
    <input type="checkbox" className="sr-only peer" checked={!!checked} onChange={onChange} />
    <span className="w-11 h-6 rounded-full bg-ink/15 peer-checked:bg-copper after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
  </label>
);

const SaveButton = ({ onClick, loading, testId }) => (
  <div className="flex justify-end pt-2">
    <button type="button" onClick={onClick} disabled={loading} className="btn-primary h-10 px-5 text-sm gap-2 disabled:opacity-60" data-testid={testId}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      Save
    </button>
  </div>
);

const Section = ({ title, description, children }) => (
  <section className="space-y-4 border-t border-ink/10 pt-6 first:border-t-0 first:pt-0">
    <div>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description ? <p className="text-xs text-ink-muted mt-1">{description}</p> : null}
    </div>
    {children}
  </section>
);

export const SettingsSiteInfo = ({ settings, setSettings, onSave, loading }) => (
  <div className="editorial-panel space-y-6">
    <Section title="Company" description="Contact details shown on quotes, invoices, and the public site.">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Company name">
          <input className={fieldClass} value={settings.company_name || ''} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} />
        </Field>
        <Field label="Website">
          <input className={fieldClass} placeholder="https://hamptonscientific.com" value={settings.website || ''} onChange={(e) => setSettings({ ...settings, website: e.target.value })} data-testid="website-input" />
        </Field>
        <Field label="Phone">
          <input type="tel" inputMode="tel" autoComplete="tel" className={`${fieldClass} ${invalidFieldClass(livePhoneError(settings.phone))}`} value={settings.phone || ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} />
          {livePhoneError(settings.phone) && <p className="text-xs text-red-600 mt-1">{livePhoneError(settings.phone)}</p>}
        </Field>
        <Field label="Email">
          <input type="email" autoComplete="email" className={`${fieldClass} ${invalidFieldClass(liveEmailError(settings.email))}`} value={settings.email || ''} onChange={(e) => setSettings({ ...settings, email: e.target.value })} />
          {liveEmailError(settings.email) && <p className="text-xs text-red-600 mt-1">{liveEmailError(settings.email)}</p>}
        </Field>
        <Field label="Working hours">
          <input className={fieldClass} value={settings.working_hours || ''} onChange={(e) => setSettings({ ...settings, working_hours: e.target.value })} />
        </Field>
        <Field label="P.O. Box">
          <input className={fieldClass} value={settings.po_box || ''} onChange={(e) => setSettings({ ...settings, po_box: e.target.value })} />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <input className={fieldClass} value={settings.address || ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
        </Field>
      </div>
    </Section>
    <Section title="Social">
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Facebook">
          <input className={fieldClass} value={settings.facebook_url || ''} onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value })} />
        </Field>
        <Field label="Twitter">
          <input className={fieldClass} value={settings.twitter_url || ''} onChange={(e) => setSettings({ ...settings, twitter_url: e.target.value })} />
        </Field>
        <Field label="LinkedIn">
          <input className={fieldClass} value={settings.linkedin_url || ''} onChange={(e) => setSettings({ ...settings, linkedin_url: e.target.value })} />
        </Field>
      </div>
    </Section>
    <Section title="Our impact" description="Figures shown on the home page and About.">
      <div className="space-y-3">
        {(settings.impact_stats || []).map((row, index) => (
          <div key={index} className="grid grid-cols-[7rem_1fr_auto] gap-2">
            <input
              className={fieldClass}
              placeholder="50+"
              value={row.value || ''}
              onChange={(e) => {
                const next = [...(settings.impact_stats || [])];
                next[index] = { ...next[index], value: e.target.value };
                setSettings({ ...settings, impact_stats: next });
              }}
            />
            <input
              className={fieldClass}
              placeholder="Hospitals supplied"
              value={row.label || ''}
              onChange={(e) => {
                const next = [...(settings.impact_stats || [])];
                next[index] = { ...next[index], label: e.target.value };
                setSettings({ ...settings, impact_stats: next });
              }}
            />
            <button
              type="button"
              className="h-10 px-3 text-xs text-ink-muted hover:text-ink"
              onClick={() => setSettings({
                ...settings,
                impact_stats: (settings.impact_stats || []).filter((_, i) => i !== index),
              })}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs text-copper hover:underline"
          disabled={(settings.impact_stats || []).length >= 8}
          onClick={() => setSettings({
            ...settings,
            impact_stats: [...(settings.impact_stats || []), { value: '', label: '' }],
          })}
        >
          Add figure
        </button>
      </div>
    </Section>
    <Section title="Trusted manufacturing partners" description="Partner names shown on the home page.">
      <div className="space-y-3">
        {(settings.partners || []).map((name, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className={fieldClass}
              placeholder="Partner name"
              value={name || ''}
              onChange={(e) => {
                const next = [...(settings.partners || [])];
                next[index] = e.target.value;
                setSettings({ ...settings, partners: next });
              }}
            />
            <button
              type="button"
              className="h-10 px-3 text-xs text-ink-muted hover:text-ink"
              onClick={() => setSettings({
                ...settings,
                partners: (settings.partners || []).filter((_, i) => i !== index),
              })}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs text-copper hover:underline"
          disabled={(settings.partners || []).length >= 20}
          onClick={() => setSettings({
            ...settings,
            partners: [...(settings.partners || []), ''],
          })}
        >
          Add partner
        </button>
      </div>
    </Section>
    <SaveButton onClick={onSave} loading={loading} testId="save-site-settings-btn" />
  </div>
);

export const SettingsPaymentInfo = ({ settings, setSettings, onSave, loading }) => (
  <div className="editorial-panel space-y-6">
    <Section title="Bank details" description="Printed on invoices.">
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Bank name">
          <input className={fieldClass} value={settings.bank_name || ''} onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })} data-testid="bank-name-input" />
        </Field>
        <Field label="Account name">
          <input className={fieldClass} value={settings.bank_account_name || ''} onChange={(e) => setSettings({ ...settings, bank_account_name: e.target.value })} data-testid="bank-account-name-input" />
        </Field>
        <Field label="Account number">
          <input className={fieldClass} value={settings.bank_account_number || ''} onChange={(e) => setSettings({ ...settings, bank_account_number: e.target.value })} data-testid="bank-account-number-input" />
        </Field>
      </div>
    </Section>
    <Section title="Lipa Na M-Pesa">
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Paybill">
          <input className={fieldClass} value={settings.mpesa_paybill || ''} onChange={(e) => setSettings({ ...settings, mpesa_paybill: e.target.value })} />
        </Field>
        <Field label="Account number">
          <input className={fieldClass} value={settings.mpesa_account_number || ''} onChange={(e) => setSettings({ ...settings, mpesa_account_number: e.target.value })} />
        </Field>
        <Field label="Account name">
          <input className={fieldClass} value={settings.mpesa_account_name || ''} onChange={(e) => setSettings({ ...settings, mpesa_account_name: e.target.value })} />
        </Field>
      </div>
    </Section>
    <Section title="Default terms" description="Applied when a new quote or invoice is created.">
      <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
        <Field label="Payment terms">
          <input className={fieldClass} value={settings.default_payment_terms || ''} onChange={(e) => setSettings({ ...settings, default_payment_terms: e.target.value })} data-testid="payment-terms-input" />
        </Field>
        <Field label="Quote validity (days)">
          <input type="number" min="1" max="365" className={fieldClass} value={settings.default_quote_validity_days ?? 7} onChange={(e) => setSettings({ ...settings, default_quote_validity_days: parseInt(e.target.value, 10) || 7 })} data-testid="quote-validity-days-input" />
        </Field>
        <Field label="Invoice due (days)">
          <input type="number" min="1" max="365" className={fieldClass} value={settings.default_invoice_due_days ?? 14} onChange={(e) => setSettings({ ...settings, default_invoice_due_days: parseInt(e.target.value, 10) || 14 })} data-testid="invoice-due-days-input" />
        </Field>
        <Field label="VAT rate (%)">
          <input type="number" min="0" max="100" className={fieldClass} value={settings.default_tax_rate ?? 16} onChange={(e) => setSettings({ ...settings, default_tax_rate: parseFloat(e.target.value) || 0 })} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-4 max-w-md">
        <div>
          <p className="text-sm text-ink">Include VAT by default</p>
          <p className="text-xs text-ink-muted mt-0.5">New quotes start with VAT included.</p>
        </div>
        <Toggle checked={settings.default_include_vat !== false} onChange={(e) => setSettings({ ...settings, default_include_vat: e.target.checked })} />
      </div>
    </Section>
    <SaveButton onClick={onSave} loading={loading} testId="save-payment-settings-btn" />
  </div>
);

export const SettingsEmailFollowUps = ({ settings, setSettings, onSave, loading }) => (
  <div className="editorial-panel space-y-6">
    <Section title="Quote follow-ups" description="Remind a customer when a quote is still waiting on them.">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink">Send quote reminders</p>
        <Toggle
          testId="quote-followup-toggle"
          checked={settings.quote_followup_enabled}
          onChange={(e) => setSettings({ ...settings, quote_followup_enabled: e.target.checked })}
        />
      </div>
      {settings.quote_followup_enabled && (
        <Field label="Remind after (hours)" className="max-w-xs">
          <input
            type="number"
            min="1"
            max="168"
            className={fieldClass}
            value={settings.quote_followup_hours}
            onChange={(e) => setSettings({ ...settings, quote_followup_hours: parseInt(e.target.value, 10) || 24 })}
            data-testid="quote-followup-hours"
          />
        </Field>
      )}
    </Section>
    <Section title="Invoice reminders" description="Remind a customer before an invoice is due, then again if it stays unpaid.">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink">Send invoice reminders</p>
        <Toggle
          testId="invoice-followup-toggle"
          checked={settings.invoice_followup_enabled}
          onChange={(e) => setSettings({ ...settings, invoice_followup_enabled: e.target.checked })}
        />
      </div>
      {settings.invoice_followup_enabled && (
        <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
          <Field label="Remind before due (days)">
            <input type="number" min="1" max="30" className={fieldClass} value={settings.invoice_followup_days} onChange={(e) => setSettings({ ...settings, invoice_followup_days: parseInt(e.target.value, 10) || 7 })} />
          </Field>
          <Field label="Repeat when overdue (days)">
            <input type="number" min="1" max="14" className={fieldClass} value={settings.invoice_overdue_reminder_days} onChange={(e) => setSettings({ ...settings, invoice_overdue_reminder_days: parseInt(e.target.value, 10) || 3 })} />
          </Field>
        </div>
      )}
    </Section>
    <SaveButton onClick={onSave} loading={loading} testId="save-email-settings-btn" />
  </div>
);

const logLabel = (type) => String(type || 'general').replace(/_/g, ' ');

export const SettingsEmailLogs = ({ logs, loading, onRefresh }) => (
  <div className="bg-white/80 border border-ink/10 rounded-2xl overflow-hidden">
    <div className="px-5 py-4 border-b border-ink/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-ink">Sent email</h2>
        <p className="text-xs text-ink-muted mt-1">The latest follow-ups and reminders, newest first.</p>
      </div>
      <button type="button" onClick={onRefresh} disabled={loading} className="btn-secondary h-9 px-4 text-sm disabled:opacity-60">
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
    {loading && logs.length === 0 ? (
      <p className="px-5 py-8 text-sm text-ink-muted">Loading logs…</p>
    ) : logs.length === 0 ? (
      <p className="px-5 py-8 text-sm text-ink-muted">No email has been sent yet.</p>
    ) : (
      <div className="table-scroll">
        <table className="w-full text-sm" style={{ minWidth: '760px' }}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-ink/10">
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">To</th>
              <th className="px-5 py-3 font-medium">Subject</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {logs.map((log) => (
              <tr key={log.id || `${log.sent_at}-${log.subject}`} className="align-top">
                <td className="px-5 py-3.5 capitalize text-ink">{logLabel(log.type)}</td>
                <td className="px-5 py-3.5 text-ink-muted">{Array.isArray(log.to) ? log.to.join(', ') : log.to}</td>
                <td className="px-5 py-3.5">
                  <p className="text-ink">{log.subject || '—'}</p>
                  {log.error ? <p className="text-xs text-red-600 mt-1">{log.error}</p> : null}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium ${log.status === 'sent' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {log.status || '—'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">
                  {log.sent_at ? new Date(log.sent_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
