import { formatPrice } from '../../utils/pricing';

const ProgressBar = ({ percent }) => {
  const width = percent == null ? 0 : Math.min(percent, 100);
  return (
    <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
      <div className="h-full bg-copper" style={{ width: `${width}%` }} />
    </div>
  );
};

export const SalesTargetCard = ({ row, month, action, own = false }) => {
  if (!row) return null;
  const progress = row.targetSet
    ? `${row.progressPercent}% of ${formatPrice(row.monthlyTarget)}`
    : 'Monthly target not set';
  return (
    <section className="editorial-panel p-5 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="editorial-label">Sales target · {month}</p>
          <h2 className="text-xl font-semibold mt-1">{own ? 'Your target' : row.agentName}</h2>
        </div>
        {action}
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
        <div>
          <p className="text-xs text-ink-muted">Monthly target</p>
          <p className="text-lg font-semibold tabular-nums">{row.targetSet ? formatPrice(row.monthlyTarget) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Paid invoices (net of tax)</p>
          <p className="text-lg font-semibold tabular-nums">{formatPrice(row.achieved)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Commission rate</p>
          <p className="text-lg font-semibold">{row.commissionRate}%</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Estimated commission</p>
          <p className="text-lg font-semibold tabular-nums">{formatPrice(row.estimatedCommission)}</p>
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar percent={row.progressPercent} />
        <p className="text-xs text-ink-muted mt-2">
          {progress}
          {' · '}
          {row.facilityCount} {row.facilityCount === 1 ? 'facility' : 'facilities'} registered
        </p>
        <p className="text-xs text-ink-muted mt-1">
          Progress is this month’s paid invoices (total minus tax) for facilities you registered. Commission is that amount times your rate.
        </p>
      </div>
    </section>
  );
};

export const SalesPerformanceTable = ({ rows, month }) => (
  <section className="editorial-panel p-5 mb-6">
    <p className="editorial-label">Sales performance · {month}</p>
    <h2 className="text-xl font-semibold mt-1 mb-4">Targets and commission</h2>
    {rows.length === 0 ? (
      <p className="text-sm text-ink-muted">No sales agents yet.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs text-ink-muted border-b border-ink/10">
              <th className="py-2 pr-3 font-medium">Agent</th>
              <th className="py-2 pr-3 font-medium">Target</th>
              <th className="py-2 pr-3 font-medium">Paid net</th>
              <th className="py-2 pr-3 font-medium">Progress</th>
              <th className="py-2 pr-3 font-medium">Rate</th>
              <th className="py-2 font-medium">Commission</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.agentId} className="border-b border-ink/5">
                <td className="py-3 pr-3">
                  <p className="font-medium">{row.agentName}</p>
                  <p className="text-xs text-ink-muted">{row.facilityCount} registered</p>
                </td>
                <td className="py-3 pr-3 tabular-nums">{row.targetSet ? formatPrice(row.monthlyTarget) : '—'}</td>
                <td className="py-3 pr-3 tabular-nums">{formatPrice(row.achieved)}</td>
                <td className="py-3 pr-3 w-40">
                  <ProgressBar percent={row.progressPercent} />
                  <p className="text-xs text-ink-muted mt-1">{row.targetSet ? `${row.progressPercent}%` : 'No target'}</p>
                </td>
                <td className="py-3 pr-3">{row.commissionRate}%</td>
                <td className="py-3 tabular-nums">{formatPrice(row.estimatedCommission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);
