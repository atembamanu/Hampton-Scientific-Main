import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { FileText, Link2, Loader2, MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../../config/apiBaseUrl';

const pad2 = (value) => String(value).padStart(2, '0');
const MAX_PENDING = 5;

const initialsFrom = (value) => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'HS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const formatClock = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  return `${hours12}:${pad2(date.getMinutes())} ${period}`;
};

const dayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const dayLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const resolveAssetUrl = (url) => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};

const isImageAttachment = (attachment) => {
  const mime = String(attachment?.mime || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp)$/i.test(attachment?.name || attachment?.url || '');
};

const MessageAttachments = ({ attachments, mine }) => {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const textCls = mine ? 'text-white/95' : 'text-copper';
  const chipCls = mine ? 'bg-white/15 hover:bg-white/25' : 'bg-copper/10 hover:bg-copper/15';
  return (
    <div className={`mt-2 space-y-1.5 ${attachments.length && 'pt-0.5'}`}>
      {attachments.map((attachment, index) => {
        const href = resolveAssetUrl(attachment.url);
        const label = attachment.name || attachment.url || 'Attachment';
        const key = `${attachment.url}-${index}`;
        if (attachment.type === 'file' && isImageAttachment(attachment)) {
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl"
            >
              <img src={href} alt={label} className="max-h-40 w-full object-cover" />
              <span className={`block text-[11px] mt-1 truncate ${textCls}`}>{label}</span>
            </a>
          );
        }
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs ${chipCls} ${textCls}`}
          >
            {attachment.type === 'link' ? <Link2 className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{label}</span>
          </a>
        );
      })}
    </div>
  );
};

export const QuoteMessagesPopup = ({
  quoteId,
  headers,
  unreadCount = 0,
  open: openProp,
  onOpenChange,
  onRead,
  adminMode = false,
  facilityName = '',
  branchName = '',
  counterpartName = '',
  // Admin only: allow flagging a message as a request for more information,
  // which moves the quote to Awaiting Information.
  canRequestInformation = false,
  // When set, the composer is disabled and this text is shown instead.
  disabledReason = '',
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (next) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [messageType, setMessageType] = useState('general');
  const [pending, setPending] = useState([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const sendingRef = useRef(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const listUrl = adminMode
    ? `${API_URL}/api/admin/ops/quotes/${quoteId}/messages`
    : `${API_URL}/api/quotes/${quoteId}/messages`;
  const sendUrl = listUrl;
  const uploadUrl = `${listUrl}/attachments`;

  const load = (opts = {}) => {
    if (!quoteId) return Promise.resolve();
    const showSpinner = opts.showSpinner !== false && messages.length === 0;
    if (showSpinner) setLoading(true);
    return axios.get(listUrl, { headers, timeout: 15000 })
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        setMessages(rows);
      })
      .catch((err) => {
        toast.error(err.response?.data?.detail || err.message || 'Could not load messages');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open && quoteId) load({ showSpinner: true });
  }, [open, quoteId, adminMode]);

  useEffect(() => {
    if (open && quoteId && unreadCount >= 0) load({ showSpinner: false });
  }, [unreadCount]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const grouped = useMemo(() => {
    const groups = [];
    messages.forEach((message) => {
      const key = dayKey(message.created_at) || 'unknown';
      const last = groups[groups.length - 1];
      if (!last || last.key !== key) {
        groups.push({ key, label: dayLabel(message.created_at), items: [message] });
      } else {
        last.items.push(message);
      }
    });
    return groups;
  }, [messages]);

  const addPending = (item) => {
    setPending((prev) => {
      if (prev.length >= MAX_PENDING) {
        toast.error(`You can attach up to ${MAX_PENDING} files or links`);
        return prev;
      }
      return [...prev, item];
    });
  };

  const onPickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !quoteId) return;
    if (pending.length >= MAX_PENDING) {
      toast.error(`You can attach up to ${MAX_PENDING} files or links`);
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setUploading(true);
    try {
      const { 'Content-Type': _omit, ...authHeaders } = headers || {};
      const res = await axios.post(uploadUrl, form, {
        headers: authHeaders,
        timeout: 30000,
      });
      addPending({
        type: 'file',
        name: res.data?.name || file.name,
        url: res.data?.url,
        mime: res.data?.mime || file.type,
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Could not attach file');
    } finally {
      setUploading(false);
    }
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error('Enter a full http or https link');
      return;
    }
    addPending({ type: 'link', name: linkName.trim() || url, url, mime: null });
    setLinkUrl('');
    setLinkName('');
    setLinkOpen(false);
  };

  const send = async () => {
    const text = body.trim();
    if ((!text && pending.length === 0) || !quoteId || sendingRef.current || disabledReason) return;
    const requestingInfo = adminMode && canRequestInformation && messageType === 'information_request';
    if (requestingInfo && !text) {
      toast.error('Describe the information you need from the customer');
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      const payload = { body: text, attachments: pending };
      if (adminMode) payload.message_type = requestingInfo ? 'information_request' : 'general';
      const res = await axios.post(sendUrl, payload, { headers, timeout: 20000 });
      setBody('');
      setPending([]);
      setLinkOpen(false);
      setMessageType('general');
      if (requestingInfo) toast.success('Request sent — quote is now Awaiting Information');
      if (res.data?.id) {
        setMessages((prev) => (prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data]));
      } else {
        await load({ showSpinner: false });
      }
      onRead?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Could not send message');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const headerTitle = adminMode
    ? (branchName ? `${facilityName} (${branchName})` : (facilityName || 'Facility'))
    : 'Hampton Scientific';
  const headerSubtitle = adminMode ? (counterpartName || '') : 'Sales Support';
  const headerInitials = adminMode ? initialsFrom(facilityName || counterpartName) : 'HS';
  const canSend = Boolean(body.trim() || pending.length) && !sending && !uploading && !disabledReason;
  const showTypeSelector = adminMode && canRequestInformation && !disabledReason;

  return (
    <>
      {!open && quoteId && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed z-[60] bottom-5 right-5 h-14 w-14 rounded-full bg-copper text-white shadow-[0_12px_32px_rgba(139,90,43,0.35)] hover:bg-copper/90 transition-colors inline-flex items-center justify-center"
          aria-label="Open messages"
        >
          <span className="relative inline-flex h-full w-full items-center justify-center">
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
        </button>
      )}

      {open && quoteId && (
        <div className="fixed inset-0 z-[70] flex items-end justify-end p-5 pointer-events-none">
          <button
            type="button"
            className="absolute inset-0 bg-ink/20 sm:bg-transparent pointer-events-auto"
            aria-label="Close messages"
            onClick={() => setOpen(false)}
          />
          <div className="relative pointer-events-auto w-full sm:w-[400px] h-[min(100dvh,680px)] sm:h-[640px] bg-white sm:rounded-3xl shadow-[0_24px_80px_rgba(24,24,24,0.18)] border border-ink/10 flex flex-col overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Messages</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-ink/5 inline-flex items-center justify-center text-ink-muted"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pb-4 flex items-center gap-3 border-b border-ink/5">
              <div className="h-11 w-11 rounded-full bg-copper/15 text-copper font-semibold text-sm inline-flex items-center justify-center shrink-0">
                {headerInitials}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{headerTitle}</p>
                {headerSubtitle && (
                  <p className="text-xs text-ink-muted truncate">{headerSubtitle}</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#f6f4f1] px-4 py-4 space-y-4">
              {loading && messages.length === 0 && (
                <p className="text-sm text-ink-muted text-center pt-10">Loading messages…</p>
              )}
              {!loading && messages.length === 0 && (
                <p className="text-sm text-ink-muted text-center pt-10">No messages yet. Start the conversation.</p>
              )}
              {grouped.map((group) => (
                <div key={group.key} className="space-y-3">
                  <div className="flex justify-center">
                    <span className="text-[11px] text-ink-muted bg-white/80 px-3 py-1 rounded-full shadow-sm">
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((message) => {
                    const mine = adminMode ? message.sender_role === 'admin' : message.sender_role !== 'admin';
                    const label = mine
                      ? (message.sender_name || (adminMode ? 'Hampton Scientific' : counterpartName || 'You'))
                      : (message.sender_name || (adminMode ? counterpartName : 'Hampton Scientific'));
                    const text = String(message.body || '').trim();
                    return (
                      <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                          <p className={`text-[11px] mb-0.5 ${mine ? 'text-right text-copper/80' : 'text-left text-ink-muted'}`}>
                            {label}
                          </p>
                          <div
                            className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                              mine
                                ? 'bg-copper text-white rounded-br-md'
                                : 'bg-white text-ink rounded-bl-md'
                            }`}
                          >
                            {text ? <p className="whitespace-pre-wrap">{text}</p> : null}
                            <MessageAttachments attachments={message.attachments} mine={mine} />
                          </div>
                          <p className={`text-[11px] text-ink-faint mt-1 ${mine ? 'text-right' : 'text-left'}`}>
                            {formatClock(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="p-3 bg-white border-t border-ink/5">
              {disabledReason && (
                <p className="text-xs text-ink-muted text-center px-2 pb-2">{disabledReason}</p>
              )}
              {showTypeSelector && (
                <div className="flex items-center gap-2 px-1 pb-2">
                  <label htmlFor="quote-message-type" className="text-[11px] text-ink-muted whitespace-nowrap">Message type</label>
                  <select
                    id="quote-message-type"
                    value={messageType}
                    onChange={(e) => setMessageType(e.target.value)}
                    className={`flex-1 h-8 px-2 rounded-lg border text-xs bg-white ${
                      messageType === 'information_request' ? 'border-purple-300 text-purple-800' : 'border-ink/10 text-ink'
                    }`}
                  >
                    <option value="general">General message</option>
                    <option value="information_request">Request for more information</option>
                  </select>
                </div>
              )}
              {showTypeSelector && messageType === 'information_request' && (
                <p className="text-[11px] text-purple-700 px-1 pb-2">
                  Sending will move the quote to Awaiting Information. It returns to Under Review when the customer replies.
                </p>
              )}
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1 pb-2">
                  {pending.map((item, index) => (
                    <span
                      key={`${item.url}-${index}`}
                      className="inline-flex items-center gap-1 max-w-full rounded-full bg-copper/10 text-copper text-[11px] px-2 py-1"
                    >
                      {item.type === 'link' ? <Link2 className="w-3 h-3 shrink-0" /> : <Paperclip className="w-3 h-3 shrink-0" />}
                      <span className="truncate max-w-[160px]">{item.name || item.url}</span>
                      <button
                        type="button"
                        aria-label="Remove attachment"
                        onClick={() => setPending((prev) => prev.filter((_, i) => i !== index))}
                        className="hover:text-ink"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {linkOpen && (
                <div className="mb-2 rounded-xl border border-ink/10 bg-cream/50 p-2 space-y-1.5">
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full h-8 bg-transparent text-sm outline-none px-1"
                  />
                  <input
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="Optional label"
                    className="w-full h-8 bg-transparent text-sm outline-none px-1"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" className="text-xs text-ink-muted" onClick={() => setLinkOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" className="text-xs font-medium text-copper" onClick={addLink}>
                      Add link
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1.5 rounded-2xl border border-ink/10 bg-cream/40 px-2 py-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={onPickFile}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,image/*,application/pdf"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || pending.length >= MAX_PENDING || Boolean(disabledReason)}
                  className="h-9 w-9 rounded-full hover:bg-ink/5 text-ink-muted inline-flex items-center justify-center disabled:opacity-40"
                  aria-label="Attach file"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setLinkOpen((openLink) => !openLink)}
                  disabled={pending.length >= MAX_PENDING || Boolean(disabledReason)}
                  className="h-9 w-9 rounded-full hover:bg-ink/5 text-ink-muted inline-flex items-center justify-center disabled:opacity-40"
                  aria-label="Attach link"
                >
                  <Link2 className="w-4 h-4" />
                </button>
                <input
                  ref={inputRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={Boolean(disabledReason)}
                  placeholder={disabledReason ? 'Messaging unavailable' : (showTypeSelector && messageType === 'information_request' ? 'What do you need from the customer?' : 'Type a message…')}
                  className="flex-1 h-10 bg-transparent text-sm text-ink outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!canSend}
                  className="h-9 w-9 rounded-full bg-copper text-white inline-flex items-center justify-center disabled:opacity-40"
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
