import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, getAdminUser } from '../../utils/adminAuth';
import { formatDateTime } from '../../lib/utils';
import {
  AdminLoadingState,
  AdminEmptyState,
  AdminDataTable,
  AdminTableHead,
  AdminTableTh,
  AdminTableBody,
  AdminTableRow,
  AdminTableTd,
} from '../../components/admin/AdminPageHeader';
import {
  FACILITY_TYPES,
  apiError,
  outsideLabel,
} from '../../components/admin/FieldDetailsForm';
import { VisitFormModal } from '../../components/admin/VisitFormModal';

const typeLabel = (value) => FACILITY_TYPES.find((type) => type.value === value)?.label || value || '—';

export const AdminFieldDetail = () => {
  const { prospectId } = useParams();
  const headers = getAdminHeader();
  const user = getAdminUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visitRequest, setVisitRequest] = useState(null);

  const load = () => {
    setLoading(true);
    axios.get(`${API_URL}/api/admin/field/prospects/${prospectId}`, { headers })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [prospectId]);

  if (loading) return <AdminLoadingState />;
  if (!data?.prospect) return <AdminEmptyState>Facility not found.</AdminEmptyState>;

  const prospect = data.prospect;
  const openVisit = data.openVisit;
  const dayClosed = Boolean(data.workday && data.workday.open === false);
  const isOwner = user?.role === 'sales' && user?.id === prospect.agentId;
  const marker = outsideLabel(user?.role);
  const visits = [...(data.visits || [])].sort(
    (a, b) => new Date(b.checkedInAt || 0) - new Date(a.checkedInAt || 0),
  );

  const checkOut = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/admin/field/visits/${openVisit.id}/check-out`, {}, { headers });
      toast.success('Visit ended');
      load();
    } catch (error) {
      toast.error(apiError(error, 'Check-out failed. The visit is still open.'));
    } finally {
      setSaving(false);
    }
  };

  const contactPhone = prospect.contactPhone || prospect.facilityPhone;
  const contactEmail = prospect.contactEmail || prospect.facilityEmail;
  const visitTotal = visits.length;

  return (
    <div className="w-full min-w-0">
      <Link to="/sysadmin/field" className="inline-flex items-center gap-2 text-sm text-copper hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to field
      </Link>
      <p className="editorial-label mb-2">Field</p>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold">{prospect.facilityName}</h1>
          <p className="text-sm text-ink-muted mt-1">
            {typeLabel(prospect.facilityType)} · {prospect.county || '—'}
            {' · '}
            {prospect.registered ? 'Registered' : 'Walk-in'}
          </p>
          {prospect.outsideTerritory ? <p className="text-xs text-copper mt-1">{marker}</p> : null}
          {!isOwner && prospect.agentName ? <p className="text-xs text-ink-muted mt-1">{prospect.agentName}</p> : null}
          {prospect.registered && prospect.organizationName ? (
            <p className="text-sm mt-2">
              Responsible for{' '}
              {user?.role === 'sales' ? prospect.organizationName : (
                <Link to={`/sysadmin/facilities/${prospect.organizationId}`} className="text-copper hover:underline">
                  {prospect.organizationName}
                </Link>
              )}
            </p>
          ) : null}
        </div>
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            {openVisit ? (
              <>
                <button
                  type="button"
                  onClick={() => setVisitRequest({ mode: 'edit', prospectId: prospect.id })}
                  className="h-9 px-4 text-sm border border-ink/15 rounded-lg"
                >
                  Edit visit
                </button>
                <button
                  type="button"
                  onClick={checkOut}
                  disabled={saving}
                  className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  End visit
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setVisitRequest({ mode: 'edit', prospectId: prospect.id })}
                  className="h-9 px-4 text-sm border border-ink/15 rounded-lg"
                >
                  Edit
                </button>
                {!dayClosed && (
                  <button
                    type="button"
                    onClick={() => setVisitRequest({ mode: 'create', prospectId: prospect.id })}
                    className="btn-primary h-9 px-4 text-sm"
                  >
                    Record a visit
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="editorial-panel p-5 mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <p><span className="block text-xs text-ink-muted mb-1">Name</span>{prospect.contactName || '—'}</p>
        <p><span className="block text-xs text-ink-muted mb-1">Role</span>{prospect.contactTitle || '—'}</p>
        <p><span className="block text-xs text-ink-muted mb-1">Phone</span>{contactPhone || '—'}</p>
        <p><span className="block text-xs text-ink-muted mb-1">Email</span>{contactEmail || '—'}</p>
      </div>

      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="text-lg font-semibold">Entries</h2>
        <p className="text-sm text-ink-muted tabular-nums">{visitTotal} {visitTotal === 1 ? 'visit' : 'visits'}</p>
      </div>
      {visits.length === 0 ? (
        <AdminEmptyState>No visits yet.</AdminEmptyState>
      ) : (
        <AdminDataTable minWidth={0}>
          <AdminTableHead>
            <AdminTableTh>Start</AdminTableTh>
            <AdminTableTh>End</AdminTableTh>
            <AdminTableTh>Contact</AdminTableTh>
            <AdminTableTh>Role</AdminTableTh>
            <AdminTableTh>Probability</AdminTableTh>
            <AdminTableTh>Notes</AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {visits.map((visit) => (
              <AdminTableRow key={visit.id}>
                <AdminTableTd nowrap>{formatDateTime(visit.checkedInAt)}</AdminTableTd>
                <AdminTableTd nowrap>{visit.checkedOutAt ? formatDateTime(visit.checkedOutAt) : 'Still open'}</AdminTableTd>
                <AdminTableTd nowrap>{visit.contactName || '—'}</AdminTableTd>
                <AdminTableTd nowrap>{visit.contactTitle || '—'}</AdminTableTd>
                <AdminTableTd nowrap>{visit.probabilityLabel || '—'}</AdminTableTd>
                <AdminTableTd className="w-full">
                  <span className="whitespace-pre-wrap">{visit.notes || '—'}</span>
                </AdminTableTd>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
      )}
      {isOwner && (
        <VisitFormModal
          open={Boolean(visitRequest)}
          mode={visitRequest?.mode || 'create'}
          prospectId={visitRequest?.prospectId || prospect.id}
          onOpenChange={(next) => { if (!next) setVisitRequest(null); }}
          onSaved={() => load()}
        />
      )}
    </div>
  );
};
