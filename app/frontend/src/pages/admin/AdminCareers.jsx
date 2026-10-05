import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { useConfirm } from '../../components/ConfirmProvider';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import { AdminFormModal } from '../../components/admin/AdminFormModal';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import {
  AdminPageHeader,
  AdminDataTable,
  AdminTableHead,
  AdminTableTh,
  AdminTableBody,
  AdminTableRow,
  AdminTableTd,
  AdminTableShell,
  AdminListMeta,
} from '../../components/admin/AdminPageHeader';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { formatDate } from '../../lib/utils';
import { downloadBlob } from '../../utils/csv';
import { sanitizeHtml } from '../../utils/richText';

const emptyForm = {
  title: '',
  department: '',
  location: 'Nairobi',
  employment_type: 'full-time',
  description: '',
  requirements: '',
  is_published: true,
};

const fieldClass = 'w-full h-10 px-3 border border-ink/15 bg-white text-sm text-ink';
const typeLabel = (value) => ({
  'full-time': 'Full time',
  'part-time': 'Part time',
  contract: 'Contract',
  internship: 'Internship',
}[value] || value);

export const AdminCareers = () => {
  const headers = getAdminHeader();
  const confirm = useConfirm();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [applicationsJob, setApplicationsJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/careers/jobs`, { headers });
      setJobs(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (job) => {
    setEditingId(job.id);
    setForm({
      title: job.title || '',
      department: job.department || '',
      location: job.location || '',
      employment_type: job.employment_type || 'full-time',
      description: job.description || '',
      requirements: job.requirements || '',
      is_published: job.is_published !== false,
    });
    setShowForm(true);
  };

  const saveJob = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        description: sanitizeHtml(form.description),
        requirements: sanitizeHtml(form.requirements),
      };
      if (editingId) {
        await axios.put(`${API_URL}/api/admin/careers/jobs/${editingId}`, payload, { headers });
        toast.success('Job updated');
      } else {
        await axios.post(`${API_URL}/api/admin/careers/jobs`, payload, { headers });
        toast.success('Job posted');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save job');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (job) => {
    try {
      await axios.put(`${API_URL}/api/admin/careers/jobs/${job.id}`, {
        ...job,
        is_published: !job.is_published,
      }, { headers });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update job');
    }
  };

  const removeJob = async (job) => {
    const ok = await confirm({
      title: 'Remove this job?',
      description: `“${job.title}” and its applications will be deleted.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/api/admin/careers/jobs/${job.id}`, { headers });
      toast.success('Job removed');
      if (applicationsJob?.id === job.id) setApplicationsJob(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not remove job');
    }
  };

  const openApplications = async (job) => {
    setApplicationsJob(job);
    setAppsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/careers/jobs/${job.id}/applications`, { headers });
      setApplications(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load applications');
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  };

  const setStatus = async (application, status) => {
    try {
      const res = await axios.patch(
        `${API_URL}/api/admin/careers/applications/${application.id}`,
        { status },
        { headers },
      );
      setApplications((rows) => rows.map((row) => (row.id === application.id ? res.data : row)));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update application');
    }
  };

  const downloadCv = async (application) => {
    try {
      const res = await axios.get(
        `${API_URL}/api/admin/careers/applications/${application.id}/cv`,
        { headers, responseType: 'blob' },
      );
      downloadBlob(res.data, application.cv_filename || 'cv.pdf');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not download CV');
    }
  };

  return (
    <div>
      <AdminPageHeader
        label="Administration"
        title="Careers"
        description="Publish job openings and review applications from the website."
        actions={(
          <button type="button" className="btn-primary h-10 px-4 text-sm gap-2" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            New job
          </button>
        )}
      />

      <AdminListMeta total={jobs.length} page={1} limit={jobs.length || 1} noun="jobs" />
      <AdminTableShell loading={loading} hasRows={jobs.length > 0} empty="No job posts yet.">
        <AdminDataTable minWidth={860}>
          <AdminTableHead>
            <AdminTableTh>Role</AdminTableTh>
            <AdminTableTh>Location</AdminTableTh>
            <AdminTableTh>Type</AdminTableTh>
            <AdminTableTh>Status</AdminTableTh>
            <AdminTableTh>Applications</AdminTableTh>
            <AdminTableTh>Posted</AdminTableTh>
            <AdminTableTh className="w-12" />
          </AdminTableHead>
          <AdminTableBody>
            {jobs.map((job) => (
              <AdminTableRow key={job.id}>
                <AdminTableTd>
                  <p className="font-medium text-ink">{job.title}</p>
                  {job.department ? <p className="text-xs text-ink-muted mt-0.5">{job.department}</p> : null}
                </AdminTableTd>
                <AdminTableTd nowrap>{job.location || '—'}</AdminTableTd>
                <AdminTableTd nowrap>{typeLabel(job.employment_type)}</AdminTableTd>
                <AdminTableTd nowrap>{job.is_published ? 'Published' : 'Hidden'}</AdminTableTd>
                <AdminTableTd nowrap>
                  <button
                    type="button"
                    className="text-brand font-medium hover:text-copper hover:underline"
                    onClick={() => openApplications(job)}
                  >
                    {job.application_count || 0}
                  </button>
                </AdminTableTd>
                <AdminTableTd nowrap>{formatDate(job.created_at)}</AdminTableTd>
                <AdminTableTd>
                  <RowActionsMenu
                    items={[
                      { label: 'Edit', onSelect: () => openEdit(job) },
                      { label: 'Applications', onSelect: () => openApplications(job) },
                      { label: job.is_published ? 'Unpublish' : 'Publish', onSelect: () => togglePublished(job) },
                      { label: 'Remove job', onSelect: () => removeJob(job) },
                    ]}
                  />
                </AdminTableTd>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
      </AdminTableShell>

      {applicationsJob && (
        <section className="mt-10">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="editorial-label mb-1">Applications</p>
              <h2 className="text-lg font-semibold text-ink">{applicationsJob.title}</h2>
            </div>
            <button type="button" className="text-xs text-ink-muted hover:text-ink" onClick={() => setApplicationsJob(null)}>
              Close
            </button>
          </div>
          {appsLoading ? (
            <p className="text-sm text-ink-muted">Loading applications…</p>
          ) : applications.length === 0 ? (
            <p className="text-sm text-ink-muted">No applications yet.</p>
          ) : (
            <AdminDataTable minWidth={920}>
              <AdminTableHead>
                <AdminTableTh>Applicant</AdminTableTh>
                <AdminTableTh>Contact</AdminTableTh>
                <AdminTableTh>Cover letter</AdminTableTh>
                <AdminTableTh>Status</AdminTableTh>
                <AdminTableTh>Received</AdminTableTh>
                <AdminTableTh className="w-12" />
              </AdminTableHead>
              <AdminTableBody>
                {applications.map((row) => (
                  <AdminTableRow key={row.id}>
                    <AdminTableTd>
                      <Link
                        to={`/sysadmin/careers/applications/${row.id}`}
                        className="font-semibold text-brand hover:text-copper hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.cv_filename ? <p className="text-xs text-ink-muted mt-0.5">{row.cv_filename}</p> : null}
                    </AdminTableTd>
                    <AdminTableTd>
                      <p>{row.email}</p>
                      {row.phone ? <p className="text-xs text-ink-muted mt-0.5">{row.phone}</p> : null}
                    </AdminTableTd>
                    <AdminTableTd>
                      <p className="text-sm text-ink-muted line-clamp-3 whitespace-pre-wrap">{row.cover_letter || '—'}</p>
                    </AdminTableTd>
                    <AdminTableTd nowrap className="capitalize">{row.status}</AdminTableTd>
                    <AdminTableTd nowrap>{formatDate(row.created_at)}</AdminTableTd>
                    <AdminTableTd>
                      <RowActionsMenu
                        items={[
                          { label: 'Open application', to: `/sysadmin/careers/applications/${row.id}` },
                          row.cv_url && { label: 'Download CV', onSelect: () => downloadCv(row) },
                          { label: 'Mark reviewed', onSelect: () => setStatus(row, 'reviewed') },
                          { label: 'Shortlist', onSelect: () => setStatus(row, 'shortlisted') },
                          { label: 'Reject', onSelect: () => setStatus(row, 'rejected') },
                        ]}
                      />
                    </AdminTableTd>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          )}
        </section>
      )}

      <AdminFormModal
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? 'Edit job' : 'New job'}
        description="Published jobs appear on the public Careers page."
        wide
      >
        <form onSubmit={saveJob} className="space-y-4 mt-4">
          <label className="block text-sm">
            <span className="block text-xs text-ink-muted mb-1.5">Title</span>
            <input required className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="block text-xs text-ink-muted mb-1.5">Department</span>
              <input className={fieldClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="block text-xs text-ink-muted mb-1.5">Location</span>
              <input className={fieldClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="block text-xs text-ink-muted mb-1.5">Employment type</span>
            <select className={fieldClass} value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
              <option value="full-time">Full time</option>
              <option value="part-time">Part time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </label>
          <div className="text-sm">
            <span className="block text-xs text-ink-muted mb-1.5">Description</span>
            <RichTextEditor
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
              placeholder="Describe the role…"
              label="Description"
            />
          </div>
          <div className="text-sm">
            <span className="block text-xs text-ink-muted mb-1.5">Requirements</span>
            <RichTextEditor
              value={form.requirements}
              onChange={(requirements) => setForm({ ...form, requirements })}
              placeholder="List what you look for…"
              label="Requirements"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
            Publish on the website
          </label>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-primary h-10 px-5 text-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </AdminFormModal>
    </div>
  );
};
