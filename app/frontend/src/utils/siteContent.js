import { useEffect, useState } from 'react';
import axios from 'axios';

import { API_URL } from '../config/apiBaseUrl';
import { contactInfo as fallbackContact, partners as fallbackPartners, stats as fallbackStats } from '../data/catalog';

const CACHE_MS = 30000;
let cache = null;
let cachedAt = 0;
let inflight = null;

export const websiteHref = (url = '') => {
  const value = String(url || '').trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

export const websiteLabel = (url = '') => (
  String(url || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
);

const mapContact = (data = {}) => ({
  companyName: data.company_name || 'Hampton Scientific',
  website: data.website || fallbackContact.website || '',
  address: data.address || fallbackContact.address,
  poBox: data.po_box || fallbackContact.poBox,
  phone: data.phone || fallbackContact.phone,
  email: data.email || fallbackContact.email,
  workingHours: data.working_hours || fallbackContact.workingHours,
  googleMapsUrl: data.google_maps_url || '',
});

export async function fetchSiteContent() {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_MS) return cache;
  if (inflight) return inflight;
  inflight = axios.get(`${API_URL}/api/settings`)
    .then(({ data }) => {
      const impact = Array.isArray(data?.impact_stats) && data.impact_stats.length
        ? data.impact_stats
        : fallbackStats;
      const partners = Array.isArray(data?.partners) && data.partners.length
        ? data.partners
        : fallbackPartners;
      cache = {
        contact: mapContact(data || {}),
        impact,
        partners,
      };
      cachedAt = Date.now();
      return cache;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export function useSiteContent() {
  const [state, setState] = useState({
    contact: mapContact(),
    impact: fallbackStats,
    partners: fallbackPartners,
    loading: true,
  });
  useEffect(() => {
    let cancelled = false;
    fetchSiteContent()
      .then((data) => { if (!cancelled) setState({ ...data, loading: false }); })
      .catch(() => { if (!cancelled) setState((prev) => ({ ...prev, loading: false })); });
    return () => { cancelled = true; };
  }, []);
  return state;
}
