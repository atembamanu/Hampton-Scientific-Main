import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, getAdminUser, hasCompanyPermission } from '../../utils/adminAuth';
import { useConfirm } from '../../components/ConfirmProvider';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import { BranchFormModal, FacilityEditModal, FacilityUserFormModal } from '../../components/admin/AdminFacilityModals';
import { OpsStatusBadge } from '../../components/admin/OpsStatusBadge';
import { formatPrice, documentTax, documentNet } from '../../utils/pricing';
import { formatDateTime } from '../../lib/utils';
import { invoiceDisplayStatus } from '../../utils/invoiceStatus';
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminFilterInput,
  AdminResetFilters,
  AdminDataTable,
  AdminTableHead,
  AdminTableTh,
  AdminTableBody,
  AdminTableRow,
  AdminTableTd,
  AdminEmptyState,
  AdminLoadingState,
} from '../../components/admin/AdminPageHeader';
import { SheetTabs } from '../../components/ui/SheetTabs';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'branches', label: 'Branches' },
  { id: 'users', label: 'Users' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'invoices', label: 'Invoices' },
];

const TYPE_LABELS = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  pharmacy: 'Pharmacy',
  laboratory: 'Laboratory',
  medical_centre: 'Medical Centre',
  ngo: 'NGO',
  other: 'Other',
};

const ROLE_LABELS = {
  org_admin: 'Facility Admin',
  branch_admin: 'Branch Manager',
  branch_user: 'Branch personnel',
};

const matchesQuery = (query, values) => {
  if (!query) return true;
  const q = query.toLowerCase();
  return values.some((value) => String(value || '').toLowerCase().includes(q));
};

const StatCard = ({ label, value, hint }) => (
  <div className="editorial-panel p-5">
    <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-copper">{label}</p>
    <p className="text-2xl font-semibold tabular-nums mt-2 text-ink">{value}</p>
    {hint ? <p className="text-xs text-ink-muted mt-1">{hint}</p> : null}
  </div>
);

export const AdminCustomerDetail = () => {
  const { orgId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fieldAgents, setFieldAgents] = useState([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState([]);
  const [linking, setLinking] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [branchForm, setBranchForm] = useState(null);
  const [userForm, setUserForm] = useState(null);
  const [counties, setCounties] = useState([]);
  const canLinkField = hasCompanyPermission(getAdminUser(), 'company_users');
  const confirm = useConfirm();
  const tab = TABS.some((t) => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API_URL}/api/admin/ops/organizations/${orgId}`, { headers: getAdminHeader() })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const loadFieldAgents = useCallback(() => {
    axios.get(`${API_URL}/api/admin/field/organizations/${orgId}/agents`, { headers: getAdminHeader() })
      .then((res) => setFieldAgents(res.data.agents || []))
      .catch(() => setFieldAgents([]));
  }, [orgId]);

  useEffect(() => { loadFieldAgents(); }, [loadFieldAgents]);

  useEffect(() => {
    axios.get(`${API_URL}/api/admin/field/counties`, { headers: getAdminHeader() })
      .then((res) => setCounties(res.data.counties || []))
      .catch(() => setCounties([]));
  }, []);

  const searchFieldRecords = () => {
    const term = linkSearch.trim();
    if (!term) {
      setLinkResults([]);
      return;
    }
    axios.get(`${API_URL}/api/admin/field/prospects`, {
      headers: getAdminHeader(),
      params: { search: term, limit: 10 },
    })
      .then((res) => setLinkResults(res.data.prospects || []))
      .catch(() => setLinkResults([]));
  };

  const linkFieldRecord = async (prospectId) => {
    setLinking(true);
    try {
      await axios.put(
        `${API_URL}/api/admin/field/prospects/${prospectId}/organization`,
        { organizationId: orgId },
        { headers: getAdminHeader() },
      );
      setLinkSearch('');
      setLinkResults([]);
      loadFieldAgents();
    } catch (err) {
      setLinkResults((current) => current.map((row) => (
        row.id === prospectId ? { ...row, linkError: err.response?.data?.detail || 'Could not link this record.' } : row
      )));
    } finally {
      setLinking(false);
    }
  };

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
    setSearch('');
  };

  const deactivateBranch = async (branch) => {
    const approved = await confirm({
      label: 'Deactivate branch',
      title: `Deactivate ${branch.name}?`,
      description: 'The main branch cannot be deactivated. Other branches stay on past quotes and invoices.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (!approved) return;
    try {
      await axios.post(`${API_URL}/api/admin/ops/organizations/${orgId}/branches/${branch.id}/deactivate`, {}, { headers: getAdminHeader() });
      toast.success('Branch deactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not deactivate this branch');
    }
  };

  const deactivateUser = async (member) => {
    const approved = await confirm({
      label: 'Deactivate user',
      title: `Deactivate ${member.firstName} ${member.lastName}?`,
      description: 'They will not be able to sign in until you edit them and turn access back on.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (!approved) return;
    try {
      await axios.post(`${API_URL}/api/admin/ops/organizations/${orgId}/users/${member.id}/deactivate`, {}, { headers: getAdminHeader() });
      toast.success('User deactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not deactivate this user');
    }
  };

  const reactivateUser = async (member) => {
    try {
      await axios.put(
        `${API_URL}/api/admin/ops/organizations/${orgId}/users/${member.id}`,
        { canLogin: true },
        { headers: getAdminHeader() },
      );
      toast.success('User reactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not reactivate this user');
    }
  };

  const org = data?.organization;
  const summary = data?.summary || {};
  const branches = data?.branches || [];
  const users = data?.users || [];
  const quotes = data?.quotes || [];
  const invoices = data?.invoices || [];

  const filteredBranches = useMemo(
    () => branches.filter((b) => matchesQuery(search, [b.name, b.branchCode, b.county, b.physicalAddress, b.phone])),
    [branches, search],
  );
  const filteredUsers = useMemo(
    () => users.filter((u) => matchesQuery(search, [
      u.firstName, u.lastName, u.email, u.phone, u.role, u.jobTitle,
      ...(u.branches || []).map((b) => b.name),
    ])),
    [users, search],
  );
  const filteredQuotes = useMemo(
    () => quotes.filter((q) => matchesQuery(search, [q.quote_number, q.requested_by, q.branch_name, q.ops_status])),
    [quotes, search],
  );
  const filteredInvoices = useMemo(
    () => invoices.filter((inv) => matchesQuery(search, [inv.invoice_number, inv.contact_person, inv.branch_name, inv.status])),
    [invoices, search],
  );

  if (loading) return <AdminLoadingState />;
  if (!org) return <AdminEmptyState>Facility not found.</AdminEmptyState>;

  return (
    <div className="w-full">
      <Link to="/sysadmin/facilities" className="inline-flex items-center gap-2 text-sm text-copper hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to facilities
      </Link>

      <AdminPageHeader
        title={org.name}
        label="Facility"
        description={`${TYPE_LABELS[org.facilityType] || org.facilityType} · ${org.email || '—'} · ${org.phone || '—'}${org.addressLine ? ` · ${org.addressLine}` : ''}`}
        actions={(
          <button type="button" onClick={() => setEditOpen(true)} className="h-9 px-4 text-sm border border-ink/15 rounded-lg">
            Edit facility
          </button>
        )}
      />

      <div className="mb-6">
        <SheetTabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Branches" value={summary.branchCount ?? branches.length} />
            <StatCard label="Users" value={summary.userCount ?? users.length} />
            <StatCard
              label="Quotes"
              value={summary.quoteCount ?? quotes.length}
              hint={formatPrice(summary.quoteTotal)}
            />
            <StatCard
              label="Invoices"
              value={summary.invoiceCount ?? invoices.length}
              hint={formatPrice(summary.invoiceTotal)}
            />
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatCard label="Quote total" value={formatPrice(summary.quoteTotal)} />
            <StatCard label="Invoice total" value={formatPrice(summary.invoiceTotal)} hint={`${formatPrice(summary.invoicePaidTotal)} paid`} />
            <StatCard label="Outstanding" value={formatPrice(summary.invoiceOutstanding)} />
          </div>
          <div className="editorial-panel p-5 text-sm space-y-1">
            <p><span className="text-ink-muted">Type:</span> {TYPE_LABELS[org.facilityType] || org.facilityType}</p>
            <p><span className="text-ink-muted">County:</span> {org.county || '—'}</p>
            <p><span className="text-ink-muted">Registration:</span> {org.registrationNumber || '—'}</p>
            <p><span className="text-ink-muted">Tax / PIN:</span> {org.taxNumber || '—'}</p>
            <p><span className="text-ink-muted">Registered by:</span> {data?.registeredBy?.name || 'Facility self-registration'}</p>
          </div>
          <div className="editorial-panel p-5 text-sm space-y-3">
            <p className="text-xs uppercase tracking-[0.14em] text-copper font-semibold">Responsible sales agents</p>
            {fieldAgents.length === 0 ? (
              <p className="text-ink-muted">No sales agent has this facility in their book yet.</p>
            ) : (
              <ul className="space-y-2">
                {fieldAgents.map((agent) => (
                  <li key={agent.prospectId} className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link to={`/sysadmin/field/${agent.prospectId}`} className="text-copper hover:underline">
                      {agent.agentName}
                    </Link>
                    <span className="text-ink-muted">
                      {agent.visitCount} {agent.visitCount === 1 ? 'visit' : 'visits'}
                      {agent.lastVisitedAt ? ` · last ${formatDateTime(agent.lastVisitedAt)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canLinkField && (
              <div className="pt-2 space-y-2">
                <p className="text-ink-muted">Link an existing visit record. The timeline and visit count stay as they are.</p>
                <div className="flex gap-2">
                  <input
                    value={linkSearch}
                    onChange={(event) => setLinkSearch(event.target.value)}
                    placeholder="Search an agent's facility"
                    className="flex-1 h-10 px-3 border border-ink/15 rounded-lg text-sm"
                  />
                  <button type="button" onClick={searchFieldRecords} className="h-10 px-3 border border-ink/15 rounded-lg text-sm">
                    Search
                  </button>
                </div>
                {linkResults.length > 0 && (
                  <ul className="border border-ink/10 rounded-lg divide-y divide-ink/10">
                    {linkResults.map((row) => (
                      <li key={row.id} className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="font-medium">{row.facilityName}</span>
                            <span className="block text-xs text-ink-muted">{row.agentName} · {row.county} · {row.visitCount} visits</span>
                          </span>
                          <button
                            type="button"
                            disabled={linking || row.organizationId === orgId}
                            onClick={() => linkFieldRecord(row.id)}
                            className="text-xs text-copper hover:underline disabled:opacity-60"
                          >
                            {row.organizationId === orgId ? 'Linked' : 'Link'}
                          </button>
                        </div>
                        {row.linkError ? <p className="text-xs text-red-600 mt-1">{row.linkError}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'branches' && (
        <>
          <AdminFilterBar>
            <AdminFilterInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search branches…" className="w-full" />
            <AdminResetFilters disabled={!search.trim()} onReset={() => setSearch('')} />
            <button type="button" onClick={() => setBranchForm({})} className="btn-primary inline-flex items-center gap-2 h-10 px-4 text-sm">
              <Plus className="w-4 h-4" /> Add branch
            </button>
          </AdminFilterBar>
          {filteredBranches.length === 0 ? (
            <AdminEmptyState>No branches for this facility.</AdminEmptyState>
          ) : (
            <AdminDataTable minWidth={900}>
              <AdminTableHead>
                <AdminTableTh>Branch</AdminTableTh>
                <AdminTableTh>Code</AdminTableTh>
                <AdminTableTh>County</AdminTableTh>
                <AdminTableTh>Contact</AdminTableTh>
                <AdminTableTh>Address</AdminTableTh>
                <AdminTableTh>Status</AdminTableTh>
                <AdminTableTh className="text-right"> </AdminTableTh>
              </AdminTableHead>
              <AdminTableBody>
                {filteredBranches.map((b) => (
                  <AdminTableRow key={b.id}>
                    <AdminTableTd>
                      <button type="button" onClick={() => setBranchForm(b)} className="font-medium text-left hover:text-copper hover:underline">{b.name}</button>
                      {b.isMain ? <p className="text-xs text-copper">Main</p> : null}
                    </AdminTableTd>
                    <AdminTableTd nowrap className="text-ink-muted">{b.branchCode || '—'}</AdminTableTd>
                    <AdminTableTd nowrap className="text-ink-muted">{b.county || '—'}</AdminTableTd>
                    <AdminTableTd>
                      <p>{b.phone || '—'}</p>
                      <p className="text-xs text-ink-muted">{b.email || ''}</p>
                    </AdminTableTd>
                    <AdminTableTd className="text-ink-muted">{b.physicalAddress || '—'}</AdminTableTd>
                    <AdminTableTd nowrap className="capitalize text-ink-muted">{b.status || 'active'}</AdminTableTd>
                    <AdminTableTd className="text-right">
                      <RowActionsMenu
                        label={`Actions for ${b.name}`}
                        items={[
                          { label: 'Edit branch', onSelect: () => setBranchForm(b) },
                          b.status !== 'inactive' && !b.isMain ? { label: 'Deactivate branch', onSelect: () => deactivateBranch(b) } : null,
                        ]}
                      />
                    </AdminTableTd>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          )}
        </>
      )}

      {tab === 'users' && (
        <>
          <AdminFilterBar>
            <AdminFilterInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className="w-full" />
            <AdminResetFilters disabled={!search.trim()} onReset={() => setSearch('')} />
            <button type="button" onClick={() => setUserForm({})} className="btn-primary inline-flex items-center gap-2 h-10 px-4 text-sm">
              <Plus className="w-4 h-4" /> Add user
            </button>
          </AdminFilterBar>
          {filteredUsers.length === 0 ? (
            <AdminEmptyState>No users for this facility.</AdminEmptyState>
          ) : (
            <AdminDataTable minWidth={980}>
              <AdminTableHead>
                <AdminTableTh>Name</AdminTableTh>
                <AdminTableTh>Role</AdminTableTh>
                <AdminTableTh>Contact</AdminTableTh>
                <AdminTableTh>Branches</AdminTableTh>
                <AdminTableTh>Access</AdminTableTh>
                <AdminTableTh className="text-right"> </AdminTableTh>
              </AdminTableHead>
              <AdminTableBody>
                {filteredUsers.map((u) => (
                  <AdminTableRow key={u.id}>
                    <AdminTableTd>
                      <button type="button" onClick={() => setUserForm(u)} className="font-medium text-left hover:text-copper hover:underline">{u.firstName} {u.lastName}</button>
                      <p className="text-xs text-ink-muted">{u.jobTitle || '—'}</p>
                    </AdminTableTd>
                    <AdminTableTd nowrap>{ROLE_LABELS[u.role] || u.role?.replace(/_/g, ' ')}</AdminTableTd>
                    <AdminTableTd>
                      <p className="truncate max-w-[220px]">{u.email}</p>
                      <p className="text-xs text-ink-muted">{u.phone}</p>
                    </AdminTableTd>
                    <AdminTableTd className="text-ink-muted">
                      {(u.branches || []).length
                        ? u.branches.map((b) => b.isPrimary ? `${b.name} (primary)` : b.name).join(', ')
                        : '—'}
                    </AdminTableTd>
                    <AdminTableTd nowrap>{u.canLogin === false ? 'Disabled' : 'Active'}</AdminTableTd>
                    <AdminTableTd className="text-right">
                      <RowActionsMenu
                        label={`Actions for ${u.firstName}`}
                        items={[
                          { label: 'Edit user', onSelect: () => setUserForm(u) },
                          u.canLogin === false
                            ? { label: 'Reactivate user', onSelect: () => reactivateUser(u) }
                            : { label: 'Deactivate user', onSelect: () => deactivateUser(u) },
                        ]}
                      />
                    </AdminTableTd>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          )}
        </>
      )}

      {tab === 'quotes' && (
        <>
          <AdminFilterBar>
            <AdminFilterInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotes…" className="w-full" />
            <AdminResetFilters disabled={!search.trim()} onReset={() => setSearch('')} />
          </AdminFilterBar>
          {filteredQuotes.length === 0 ? (
            <AdminEmptyState>No quotes for this facility.</AdminEmptyState>
          ) : (
            <AdminDataTable minWidth={1000}>
              <AdminTableHead>
                <AdminTableTh>Quote</AdminTableTh>
                <AdminTableTh>Branch</AdminTableTh>
                <AdminTableTh>Requested by</AdminTableTh>
                <AdminTableTh>Items</AdminTableTh>
                <AdminTableTh>Total</AdminTableTh>
                <AdminTableTh>Submitted</AdminTableTh>
                <AdminTableTh>Status</AdminTableTh>
              </AdminTableHead>
              <AdminTableBody>
                {filteredQuotes.map((q) => (
                  <AdminTableRow key={q.id}>
                    <AdminTableTd nowrap>
                      <Link to={`/sysadmin/quotes/${q.id}`} className="font-semibold text-brand hover:text-copper hover:underline">
                        {q.quote_number || q.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </AdminTableTd>
                    <AdminTableTd nowrap className="text-ink-muted">{q.branch_name || '—'}</AdminTableTd>
                    <AdminTableTd className="truncate max-w-[200px]">{q.requested_by || '—'}</AdminTableTd>
                    <AdminTableTd nowrap>{q.item_count}</AdminTableTd>
                    <AdminTableTd nowrap>{formatPrice(q.total)}</AdminTableTd>
                    <AdminTableTd nowrap className="text-ink-muted">{formatDateTime(q.created_at)}</AdminTableTd>
                    <AdminTableTd nowrap><OpsStatusBadge status={q.ops_status} /></AdminTableTd>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          )}
        </>
      )}

      {tab === 'invoices' && (
        <>
          <AdminFilterBar>
            <AdminFilterInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices…" className="w-full" />
            <AdminResetFilters disabled={!search.trim()} onReset={() => setSearch('')} />
          </AdminFilterBar>
          {filteredInvoices.length === 0 ? (
            <AdminEmptyState>No invoices for this facility.</AdminEmptyState>
          ) : (
            <AdminDataTable minWidth={1100}>
              <AdminTableHead>
                <AdminTableTh>Invoice</AdminTableTh>
                <AdminTableTh>Branch</AdminTableTh>
                <AdminTableTh>Contact</AdminTableTh>
                <AdminTableTh>Total</AdminTableTh>
                <AdminTableTh>Tax</AdminTableTh>
                <AdminTableTh>Net</AdminTableTh>
                <AdminTableTh>Issued</AdminTableTh>
                <AdminTableTh>Status</AdminTableTh>
              </AdminTableHead>
              <AdminTableBody>
                {filteredInvoices.map((inv) => (
                  <AdminTableRow key={inv.id}>
                    <AdminTableTd nowrap>
                      <Link to={`/sysadmin/invoices/${inv.id}`} className="font-semibold text-brand hover:text-copper hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </AdminTableTd>
                    <AdminTableTd nowrap className="text-ink-muted">{inv.branch_name || '—'}</AdminTableTd>
                    <AdminTableTd className="truncate max-w-[200px]">{inv.contact_person || '—'}</AdminTableTd>
                    <AdminTableTd nowrap>{formatPrice(inv.total)}</AdminTableTd>
                    <AdminTableTd nowrap>{formatPrice(documentTax(inv))}</AdminTableTd>
                    <AdminTableTd nowrap>{formatPrice(documentNet(inv))}</AdminTableTd>
                    <AdminTableTd nowrap className="text-ink-muted">{formatDateTime(inv.created_at)}</AdminTableTd>
                    <AdminTableTd nowrap><OpsStatusBadge status={invoiceDisplayStatus(inv)} /></AdminTableTd>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          )}
        </>
      )}
      <FacilityEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        org={org}
        registeredBy={data?.registeredBy}
        onSaved={load}
      />
      <BranchFormModal
        open={Boolean(branchForm)}
        onOpenChange={(open) => { if (!open) setBranchForm(null); }}
        orgId={orgId}
        branch={branchForm?.id ? branchForm : null}
        counties={counties}
        onSaved={load}
      />
      <FacilityUserFormModal
        open={Boolean(userForm)}
        onOpenChange={(open) => { if (!open) setUserForm(null); }}
        orgId={orgId}
        user={userForm?.id ? userForm : null}
        branches={branches}
        onSaved={load}
      />
    </div>
  );
};
