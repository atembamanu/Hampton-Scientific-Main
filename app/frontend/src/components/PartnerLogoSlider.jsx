import { partnerLogos } from '../data/partnerLogos';

const LogoCell = ({ partner }) => (
  <a
    href={partner.href}
    target="_blank"
    rel="noopener noreferrer"
    className="partner-logo-cell group inline-flex h-16 w-[9.5rem] sm:h-[4.5rem] sm:w-44 flex-shrink-0 items-center justify-center px-4"
    title={partner.name}
  >
    <img
      src={partner.logo}
      alt={partner.name}
      loading="lazy"
      decoding="async"
      className="max-h-10 sm:max-h-12 max-w-full object-contain opacity-70 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0"
    />
  </a>
);

export const PartnerLogoSlider = ({ logos = partnerLogos }) => {
  if (!logos?.length) return null;
  // Duplicate for a seamless CSS marquee loop
  const track = [...logos, ...logos];

  return (
    <div className="partner-marquee relative overflow-hidden" aria-label="Manufacturing partners">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-20 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-20 bg-gradient-to-l from-white to-transparent" />
      <div className="partner-marquee-track flex w-max items-center gap-2 sm:gap-4">
        {track.map((partner, index) => (
          <LogoCell key={`${partner.name}-${index}`} partner={partner} />
        ))}
      </div>
    </div>
  );
};
