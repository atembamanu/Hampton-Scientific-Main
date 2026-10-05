import { useEffect, useState } from 'react';
import axios from 'axios';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config/apiBaseUrl';
import { useLiveUpdates } from '../../hooks/useLiveUpdates';

export const QuoteConversation = ({ quoteId, headers, adminMode = false, emptyHint = 'No messages yet.' }) => {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const listUrl = adminMode
    ? `${API_URL}/api/admin/ops/quotes/${quoteId}/messages`
    : `${API_URL}/api/quotes/${quoteId}/messages`;
  const sendUrl = adminMode
    ? `${API_URL}/api/admin/ops/quotes/${quoteId}/messages`
    : `${API_URL}/api/quotes/${quoteId}/messages`;

  const token = (headers?.Authorization || '').replace(/^Bearer\s+/i, '') || null;

  const load = () => {
    axios.get(listUrl, { headers })
      .then((res) => setMessages(res.data || []))
      .catch(() => {});
  };

  useEffect(() => { load(); }, [quoteId, listUrl]);

  useLiveUpdates({
    token,
    quoteId,
    types: ['message.created', 'quote.updated'],
    onEvent: () => load(),
  });

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await axios.post(sendUrl, { body: text }, { headers });
      setBody('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border rounded-xl bg-white flex flex-col h-[420px]">
      <div className="px-4 py-3 border-b font-semibold text-sm">Conversation</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <p className="text-sm text-gray-500">{emptyHint}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] ${m.sender_role === 'admin' ? 'ml-auto' : ''}`}>
            <p className="text-[11px] text-gray-500 mb-0.5">
              {m.sender_name} — {m.sender_role === 'admin' ? 'Admin' : 'Customer'}
              {' · '}
              {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
            </p>
            <div className={`rounded-xl px-3 py-2 text-sm ${m.sender_role === 'admin' ? 'bg-[#006332] text-white' : 'bg-gray-100 text-gray-800'}`}>
              {m.body}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          className="flex-1 h-10 px-3 border rounded-lg text-sm"
        />
        <button type="button" onClick={send} disabled={sending} className="h-10 px-3 rounded-lg bg-[#006332] text-white disabled:opacity-60">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
