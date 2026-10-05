import axios from 'axios';
import { toast } from 'sonner';

import { API_URL } from '../config/apiBaseUrl';

export async function startOrderAgain({
  order,
  getAuthHeader,
  hasItems,
  confirm,
  loadReorderQuote,
  navigate,
}) {
  if (!order?.id) return false;

  if (hasItems) {
    const approved = await confirm({
      label: 'Order again',
      title: 'Replace the quote in progress?',
      description: 'This starts a new quote from the order. Items currently in your basket will be replaced. You can still change quantities or add products before sending it to Hampton.',
      confirmLabel: 'Start quote',
    });
    if (!approved) return false;
  }

  try {
    const res = await axios.post(
      `${API_URL}/api/orders/${order.id}/reorder`,
      {},
      { headers: getAuthHeader() },
    );
    const loaded = loadReorderQuote(res.data, { sourceLabel: order.orderNumber || order.order_number });
    if (!loaded) return false;
    navigate('/dashboard/quote', { state: { fromReorder: true } });
    return true;
  } catch (err) {
    toast.error(err.response?.data?.detail || 'Could not start order again');
    return false;
  }
}
