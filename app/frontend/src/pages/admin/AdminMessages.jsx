import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { getAdminToken } from '../../utils/adminAuth';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { AdminPageHeader, AdminEmptyState, AdminLoadingState, AdminFilterBar, AdminFilterInput, AdminResetFilters, AdminListMeta, AdminPager } from '../../components/admin/AdminPageHeader';

export const AdminMessages = () => {
  const [searchParams] = useSearchParams();
  const unreadOnly = searchParams.get('unread') === '1';
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const appliedSearch = useDebouncedValue(search, 300);

  const load = () => {
    const params = { page, limit };
    if (unreadOnly) params.unread = true;
    if (appliedSearch.trim()) params.search = appliedSearch.trim();
    return axios.get(`${API_URL}/api/admin/ops/messages`, {
      headers: getAdminHeader(),
      params,
    }).then((res) => {
      const data = res.data || {};
      const rows = Array.isArray(data) ? data : (data.messages || data.items || []);
      setMessages(rows);
      setMeta({
        total: Array.isArray(data) ? rows.length : (data.total || 0),
        page: data.page || page,
        limit: data.limit || limit,
        pages: data.pages || 1,
      });
    });
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [unreadOnly, appliedSearch, page, limit]);

  useEffect(() => { setPage(1); }, [unreadOnly, appliedSearch]);

  useLiveUpdates({
    token: getAdminToken(),
    types: ['message.created'],
    onEvent: () => load().catch(() => {}),
  });

  return (
    <div className="w-full">
      <AdminPageHeader title="Messages" />

      <AdminFilterBar>
        <AdminFilterInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sender, facility, quote, message…"
          className="w-full"
        />
        <AdminResetFilters disabled={!search.trim()} onReset={() => setSearch('')} />
      </AdminFilterBar>

      {loading && messages.length === 0 ? (
        <AdminLoadingState />
      ) : meta.total === 0 ? (
        <AdminEmptyState>
          {appliedSearch.trim() ? 'No messages match these filters.' : (unreadOnly ? 'No unread customer messages.' : 'No customer messages yet.')}
        </AdminEmptyState>
      ) : (
        <div className={`w-full ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
        <AdminListMeta total={meta.total} page={meta.page} limit={meta.limit} noun="messages" />
        <div className="editorial-panel p-0 w-full">
          <div className="divide-y divide-ink/5">
          {messages.map((m) => (
            <Link key={m.id} to={`/sysadmin/quotes/${m.quote_id}`} className="block px-5 py-4 hover:bg-ink/[0.02]">
              <div className="flex flex-wrap justify-between gap-3">
                <p className="font-medium text-sm text-ink">{m.sender_name} · {m.facility_name}</p>
                <p className="text-xs text-ink-faint whitespace-nowrap">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</p>
              </div>
              <p className="text-sm text-ink-muted mt-1 line-clamp-2">{m.body}</p>
              <p className="text-xs text-brand mt-1">{m.quote_number}</p>
              {!m.is_read && <span className="inline-block mt-1 text-[10px] bg-red-100 text-red-700 px-1.5 rounded-full">Unread</span>}
            </Link>
          ))}
          </div>
          <AdminPager
            page={meta.page}
            pages={meta.pages}
            total={meta.total}
            limit={meta.limit}
            onPage={setPage}
            onLimit={(next) => { setLimit(next); setPage(1); }}
          />
        </div>
        </div>
      )}
    </div>
  );
};
