import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

import { API_URL } from '../config/apiBaseUrl';

const typeLabel = (value) => ({
  'full-time': 'Full time',
  'part-time': 'Part time',
  contract: 'Contract',
  internship: 'Internship',
}[value] || value);

export const Careers = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/careers`)
      .then(({ data }) => setJobs(data || []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen pb-20 bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="editorial-label mb-3">Hampton Scientific</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight mb-3">Careers</h1>
        <p className="text-ink-muted text-sm mb-12 max-w-xl">
          Join a team supplying medical equipment and training to healthcare facilities across Africa.
        </p>

        {loading ? (
          <p className="text-sm text-ink-muted">Loading openings…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-ink-muted">There are no open roles right now. Please check back soon.</p>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/careers/${job.id}`}
                  className="block editorial-panel hover:border-copper/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-ink text-lg">{job.title}</h2>
                      <p className="text-sm text-ink-muted mt-1">
                        {[job.department, job.location, typeLabel(job.employment_type)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-copper self-start">View & apply</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
