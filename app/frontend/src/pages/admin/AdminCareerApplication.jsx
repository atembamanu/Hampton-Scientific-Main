import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Download } from 'lucide-react';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { formatDateTime } from '../../lib/utils';
import { downloadBlob } from '../../utils/csv';
import { AdminEmptyState, AdminLoadingState } from '../../components/admin/AdminPageHeader';

const STATUS_LABELS = {
  new: 'New',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
};

const STATUS_ACTIONS = [
  { status: 'reviewed', label: 'Mark reviewed' },
  { status: 'shortlisted', label: 'Shortlist' },
  { status: 'rejected', label: 'Reject' },
];

export const AdminCareerApplication = () => {
  const { applicationId } = useParams();
  const headers = getAdminHeader();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await axios.get(`${API_URL}/api/admin/careers/applications/${applicationId}`, { headers });
    setApplication(res.data);
  };

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => setApplication(null))
      .finally(() => setLoading(false));
  }, [applicationId]);

  const setStatus = async (status) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await axios.patch(
        `${API_URL}/api/admin/careers/applications/${applicationId}`,
        { status },
        { headers },
      );
      setApplication(res.data);
      toast.success(`Marked as ${STATUS_LABELS[res.data.status] || status}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update application');
    } finally {
      setSaving(false);
    }
  };

  const downloadCv = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/admin/careers/applications/${applicationId}/cv`,
        { headers, responseType: 'blob' },
      );
      downloadBlob(res.data, application?.cv_filename || 'cv.pdf');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not download CV');
    }
  };

  if (loading) return <AdminLoadingState />;
  if (!application) return <AdminEmptyState>Application not found.</AdminEmptyState>;

  const statusLabel = STATUS_LABELS[application.status] || application.status;

  return (
    <div className="w-full min-w-0">
      <Link to="/sysadmin/careers" className="inline-flex items-center gap-2 text-sm text-copper hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to careers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="editorial-label mb-1">Application</p>
          <h1 className="text-2xl font-bold text-ink tracking-tight">{application.name}</h1>
          <p className="text-sm text-ink-muted mt-1">
            {application.job_title || 'Open role'}
            {application.created_at ? ` · Received ${formatDateTime(application.created_at)}` : ''}
          </p>
        </div>
        <span className="inline-flex items-center h-8 px-3 text-xs font-medium border border-ink/15 bg-white capitalize">
          {statusLabel}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 editorial-panel space-y-5">
          <div>
            <p className="editorial-label mb-2">Cover letter</p>
            {application.cover_letter ? (
              <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{application.cover_letter}</p>
            ) : (
              <p className="text-sm text-ink-muted">No cover letter was included.</p>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="editorial-panel space-y-3">
            <p className="editorial-label">Applicant</p>
            <p className="text-sm text-ink">{application.email}</p>
            {application.phone ? <p className="text-sm text-ink-muted">{application.phone}</p> : null}
            {application.cv_url ? (
              <button
                type="button"
                onClick={downloadCv}
                className="btn-store-outline h-9 px-3 text-sm inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {application.cv_filename || 'Download CV'}
              </button>
            ) : (
              <p className="text-sm text-ink-muted">No CV uploaded.</p>
            )}
          </section>

          <section className="editorial-panel space-y-2">
            <p className="editorial-label mb-3">Update status</p>
            {STATUS_ACTIONS.map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={saving || application.status === action.status}
                onClick={() => setStatus(action.status)}
                className="form-field w-full h-9 px-3 text-sm border border-ink/15 bg-white text-left disabled:opacity-40"
              >
                {action.label}
              </button>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
};
