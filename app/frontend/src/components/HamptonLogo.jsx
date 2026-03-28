
// New SVG Logo from the provided file
export const HamptonLogo = ({ className = "", size = "default" }) => {
  const sizes = {
    small: { width: 180, height: 30 },
    default: { width: 240, height: 36 },
    large: { width: 320, height: 48 }
  };
  
  const { width, height } = sizes[size] || sizes.default;

  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src="/hampton-logo.svg" 
        alt="Hampton Scientific - Medical Supplier & Trainer"
        width={width}
        height={height}
        style={{ width, height: 'auto' }}
      />
    </div>
  );
};

// Simplified icon-only version for favicon/small spaces - uses the medical cross icon from the logo
export const HamptonIcon = ({ size = 48, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="100" height="100" rx="16" fill="url(#hamptonGradientIcon)" />
    {/* Medical cross from logo */}
    <rect x="40" y="20" width="20" height="60" rx="2" fill="white" />
    <rect x="20" y="40" width="60" height="20" rx="2" fill="white" />
    <defs>
      <linearGradient id="hamptonGradientIcon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#006332" />
        <stop offset="100%" stopColor="#00a550" />
      </linearGradient>
    </defs>
  </svg>
);
