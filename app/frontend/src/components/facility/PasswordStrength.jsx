export const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', checks: {} };
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score], checks };
};

export const PasswordStrength = ({ password }) => {
  const { score, label, checks } = getPasswordStrength(password);
  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              score >= i ? 'bg-copper' : 'bg-ink/10'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-ink-muted">{label}</p>
      <ul className="text-[11px] text-ink-faint space-y-0.5">
        <li className={checks.length ? 'text-copper' : ''}>At least 8 characters</li>
        <li className={checks.upper ? 'text-copper' : ''}>One uppercase letter</li>
        <li className={checks.lower ? 'text-copper' : ''}>One lowercase letter</li>
        <li className={checks.number ? 'text-copper' : ''}>One number</li>
      </ul>
    </div>
  );
};

export const isPasswordValid = (password) => {
  const { score } = getPasswordStrength(password);
  return score >= 4;
};
