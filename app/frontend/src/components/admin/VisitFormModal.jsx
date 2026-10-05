import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { AdminFormModal } from './AdminFormModal';
import {
  FieldDetailsForm,
  apiError,
  emptyVisitForm,
  formFromRecord,
  visitPayload,
} from './FieldDetailsForm';

export const VisitFormModal = ({ open, onOpenChange, mode = 'create', prospectId = null, onSaved }) => {
  const headers = getAdminHeader();
  const [counties, setCounties] = useState([]);
  const [form, setForm] = useState(emptyVisitForm);
  const [openVisitId, setOpenVisitId] = useState(null);
  const [currentVisit, setCurrentVisit] = useState(null);
  const [orgQuery, setOrgQuery] = useState('');
  const [orgResults, setOrgResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const debouncedOrg = useDebouncedValue(orgQuery, 300);
  const editing = mode === 'edit';

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setReady(false);
    setForm({ ...emptyVisitForm });
    setOpenVisitId(null);
    setCurrentVisit(null);
    setOrgQuery('');
    setOrgResults([]);
    setSaving(false);

    const countiesRequest = axios.get(`${API_URL}/api/admin/field/counties`, { headers })
      .then((res) => {
        if (!cancelled) setCounties(res.data.counties || []);
      })
      .catch(() => {
        if (!cancelled) setCounties([]);
      });

    const load = async () => {
      await countiesRequest;
      if (cancelled) return;
      if (!editing) {
        const list = await axios.get(`${API_URL}/api/admin/field/prospects`, { headers, params: { page: 1, limit: 1 } });
        if (cancelled) return;
        if (list.data.workday && list.data.workday.open === false) {
          toast.message('You have already checked out for today.');
          onOpenChange(false);
          return;
        }
        const busy = list.data.openVisit;
        if (busy) {
          setCurrentVisit(busy);
          setReady(true);
          return;
        }
      }
      if (editing || prospectId) {
        const res = await axios.get(`${API_URL}/api/admin/field/prospects/${prospectId}`, { headers });
        if (cancelled) return;
        const record = res.data.prospect || {};
        const current = res.data.current || record;
        setForm({
          ...formFromRecord(current),
          organizationId: record.organizationId || '',
        });
        setOpenVisitId(editing ? (res.data.openVisit?.id || null) : null);
        setReady(true);
        return;
      }
      setReady(true);
    };

    load().catch(() => {
      if (cancelled) return;
      toast.error('Could not open this form.');
      onOpenChange(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, editing, prospectId]);

  useEffect(() => {
    if (!open || editing || prospectId || !debouncedOrg.trim()) {
      setOrgResults([]);
      return;
    }
    axios.get(`${API_URL}/api/admin/field/organizations`, {
      headers,
      params: { search: debouncedOrg.trim() },
    })
      .then((res) => setOrgResults(res.data.organizations || []))
      .catch(() => setOrgResults([]));
  }, [open, debouncedOrg, editing, prospectId]);

  const chooseOrg = (org) => {
    setForm((current) => ({
      ...current,
      organizationId: org.id,
      facilityName: org.name || current.facilityName,
      facilityType: org.facilityType || current.facilityType,
      county: counties.includes(org.county) ? org.county : current.county,
      address: org.addressLine || current.address,
      facilityPhone: org.phone || current.facilityPhone,
      facilityEmail: org.email || current.facilityEmail,
    }));
    setOrgQuery(org.name || '');
    setOrgResults([]);
  };

  const persist = async () => {
    const payload = visitPayload(form);
    if (editing && openVisitId) {
      await axios.patch(`${API_URL}/api/admin/field/visits/${openVisitId}`, payload, { headers });
      return null;
    }
    if (editing) {
      await axios.patch(`${API_URL}/api/admin/field/prospects/${prospectId}`, payload, { headers });
      return null;
    }
    const res = await axios.post(`${API_URL}/api/admin/field/check-in`, {
      ...payload,
      organizationId: form.organizationId || null,
      prospectId: prospectId || null,
    }, { headers });
    return res.data?.prospectId || null;
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const createdId = await persist();
      toast.success(editing ? 'Record saved' : 'Visit started');
      onOpenChange(false);
      onSaved?.(createdId);
    } catch (error) {
      toast.error(apiError(error, editing ? 'Could not save this record.' : 'Check-in failed.'));
    } finally {
      setSaving(false);
    }
  };

  const endVisit = async () => {
    if (!openVisitId) return;
    setSaving(true);
    try {
      await axios.patch(`${API_URL}/api/admin/field/visits/${openVisitId}`, visitPayload(form), { headers });
      await axios.post(`${API_URL}/api/admin/field/visits/${openVisitId}/check-out`, {}, { headers });
      toast.success('Visit ended');
      onOpenChange(false);
      onSaved?.(prospectId);
    } catch (error) {
      toast.error(apiError(error, 'Check-out failed. The visit is still open.'));
    } finally {
      setSaving(false);
    }
  };

  const endCurrentAndContinue = async () => {
    if (!currentVisit?.id) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/admin/field/visits/${currentVisit.id}/check-out`, {}, { headers });
      if (prospectId) {
        const res = await axios.get(`${API_URL}/api/admin/field/prospects/${prospectId}`, { headers });
        const record = res.data.prospect || {};
        setForm({
          ...formFromRecord(res.data.current || record),
          organizationId: record.organizationId || '',
        });
      } else {
        setForm({ ...emptyVisitForm });
      }
      const endedProspectId = currentVisit.prospectId;
      setCurrentVisit(null);
      toast.success('Current visit ended. You can now start the next visit.');
      onSaved?.(endedProspectId);
    } catch (error) {
      toast.error(apiError(error, 'Could not end the current visit.'));
    } finally {
      setSaving(false);
    }
  };

  const title = currentVisit
    ? 'A visit is already in progress'
    : editing
    ? (openVisitId ? 'Edit visit' : 'Edit facility')
    : (prospectId ? 'Record another visit' : 'Record a visit');
  const description = currentVisit
    ? `End the visit at ${currentVisit.facilityName || 'the current facility'} before starting another, or close this window to keep it open.`
    : editing
    ? (openVisitId
      ? 'Update this open visit. Ending it records the end time.'
      : 'Updates this facility and the latest entry. Earlier visits stay as they were.')
    : 'The first visit or registration of the day starts your timesheet. Later visits stay on this facility’s timeline.';

  return (
    <AdminFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="max-w-5xl"
    >
      {!ready ? (
        <div className="flex items-center gap-2 text-sm text-ink-muted py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading
        </div>
      ) : currentVisit ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-ink/10 bg-cream/40 p-4">
            <p className="text-sm font-medium text-ink">{currentVisit.facilityName || 'Current facility'}</p>
            <p className="text-xs text-ink-muted mt-1">
              This visit is still open. Its recorded details will be kept when you end it.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-9 px-4 text-sm border border-ink/15 rounded-lg disabled:opacity-60"
            >
              Close
            </button>
            <button
              type="button"
              onClick={endCurrentAndContinue}
              disabled={saving}
              className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              End current visit &amp; continue
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {!editing && !prospectId && (
            <div className="text-sm">
              <span className="block text-xs text-ink-muted mb-1">Registered facility (optional)</span>
              <input
                value={orgQuery}
                onChange={(event) => setOrgQuery(event.target.value)}
                placeholder="Search name, county, or phone"
                className="w-full h-10 px-3 border border-ink/15 rounded-lg text-sm"
              />
              {form.organizationId && (
                <p className="text-xs text-copper mt-1">Linked to a registered facility. This stays in your book after they are onboarded.</p>
              )}
              {orgResults.length > 0 && (
                <ul className="mt-2 border border-ink/10 rounded-lg divide-y divide-ink/10 max-h-40 overflow-y-auto">
                  {orgResults.map((org) => (
                    <li key={org.id}>
                      <button type="button" onClick={() => chooseOrg(org)} className="w-full text-left px-3 py-2 text-sm hover:bg-ink/5">
                        <span className="font-medium">{org.name}</span>
                        <span className="block text-xs text-ink-muted">{org.county || 'No county'} · {org.phone || 'No phone'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <FieldDetailsForm value={form} onChange={setForm} counties={counties} />
          <div className="flex flex-wrap justify-end gap-2">
            {editing && openVisitId && (
              <button type="button" onClick={endVisit} disabled={saving} className="h-9 px-4 text-sm border border-ink/15 rounded-lg disabled:opacity-60">
                End visit
              </button>
            )}
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Save' : 'Start visit'}
            </button>
          </div>
        </form>
      )}
    </AdminFormModal>
  );
};
