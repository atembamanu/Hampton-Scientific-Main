import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search } from 'lucide-react';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { joinMulti } from '../../utils/multiFilter';
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
  AdminEmptyState,
  AdminLoadingState,
} from '../../components/admin/AdminPageHeader';

export const AdminDeliveryLocations = () => {
  const [rows, setRows] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [search, setSearch] = useState('');
  const [orgIds, setOrgIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (overrides = {}) => {
    setLoading(true);
    try {
      const params = {};
      const q = overrides.search !== undefined ? overrides.search : search;
      const org = overrides.organization_id !== undefined ? overrides.organization_id : joinMulti(orgIds);
      if (q) params.search = q;
      if (org) params.organization_id = org;
      const res = await axios.get(`${API_URL}/api/admin/ops/delivery-locations`, { headers: getAdminHeader(), params });
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [joinMulti(orgIds)]);
  useEffect(() => {
    axios.get(`${API_URL}/api/admin/ops/organizations`, { headers: getAdminHeader() })
      .then((res) => setOrgs(Array.isArray(res.data) ? res.data : (res.data?.items || [])))
      .catch(() => {});
  }, []);

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Delivery locations"
        label="Fulfilment"
        description="Delivery addresses grouped under facilities and branches."
      />

      <AdminFilterBar>
        <div className="filter-search relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <AdminFilterInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Search label, address, contact…"
            className="w-full pl-9"
          />
        </div>
        <AdminMultiSelect
          value={orgIds}
          onChange={setOrgIds}
          placeholder="All facilities"
          searchPlaceholder="Search facilities…"
          options={orgs.map((o) => ({ value: o.id, label: o.name }))}
        />
        <AdminResetFilters
          disabled={!search.trim() && !orgIds.length}
          onReset={() => {
            setSearch('');
            setOrgIds([]);
            load({ search: '', organization_id: '' });
          }}
        />
      </AdminFilterBar>

      {loading ? (
        <AdminLoadingState />
      ) : rows.length === 0 ? (
        <AdminEmptyState>No delivery locations found.</AdminEmptyState>
      ) : (
        <AdminDataTable minWidth={1000}>
          <AdminTableHead>
            <AdminTableTh>Location</AdminTableTh>
            <AdminTableTh className="min-w-[220px]">Facility / Branch</AdminTableTh>
            <AdminTableTh className="min-w-[180px]">Contact</AdminTableTh>
            <AdminTableTh className="min-w-[280px]">Address</AdminTableTh>
          </AdminTableHead>
          <AdminTableBody>
            {rows.map((loc) => (
              <AdminTableRow key={loc.id}>
                <AdminTableTd nowrap className="font-medium">
                  {loc.label}
                  {loc.isDefault && <span className="ml-2 text-[10px] uppercase text-brand">Default</span>}
                </AdminTableTd>
                <AdminTableTd>
                  <p className="truncate max-w-[260px]">{loc.organizationName}</p>
                  <p className="text-xs text-ink-muted truncate max-w-[260px]">{loc.branchName || 'Facility-wide'}</p>
                </AdminTableTd>
                <AdminTableTd>
                  <p className="truncate max-w-[220px]">{loc.contactName || '—'}</p>
                  <p className="text-xs text-ink-muted truncate max-w-[220px]">{loc.phone}</p>
                </AdminTableTd>
                <AdminTableTd>
                  <p className="truncate max-w-[320px]">{loc.addressLine}</p>
                  <p className="text-xs text-ink-muted">{loc.county}</p>
                </AdminTableTd>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminDataTable>
      )}
    </div>
  );
};
