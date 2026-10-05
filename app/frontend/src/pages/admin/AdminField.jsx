import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader, getAdminUser } from '../../utils/adminAuth';
import { formatDateTime } from '../../lib/utils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { FACILITY_TYPES, outsideLabel } from '../../components/admin/FieldDetailsForm';
import { VisitFormModal } from '../../components/admin/VisitFormModal';
import { RegisterFacilityModal } from '../../components/admin/RegisterFacilityModal';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import { useConfirm } from '../../components/ConfirmProvider';
import { FilterDateRange } from '../../components/FilterDateRange';
import { SheetTabs } from '../../components/ui/SheetTabs';
import {
  AdminFilterBar,
  AdminFilterInput,
  AdminMultiSelect,
  AdminResetFilters,
  AdminDataTable,
  AdminTableHead,
  AdminTableTh,
  AdminTableBody,
  AdminTableRow,
  AdminTableTd,
  AdminEmptyState,
  AdminLoadingState,
  AdminListMeta,
  AdminPager,
} from '../../components/admin/AdminPageHeader';

const typeLabel = (value) => FACILITY_TYPES.find((type) => type.value === value)?.label || value || '—';

const quoteClientFromRow = (row) => ({
  organizationId: row.organizationId || '',
  facilityName: row.facilityName || '',
  contactPerson: row.contactName || '',
  email: row.contactEmail || row.facilityEmail || '',
  phone: row.contactPhone || row.facilityPhone || '',
  address: row.address || '',
});

export const AdminField = () => {
  const headers = getAdminHeader();
  const user = getAdminUser();
  const isSales = user?.role === 'sales';
  const isAdmin = user?.role === 'admin';
  const confirm = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [countiesFilter, setCountiesFilter] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [agentIds, setAgentIds] = useState([]);
  const [counties, setCounties] = useState([]);
  const [agents, setAgents] = useState([]);
  const [assignedCounties, setAssignedCounties] = useState([]);
  const [openVisit, setOpenVisit] = useState(null);
  const [workday, setWorkday] = useState(null);
  const [sheet, setSheet] = useState('visits');
  const [timesheet, setTimesheet] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sheetAgents, setSheetAgents] = useState([]);
  const [sheetFrom, setSheetFrom] = useState('');
  const [sheetTo, setSheetTo] = useState('');
  const [sheetReloadToken, setSheetReloadToken] = useState(0);
  const [visitRequest, setVisitRequest] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerSource, setRegisterSource] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    const request = location.state?.visitForm;
    const register = location.state?.registerFacility;
    if (!isSales || (!request && !register)) return;
    if (request) setVisitRequest(request);
    if (register) {
      setRegisterSource(null);
      setRegisterOpen(true);
    }
    navigate('/sysadmin/field', { replace: true, state: null });
  }, [location.state, isSales, navigate]);

  useEffect(() => {
    axios.get(`${API_URL}/api/admin/field/counties`, { headers })
      .then((res) => setCounties(res.data.counties || []))
      .catch(() => setCounties([]));
    if (!isSales) {
      axios.get(`${API_URL}/api/admin/field/agents`, { headers })
        .then((res) => setAgents(res.data.agents || []))
        .catch(() => setAgents([]));
    }
  }, [isSales]);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (countiesFilter.length) params.county = countiesFilter.join(',');
    if (kinds.length) params.registered = kinds.join(',');
    if (!isSales && agentIds.length) params.agent_id = agentIds.join(',');
    if (dateFrom) params.from_date = dateFrom;
    if (dateTo) params.to_date = dateTo;
    axios.get(`${API_URL}/api/admin/field/prospects`, { headers, params })
      .then((res) => {
        setRows(res.data.prospects || res.data.items || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
        setAssignedCounties(res.data.assignedCounties || []);
        setOpenVisit(res.data.openVisit || null);
        setWorkday(res.data.workday || null);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, limit, debouncedSearch, countiesFilter, kinds, agentIds, dateFrom, dateTo, isSales, reloadToken]);

  const filtersActive = Boolean(search.trim() || countiesFilter.length || kinds.length || agentIds.length || dateFrom || dateTo);
  const sheetFiltersActive = Boolean(sheetAgents.length || sheetFrom || sheetTo);
  const marker = outsideLabel(user?.role);
  const dayClosed = Boolean(isSales && workday && !workday.open);

  useEffect(() => {
    if (isSales || sheet !== 'timesheet') return;
    const params = {};
    if (sheetFrom) params.date_from = sheetFrom;
    if (sheetTo) params.date_to = sheetTo;
    if (sheetAgents.length) params.agent_id = sheetAgents.join(',');
    axios.get(`${API_URL}/api/admin/field/timesheet`, { headers, params })
      .then((res) => setTimesheet(res.data.days || []))
      .catch(() => setTimesheet([]));
  }, [sheet, sheetFrom, sheetTo, sheetAgents, isSales, sheetReloadToken]);

  const invalidateCheckout = async (day) => {
    const approved = await confirm({
      label: 'Invalidate checkout',
      title: `Invalidate ${day.agentName || 'this agent'}'s checkout?`,
      description: 'This removes the checkout time and reopens today’s session so the agent can continue recording visits. Existing entries will not be changed.',
      confirmLabel: 'Invalidate checkout',
    });
    if (!approved) return;
    try {
      await axios.post(`${API_URL}/api/admin/field/workdays/${day.id}/invalidate-checkout`, {}, { headers });
      toast.success('Checkout invalidated. The session is open again.');
      setSheetReloadToken((token) => token + 1);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not invalidate this checkout.');
    }
  };

  const checkOutDay = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/admin/field/workday/check-out`, {}, { headers });
      setWorkday(res.data.workday);
      toast.success('Checked out for the day');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not check out');
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 w-full">
        <p className="editorial-label mb-2">Sales</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="app-page-title">Field Work</h1>
            {isSales && (
              <p className="text-sm text-ink mt-2">
                {assignedCounties.length > 0
                  ? <>Your counties: <span className="text-ink-muted">{assignedCounties.join(', ')}</span></>
                  : <span className="text-ink-muted">Your territory has not been allocated yet. You can still check in at any facility.</span>}
              </p>
            )}
            <p className="text-sm text-ink-muted mt-1 max-w-3xl">
              {isSales
                ? 'Record each facility visit. Your day starts with the first visit or registration, and ends when you check out after the last facility.'
                : 'Facility visits for every sales agent, plus the daily timesheet.'}
            </p>
          </div>
          {isSales && !loading ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRegisterSource(null);
                  setRegisterOpen(true);
                }}
                className="inline-flex items-center gap-2 h-9 px-3 text-sm text-ink-muted hover:text-ink"
              >
                <Building2 className="w-4 h-4" /> Register facility
              </button>
              {!dayClosed && (
                <button
                  type="button"
                  onClick={() => setVisitRequest({ mode: 'create', prospectId: null })}
                  className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm"
                >
                  Record visit
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {!isSales && (
        <div className="mb-4">
          <SheetTabs
            tabs={[{ id: 'visits', label: 'Visits' }, { id: 'timesheet', label: 'Timesheet' }]}
            value={sheet}
            onChange={setSheet}
          />
        </div>
      )}

      {isSales && (workday || openVisit) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="min-w-0 text-sm">
            {workday && (
              <p>
                <span className="font-medium">
                  {workday.open ? `Day started ${formatDateTime(workday.checkedInAt)}` : `Checked out ${formatDateTime(workday.checkedOutAt)}`}
                </span>
                <span className="text-ink-muted">
                  {' · '}{workday.hours} hours · {workday.facilityCount} {workday.facilityCount === 1 ? 'facility' : 'facilities'}
                </span>
              </p>
            )}
            {openVisit && (
              <p className="text-ink-muted mt-1">
                Open visit at{' '}
                <Link to={`/sysadmin/field/${openVisit.prospectId}`} className="text-copper hover:underline">
                  {openVisit.facilityName}
                </Link>
                {' '}since {formatDateTime(openVisit.checkedInAt)}. End it before you check out.
              </p>
            )}
          </div>
          {workday?.open && (
            <button
              type="button"
              onClick={checkOutDay}
              disabled={Boolean(openVisit)}
              title={openVisit ? 'End the open visit before you check out' : 'Check out for the day'}
              className="h-9 px-4 text-sm rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
            >
              Check out
            </button>
          )}
        </div>
      )}

      {sheet === 'timesheet' ? (
        <div>
          <AdminFilterBar>
            <AdminMultiSelect
              value={sheetAgents}
              onChange={setSheetAgents}
              placeholder="All agents"
              searchPlaceholder="Search agents…"
              options={agents.map((agent) => ({ value: agent.id, label: agent.name }))}
            />
            <FilterDateRange from={sheetFrom} to={sheetTo} onChange={({ from, to }) => { setSheetFrom(from); setSheetTo(to); }} />
            <AdminResetFilters
              disabled={!sheetFiltersActive}
              onReset={() => { setSheetAgents([]); setSheetFrom(''); setSheetTo(''); }}
            />
          </AdminFilterBar>
          {timesheet.length === 0 ? (
            <AdminEmptyState>No workdays in this range.</AdminEmptyState>
          ) : (
            <AdminDataTable minWidth={760}>
              <AdminTableHead>
                <AdminTableTh>Agent</AdminTableTh>
                <AdminTableTh>Date</AdminTableTh>
                <AdminTableTh>Start</AdminTableTh>
                <AdminTableTh>End</AdminTableTh>
                <AdminTableTh>Hours</AdminTableTh>
                <AdminTableTh>Facilities</AdminTableTh>
                {isAdmin ? <AdminTableTh className="w-12 text-right" /> : null}
              </AdminTableHead>
              <AdminTableBody>
                {timesheet.map((day) => (
                  <AdminTableRow key={day.id}>
                    <AdminTableTd>{day.agentName || '—'}</AdminTableTd>
                    <AdminTableTd nowrap>{day.workDate}</AdminTableTd>
                    <AdminTableTd nowrap>{formatDateTime(day.checkedInAt)}</AdminTableTd>
                    <AdminTableTd nowrap>{day.checkedOutAt ? formatDateTime(day.checkedOutAt) : 'Still working'}</AdminTableTd>
                    <AdminTableTd nowrap className="tabular-nums">{day.hours}</AdminTableTd>
                    <AdminTableTd nowrap className="tabular-nums">{day.facilityCount}</AdminTableTd>
                    {isAdmin ? (
                      <AdminTableTd className="text-right">
                        {day.canReopen ? (
                          <RowActionsMenu
                            label={`Actions for ${day.agentName || 'workday'}`}
                            items={[{
                              label: 'Invalidate checkout',
                              onSelect: () => invalidateCheckout(day),
                            }]}
                          />
                        ) : null}
                      </AdminTableTd>
                    ) : null}
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          )}
        </div>
      ) : (
      <>
      <AdminFilterBar>
        <AdminFilterInput
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Search facility, contact, county…"
          className="w-full"
        />
        <AdminMultiSelect
          value={countiesFilter}
          onChange={(values) => { setCountiesFilter(values); setPage(1); }}
          placeholder="All counties"
          searchPlaceholder="Search counties…"
          options={counties.map((name) => ({ value: name, label: name }))}
        />
        <AdminMultiSelect
          value={kinds}
          onChange={(values) => { setKinds(values); setPage(1); }}
          placeholder="Walk-in and registered"
          options={[{ value: 'prospect', label: 'Walk-in' }, { value: 'registered', label: 'Registered' }]}
        />
        {!isSales && (
          <AdminMultiSelect
            value={agentIds}
            onChange={(values) => { setAgentIds(values); setPage(1); }}
            placeholder="All agents"
            searchPlaceholder="Search agents…"
            options={agents.map((agent) => ({ value: agent.id, label: agent.name }))}
          />
        )}
        <FilterDateRange from={dateFrom} to={dateTo} onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); setPage(1); }} />
        <AdminResetFilters
          disabled={!filtersActive}
          onReset={() => { setSearch(''); setCountiesFilter([]); setKinds([]); setAgentIds([]); setDateFrom(''); setDateTo(''); setPage(1); }}
        />
      </AdminFilterBar>

      {loading ? (
        <AdminLoadingState />
      ) : rows.length === 0 ? (
        <AdminEmptyState>{filtersActive ? 'No facilities match these filters.' : 'No field visits yet.'}</AdminEmptyState>
      ) : (
        <>
          <AdminListMeta total={total} page={page} limit={limit} noun="facilities" />
          <AdminDataTable minWidth={980}>
            <AdminTableHead>
              <AdminTableTh>Facility</AdminTableTh>
              <AdminTableTh>Facility Type</AdminTableTh>
              <AdminTableTh>Walk-in or Registered</AdminTableTh>
              <AdminTableTh>County</AdminTableTh>
              <AdminTableTh>Outside region</AdminTableTh>
              <AdminTableTh>Sales Agent</AdminTableTh>
              <AdminTableTh>Facility Contact</AdminTableTh>
              <AdminTableTh>Probability</AdminTableTh>
              <AdminTableTh>Visits</AdminTableTh>
              <AdminTableTh>Visit Start Time</AdminTableTh>
              <AdminTableTh>Visit End Time</AdminTableTh>
              {isSales ? <AdminTableTh className="w-12 text-right" /> : null}
            </AdminTableHead>
            <AdminTableBody>
              {rows.map((row) => (
                <AdminTableRow key={row.id}>
                  <AdminTableTd>
                    <Link to={`/sysadmin/field/${row.id}`} className="font-medium text-copper hover:underline">
                      {row.facilityName}
                    </Link>
                  </AdminTableTd>
                  <AdminTableTd nowrap>{typeLabel(row.facilityType)}</AdminTableTd>
                  <AdminTableTd nowrap>{row.visitKind || (row.registered ? 'Registered' : 'Walk-in')}</AdminTableTd>
                  <AdminTableTd nowrap>{row.county || '—'}</AdminTableTd>
                  <AdminTableTd nowrap>{row.outsideTerritory ? marker : '—'}</AdminTableTd>
                  <AdminTableTd nowrap>{row.agentName || '—'}</AdminTableTd>
                  <AdminTableTd>
                    <p>{row.contactName || '—'}</p>
                    <p className="text-xs text-ink-muted">{row.contactPhone || row.contactEmail || ''}</p>
                  </AdminTableTd>
                  <AdminTableTd nowrap>{row.probabilityLabel || '—'}</AdminTableTd>
                  <AdminTableTd nowrap className="tabular-nums">{row.visitCount || 0}</AdminTableTd>
                  <AdminTableTd nowrap className="text-ink-muted">{formatDateTime(row.visitStartedAt)}</AdminTableTd>
                  <AdminTableTd nowrap className="text-ink-muted">{row.visitEndedAt ? formatDateTime(row.visitEndedAt) : (row.checkedIn ? 'Open' : '—')}</AdminTableTd>
                  {isSales ? (
                    <AdminTableTd className="text-right">
                      <RowActionsMenu
                        label={`Actions for ${row.facilityName}`}
                        items={[
                          {
                            label: row.checkedIn ? 'Edit visit' : 'Edit',
                            onSelect: () => setVisitRequest({ mode: 'edit', prospectId: row.id }),
                          },
                          !dayClosed && {
                            label: 'Create new visit',
                            onSelect: () => setVisitRequest({ mode: 'create', prospectId: row.id }),
                          },
                          {
                            label: 'Create quote',
                            onSelect: () => navigate('/sysadmin/quotes', { state: { createQuote: quoteClientFromRow(row) } }),
                          },
                          !row.registered && {
                            label: 'Register as Facility',
                            onSelect: () => {
                              setRegisterSource(row);
                              setRegisterOpen(true);
                            },
                          },
                        ]}
                      />
                    </AdminTableTd>
                  ) : null}
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminDataTable>
          <AdminPager
            page={page}
            pages={pages}
            total={total}
            limit={limit}
            onPage={setPage}
            onLimit={(next) => { setLimit(next); setPage(1); }}
          />
        </>
      )}
      </>
      )}
      {isSales && (
        <>
          <VisitFormModal
            open={Boolean(visitRequest)}
            mode={visitRequest?.mode || 'create'}
            prospectId={visitRequest?.prospectId || null}
            onOpenChange={(next) => { if (!next) setVisitRequest(null); }}
            onSaved={() => setReloadToken((token) => token + 1)}
          />
          <RegisterFacilityModal
            open={registerOpen}
            initialRecord={registerSource}
            onOpenChange={(next) => {
              setRegisterOpen(next);
              if (!next) setRegisterSource(null);
            }}
            onSaved={() => setReloadToken((token) => token + 1)}
          />
        </>
      )}
    </div>
  );
};
