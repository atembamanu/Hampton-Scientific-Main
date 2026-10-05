import { useEffect, useRef } from 'react';
import { API_URL } from '../config/apiBaseUrl';

export const useLiveUpdates = ({
  token,
  types,
  quoteId,
  orderId,
  invoiceId,
  onEvent,
  pollMs = 15000,
  enabled = true,
}) => {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !token) return undefined;

    const params = new URLSearchParams({ token });
    if (quoteId) params.set('quote_id', quoteId);
    if (orderId) params.set('order_id', orderId);
    const source = new EventSource(`${API_URL}/api/events/stream?${params.toString()}`);

    const matches = (data) => {
      if (!data || data.type === 'connected') return false;
      if (types && types.length && data.type !== 'poll' && !types.includes(data.type)) return false;
      if (quoteId && data.quoteId && data.quoteId !== quoteId && data.entityId !== quoteId) return false;
      if (orderId && data.orderId && data.orderId !== orderId && data.entityId !== orderId) return false;
      if (invoiceId && data.invoiceId && data.invoiceId !== invoiceId && data.entityId !== invoiceId) return false;
      return true;
    };

    source.onopen = () => {
      connectedRef.current = true;
    };
    source.onmessage = (event) => {
      connectedRef.current = true;
      try {
        const data = JSON.parse(event.data);
        if (matches(data)) onEventRef.current(data);
      } catch {
        /* ignore malformed payloads */
      }
    };
    source.onerror = () => {
      connectedRef.current = false;
    };

    const poll = window.setInterval(() => {
      onEventRef.current({ type: 'poll' });
    }, pollMs);

    return () => {
      source.close();
      window.clearInterval(poll);
    };
  }, [token, enabled, pollMs, quoteId, orderId, invoiceId, (types || []).join(',')]);
};
