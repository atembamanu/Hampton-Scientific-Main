export const SalesAssignSelect = ({
  agents = [],
  value,
  name,
  canAssign,
  disabled,
  onChange,
  className = 'editorial-panel p-5',
}) => (
  <div className={className}>
    <p className="text-xs text-ink-faint mb-1">Sales agent</p>
    {canAssign ? (
      <select
        value={value || ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 h-9 border border-ink/15 rounded-lg px-2 text-sm w-full bg-white disabled:bg-gray-50"
      >
        <option value="">Unassigned</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>{agent.name || agent.email}</option>
        ))}
      </select>
    ) : (
      <p className="font-medium text-ink">{name || 'Unassigned'}</p>
    )}
  </div>
);
