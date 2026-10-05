import { Link } from 'react-router-dom';
import { GraduationCap, Wrench, Settings } from 'lucide-react';

const services = [
  { icon: GraduationCap, title: 'Equipment Training', description: 'Hands-on courses for operation, quality control, and troubleshooting.' },
  { icon: Wrench, title: 'Installation', description: 'Professional setup and commissioning of analyzers and monitors.' },
  { icon: Settings, title: 'Maintenance', description: 'Scheduled calibration and lifecycle support for installed equipment.' },
];

export const Training = () => (
  <div className="min-h-screen pb-20 bg-cream">
    <div className="max-w-6xl mx-auto px-6 py-12">
      <p className="editorial-label mb-3">Training & Service</p>
      <h1 className="editorial-headline mb-6">
        Support that makes every{' '}
        <span className="text-copper">installation</span> count.
      </h1>
      <p className="text-ink-muted max-w-lg mb-16 leading-relaxed">
        From first setup to ongoing maintenance — we help your team get the most from your equipment.
      </p>

      <div className="grid md:grid-cols-3 gap-8 section-divider pt-12">
        {services.map(({ icon: Icon, title, description }) => (
          <div key={title} className="bg-white rounded-2xl border border-ink/10 p-6 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-cream-dark flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-copper" />
            </div>
            <h2 className="font-semibold text-ink mb-2">{title}</h2>
            <p className="text-sm text-ink-muted leading-relaxed">{description}</p>
          </div>
        ))}
      </div>

      <div className="text-center mt-16">
        <Link to="/contact" className="btn-primary">Enquire</Link>
      </div>
    </div>
  </div>
);
