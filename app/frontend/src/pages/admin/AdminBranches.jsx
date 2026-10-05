import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';

export const AdminBranches = () => {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/admin/ops/organizations`, { headers: getAdminHeader() })
      .then((res) => setOrgs(Array.isArray(res.data) ? res.data : (res.data?.items || [])))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#006332]" /></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Branches</h1>
      <p className="text-sm text-gray-500 mb-6">Branches belong to a facility. Open a facility to see users and history.</p>
      <div className="space-y-4">
        {orgs.map((org) => (
          <div key={org.id} className="bg-white border rounded-xl p-5">
            <Link to={`/sysadmin/customers/${org.id}`} className="font-semibold text-[#006332] hover:underline">{org.name}</Link>
            <ul className="mt-3 space-y-1 text-sm text-gray-700">
              {(org.branches || []).map((b) => (
                <li key={b.id} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-start border-b last:border-0 py-1.5">
                  <span className="min-w-0">{b.name}{b.isMain ? ' (Main)' : ''}</span>
                  <span className="text-gray-500 sm:text-right sm:max-w-[50%]">{b.county || b.physicalAddress || '—'}</span>
                </li>
              ))}
              {(org.branches || []).length === 0 && <li className="text-gray-500">No branches yet.</li>}
            </ul>
          </div>
        ))}
        {orgs.length === 0 && <p className="text-center text-gray-500 py-12">No facilities found.</p>}
      </div>
    </div>
  );
};
