import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Download, Plus, Search } from 'lucide-react';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { downloadBlob } from '../../utils/csv';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { joinMulti, parseMulti } from '../../utils/multiFilter';
import {
  AdminPageHeader,
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
  AdminListMeta,
  AdminPager,
  AdminTableShell,
} from '../../components/admin/AdminPageHeader';
import { FacilityCreateModal } from '../../components/admin/AdminFacilityModals';

const TYPE_LABELS = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  pharmacy: 'Pharmacy',
  laboratory: 'Laboratory',
  medical_centre: 'Medical Centre',
  ngo: 'NGO',
  other: 'Other',
};

export const AdminCustomers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orgs, setOrgs] = useState([]);
  const [facets, setFacets] = useState({ facilityTypes: [], counties: [] });
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const facilityTypes = parseMulti(searchParams.get('facility_type'));
  const counties = parseMulti(searchParams.get('county'));
  const facilityKey = joinMulti(facilityTypes);
  const countyKey = joinMulti(counties);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 20);
  const debouncedSearch = useDebouncedValue(search, 300);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (facilityKey) params.facility_type = facilityKey;
      if (countyKey) params.county = countyKey;
      const res = await axios.get(`${API_URL}/api/admin/ops/organizations`, { headers: getAdminHeader(), params });
      const data = res.data || {};
      setOrgs(data.items || []);
      setMeta({
        total: data.total || 0,
        page: data.page || page,
        limit: data.limit || limit,
        pages: data.pages || 1,
      });
      setFacets({
        facilityTypes: data.facilityTypes || [],
        counties: data.counties || [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, limit, facilityKey, countyKey, debouncedSearch]);

  const updateParam = (key, value, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next);
  };

  const filtersActive = Boolean(search.trim() || facilityKey || countyKey);

  const handleExport = async () => {
    try {
      const params = {};
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (facilityKey) params.facility_type = facilityKey;
      if (countyKey) params.county = countyKey;
      const res = await axios.get(`${API_URL}/api/admin/ops/organizations/export`, {
        headers: getAdminHeader(),
        params,
        responseType: 'blob',
      });
      downloadBlob(res.data, 'facilities.csv');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Facilities"
        label="Administration"
        actions={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary inline-flex items-center gap-2 h-10 px-4 text-sm">
              <Plus className="w-4 h-4" /> Add facility
            </button>
            <button type="button" onClick={handleExport} className="h-10 px-3 border border-ink/15 rounded-lg text-sm inline-flex items-center gap-2 bg-white">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        )}
      />

      <AdminFilterBar>
        <div className="filter-search relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <AdminFilterInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              updateParam('search', e.target.value.trim());
            }}
            placeholder="Search name, email, phone, county…"
            className="w-full pl-9"
          />
        </div>
        <AdminMultiSelect
          value={facilityTypes}
          onChange={(values) => updateParam('facility_type', values.join(','))}
          placeholder="All types"
          options={facets.facilityTypes.map((t) => ({ value: t, label: TYPE_LABELS[t] || t }))}
        />
        <AdminMultiSelect
          value={counties}
          onChange={(values) => updateParam('county', values.join(','))}
          placeholder="All counties"
          searchPlaceholder="Search counties…"
          options={facets.counties.map((c) => ({ value: c, label: c }))}
        />
        <AdminResetFilters
          disabled={!filtersActive}
          onReset={() => {
            setSearch('');
            setSearchParams({});
          }}
        />
      </AdminFilterBar>

      <AdminTableShell loading={loading} hasRows={orgs.length > 0} empty="No facilities found.">
        <AdminListMeta total={meta.total} page={meta.page} limit={meta.limit} noun="facilities" />
        <AdminDataTable minWidth={980}>
          <AdminTableHead>
            <AdminTableTh>Facility</AdminTableTh>
            <AdminTableTh>Type</AdminTableTh>
            <AdminTableTh>County</AdminTableTh>
            <AdminTableTh>Contact</AdminTableTh>
            <AdminTableTh>Branches</AdminTableTh>
            <AdminTableTh>Quotes</AdminTableTh>
            <AdminTableTh>Orders</AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {orgs.map((org) => (
              <AdminTableRow key={org.id}>
                <AdminTableTd>
                  <Link to={`/sysadmin/facilities/${org.id}`} className="font-semibold text-brand hover:text-copper hover:underline">
                    {org.name}
                  </Link>
                </AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted capitalize">{TYPE_LABELS[org.facilityType] || org.facilityType}</AdminTableTd>
                <AdminTableTd nowrap className="text-ink-muted">{org.county || org.country || '—'}</AdminTableTd>
                <AdminTableTd>
                  <p className="truncate max-w-[220px]">{org.email}</p>
                  <p className="text-xs text-ink-muted">{org.phone}</p>
                </AdminTableTd>
                <AdminTableTd nowrap>{org.branchCount}</AdminTableTd>
                <AdminTableTd nowrap>{org.quoteCount}</AdminTableTd>
                <AdminTableTd nowrap>{org.orderCount}</AdminTableTd>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
        <AdminPager
          page={meta.page}
          pages={meta.pages}
          total={meta.total}
          limit={meta.limit}
          onPage={(next) => updateParam('page', String(next), false)}
          onLimit={(next) => {
            const params = new URLSearchParams(searchParams);
            params.set('limit', String(next));
            params.delete('page');
            setSearchParams(params);
          }}
        />
      </AdminTableShell>
      <FacilityCreateModal open={createOpen} onOpenChange={setCreateOpen} onSaved={load} />
    </div>
  );
};
