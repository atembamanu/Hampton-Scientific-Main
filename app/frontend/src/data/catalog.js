// Catalog data + helpers for template preview

const PLACEHOLDER = {
  machine: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80',
  bed: 'https://images.unsplash.com/photo-1519494023792-5ffc331114c2?w=800&q=80',
  consumable: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80',
  monitor: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=800&q=80',
  lab: 'https://images.unsplash.com/photo-1532187863486-abf9db8811e6?w=800&q=80',
  fridge: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80',
};

export const contactInfo = {
  address: 'Ushuru Pension Plaza, Muthangari Drive Block C, First Floor',
  poBox: 'P.O. Box 162 - 00517 Westlands, Nairobi',
  phone: '0717 023 814',
  email: 'info@hamptonscientific.com',
  website: 'www.hamptonscientific.com',
  workingHours: 'Mon - Fri: 8:00 AM - 5:00 PM EAT',
};

export const aboutHeroImage =
  'https://images.unsplash.com/photo-1603398938378-e54eab446dde?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHw0fHxtZWRpY2FsfGVufDB8fHx8MTc2ODQ3MjY4NHww&ixlib=rb-4.1.0&q=85';

export const aboutMission =
  'To deliver reliable, cutting-edge healthcare tools and technologies to medical facilities across Africa, empowering healthcare providers with the equipment and knowledge they need to deliver high-quality patient care.';

export const aboutVision =
  "To be Africa's leading healthcare solutions provider, recognized for excellence in medical equipment supply, training, and support services that transform healthcare delivery across the continent.";

export const aboutWhatWeDo = [
  "Hampton Scientific Limited connects Africa's healthcare sector with global scientific and healthcare innovations. We enable healthcare providers to access reliable, cutting-edge tools and technologies that support high-quality patient care.",
  'Our mission is to deliver the right healthcare solutions to your facility—sourced exclusively from trusted and certified healthcare equipment manufacturers.',
  'Beyond procurement, we support your facility with customized training, certified installations, and reliable maintenance throughout the service lifecycle.',
];

export const aboutValues = [
  { title: 'Quality First', description: 'We source only certified, reliable equipment from trusted global manufacturers.' },
  { title: 'Customer Focus', description: 'Your success is our priority — comprehensive support throughout your journey.' },
  { title: 'Excellence', description: 'Commitment to the highest standards in service delivery and technical expertise.' },
  { title: 'Innovation', description: 'Bringing cutting-edge healthcare solutions to African medical facilities.' },
];

export const aboutCapabilities = [
  'Exclusive partnerships with certified global manufacturers',
  'Deep understanding of African healthcare infrastructure',
  'Technical expertise in medical equipment installation',
  'Comprehensive training programs for healthcare professionals',
  'Reliable supply chain and logistics management',
  'After-sales support and maintenance services',
  'Quality assurance and compliance standards',
  'Customized solutions for diverse facility needs',
];

export const aboutImpactStats = [
  { value: '4+', label: 'Years Enabling Healthcare' },
  { value: '10+', label: 'Facilities Served' },
  { value: '1,000+', label: 'Staff Trained' },
  { value: '50+', label: 'Product Categories' },
];

/** Detailed categories — used in mega menu & product filtering */
export const allCategories = [
  { category_id: 'haematology', name: 'Haematology', slug: 'haematology', parent_id: 'equipments' },
  { category_id: 'haematology-analyzers', name: 'Haematology Analyzers', slug: 'haematology-analyzers', parent_id: 'haematology' },
  { category_id: 'haematology-reagents', name: 'Haematology Reagents', slug: 'haematology-reagents', parent_id: 'consumables' },
  { category_id: 'haematology-controls-calibrators', name: 'Haematology Controls & Calibrators', slug: 'haematology-controls-calibrators', parent_id: 'consumables' },
  { category_id: 'haemoglobin-meters', name: 'Haemoglobin Meters', slug: 'haemoglobin-meters', parent_id: 'equipments' },
  { category_id: 'clinical-chemistry', name: 'Clinical Chemistry', slug: 'clinical-chemistry', parent_id: 'equipments' },
  { category_id: 'immunoassay', name: 'Immunoassay', slug: 'immunoassay', parent_id: 'equipments' },
  { category_id: 'i-chroma-reagents', name: 'I-Chroma Reagents', slug: 'i-chroma-reagents', parent_id: 'consumables' },
  { category_id: 'critical-care', name: 'Critical Care', slug: 'critical-care', parent_id: 'equipments' },
  { category_id: 'rapid-test-strips', name: 'Rapid Test Strips', slug: 'rapid-test-strips', parent_id: 'consumables' },
  { category_id: 'blood-sugar-testing', name: 'Blood Sugar Testing', slug: 'blood-sugar-testing', parent_id: 'consumables' },
  { category_id: 'specimen-collections', name: 'Specimen Collections', slug: 'specimen-collections', parent_id: 'consumables' },
  { category_id: 'general-laboratory-equipments', name: 'General Laboratory Equipments', slug: 'general-laboratory-equipments', parent_id: 'equipments' },
  { category_id: 'hospital-furniture', name: 'Hospital Furniture', slug: 'hospital-furniture', parent_id: 'equipments' },
  { category_id: 'hospital-beds', name: 'Hospital Beds', slug: 'hospital-beds', parent_id: 'hospital-furniture' },
  { category_id: 'medical-consumables', name: 'Medical Consumables', slug: 'medical-consumables', parent_id: 'consumables' },
];

/** Top-level bar categories — keep the strip clean */
export const mainCategories = [
  {
    slug: 'equipments',
    label: 'Equipments',
    description: 'Analyzers, monitors, lab machines & hospital furniture',
    children: [
      { slug: 'haematology', name: 'Haematology' },
      { slug: 'clinical-chemistry', name: 'Clinical Chemistry' },
      { slug: 'immunoassay', name: 'Immunoassay' },
      { slug: 'critical-care', name: 'Critical Care' },
      { slug: 'general-laboratory-equipments', name: 'General Laboratory Equipments' },
      { slug: 'hospital-furniture', name: 'Hospital Furniture' },
      { slug: 'haemoglobin-meters', name: 'Haemoglobin Meters' },
    ],
  },
  {
    slug: 'consumables',
    label: 'Consumables',
    description: 'Reagents, test strips, gloves, tubes & disposables',
    children: [
      { slug: 'medical-consumables', name: 'Medical Consumables' },
      { slug: 'rapid-test-strips', name: 'Rapid Test Strips' },
      { slug: 'blood-sugar-testing', name: 'Blood Sugar Testing' },
      { slug: 'specimen-collections', name: 'Specimen Collections' },
      { slug: 'haematology-reagents', name: 'Haematology Reagents' },
      { slug: 'i-chroma-reagents', name: 'I-Chroma Reagents' },
    ],
  },
];

/** @deprecated use mainCategories for nav bar */
export const topLevelCategories = mainCategories.flatMap((m) =>
  m.children.map((c) => allCategories.find((a) => a.slug === c.slug)).filter(Boolean)
);

export const categoryMenu = mainCategories;

export const navItems = [
  { label: 'Home', path: '/' },
  {
    label: 'About us',
    path: '/about',
    children: [
      { label: 'Why Hampton Scientific', path: '/about' },
      { label: 'History & Mission', path: '/about' },
      { label: 'Our Team', path: '/about' },
      { label: 'Regional Presence', path: '/about' },
    ],
  },
  { label: 'Our Products', path: '/products' },
  { label: 'Training & Service', path: '/training' },
  { label: 'Careers', path: '/careers' },
  { label: 'Contact Us', path: '/contact' },
];

const rawProducts = [
  { slug: 'cellscan-30-analyzer', name: 'CellScan 30 Analyzer', category: 'Haematology', categorySlug: 'haematology', inStock: true, image: 'https://microbiology.co.ke/wp-content/uploads/2025/06/30.jpg', type: 'machine', description: 'Robust 3-part haematology analyzer for cost-minded, quality-focused clinical laboratories.', highlights: ['Only requires 10µL whole blood', '21 reportable parameters', 'Bi-directional LIS connectivity'] },
  { slug: 'cellscan-50-analyzer', name: 'CellScan 50 Analyzer', category: 'Haematology', categorySlug: 'haematology', inStock: true, image: 'https://microbiology.co.ke/wp-content/uploads/2025/06/50.jpg', type: 'machine', description: 'Mid-volume haematology analyzer for clinical laboratories.', highlights: [] },
  { slug: 'ichroma-ii', name: 'Ichroma II Reader', category: 'Immunoassay', categorySlug: 'immunoassay', inStock: true, image: 'https://microbiology.co.ke/wp-content/uploads/2025/02/ichroma-ii-immunoassay-analyzer-500x500-1.webp', type: 'machine', description: 'POCT immunofluorescence analyzer for cardiac, cancer, diabetes, and infection markers.', highlights: [] },
  { slug: 'edan-i15-blood-gas-analyzer', name: 'Edan i15 Blood Gas Analyzer', category: 'Critical Care', categorySlug: 'critical-care', inStock: true, image: PLACEHOLDER.monitor, type: 'machine', description: 'Compact, portable blood gas analyzer for point-of-care testing in hospitals and ICUs.', highlights: ['Compact and lightweight', 'Fast turnaround for urgent care'] },
  { slug: 'core-autochem-analyzer', name: 'Core AutoChem Analyzer', category: 'Clinical Chemistry', categorySlug: 'clinical-chemistry', inStock: true, image: PLACEHOLDER.lab, type: 'machine', description: 'Italian-made auto chemistry analyzer for quality-minded laboratories.', highlights: [] },
  { slug: 'electric-hospital-bed', name: 'Electric Hospital Bed', category: 'Hospital Beds', categorySlug: 'hospital-beds', inStock: true, image: PLACEHOLDER.bed, type: 'bed', description: 'Adjustable electric hospital bed with side rails and trendelenburg positioning.', highlights: ['Electric height adjustment', 'CPR quick-release', 'Lockable castors'] },
  { slug: 'icu-patient-monitor', name: 'ICU Patient Monitor', category: 'Critical Care', categorySlug: 'critical-care', inStock: true, image: PLACEHOLDER.monitor, type: 'machine', description: 'Multi-parameter patient monitor for ICU and emergency departments.', highlights: ['ECG, SpO2, NIBP, temp', 'Alarm management'] },
  { slug: 'laboratory-centrifuge', name: 'Laboratory Centrifuge', category: 'General Laboratory Equipments', categorySlug: 'general-laboratory-equipments', inStock: true, image: PLACEHOLDER.machine, type: 'machine', description: 'Benchtop centrifuge for clinical and research laboratories.', highlights: [] },
  { slug: 'pharmacy-refrigerator', name: 'Pharmacy Refrigerator HYC-390', category: 'General Laboratory Equipments', categorySlug: 'general-laboratory-equipments', inStock: true, image: PLACEHOLDER.fridge, type: 'machine', description: 'Temperature-controlled pharmaceutical refrigerator for vaccines and medicines.', highlights: ['2–8°C range', 'Alarm system'] },
  { slug: 'surgical-gloves-box', name: 'Nitrile Surgical Gloves (100 pcs)', category: 'Medical Consumables', categorySlug: 'medical-consumables', inStock: true, image: PLACEHOLDER.consumable, type: 'consumable', description: 'Powder-free nitrile examination gloves, box of 100.', highlights: [] },
  { slug: 'blood-collection-tubes', name: 'Vacutainer Blood Collection Tubes', category: 'Specimen Collections', categorySlug: 'specimen-collections', inStock: true, image: PLACEHOLDER.consumable, type: 'consumable', description: 'EDTA, serum, and fluoride tubes for laboratory specimen collection.', highlights: [] },
  { slug: 'rapid-malaria-test', name: 'Rapid Malaria Test Strips', category: 'Rapid Test Strips', categorySlug: 'rapid-test-strips', inStock: true, image: PLACEHOLDER.consumable, type: 'consumable', description: 'Point-of-care malaria rapid diagnostic test strips.', highlights: [] },
  { slug: 'glucose-test-strips', name: 'Blood Glucose Test Strips', category: 'Blood Sugar Testing', categorySlug: 'blood-sugar-testing', inStock: true, image: PLACEHOLDER.consumable, type: 'consumable', description: 'Compatible test strips for blood glucose monitoring systems.', highlights: [] },
  { slug: 'stretcher-emergency', name: 'Emergency Stretcher', category: 'Hospital Furniture', categorySlug: 'hospital-furniture', inStock: true, image: PLACEHOLDER.bed, type: 'bed', description: 'Collapsible emergency stretcher for ambulance and ER use.', highlights: [] },
  { slug: 'haemoglobin-meters', name: 'Hemochroma HB Meter', category: 'Haemoglobin Meters', categorySlug: 'haemoglobin-meters', inStock: true, image: 'https://microbiology.co.ke/wp-content/uploads/2025/02/Meter.png', type: 'machine', description: 'Portable haemoglobin meter for point-of-care testing.', highlights: [] },
];

const LIST_PRICE_BY_SLUG = {
  'cellscan-30-analyzer': 2850000,
  'cellscan-50-analyzer': 4200000,
  'ichroma-ii': 1850000,
  'edan-i15-blood-gas-analyzer': 980000,
  'core-autochem-analyzer': 3200000,
  'electric-hospital-bed': 185000,
  'icu-patient-monitor': 650000,
  'laboratory-centrifuge': 245000,
  'pharmacy-refrigerator': 320000,
  'surgical-gloves-box': 1500,
  'blood-collection-tubes': 800,
  'rapid-malaria-test': 450,
  'glucose-test-strips': 1200,
  'stretcher-emergency': 95000,
  'haemoglobin-meters': 42000,
};

const PRICE_UNIT_BY_TYPE = {
  machine: 'unit',
  bed: 'unit',
  consumable: 'box',
};

export const products = rawProducts.map((p, i) => ({
  id: i + 1,
  listPrice: LIST_PRICE_BY_SLUG[p.slug] ?? 0,
  priceUnit: PRICE_UNIT_BY_TYPE[p.type] || 'unit',
  currency: 'KES',
  ...p,
}));

/** Carousel slides — editorial format with accent word */
export const heroSlides = [
  {
    tagline: 'Laboratory Equipment',
    headlineBefore: 'Your lab doesn\'t just test. It ',
    accentWord: 'diagnoses',
    headlineAfter: ' with precision.',
    subtitle: 'Haematology analyzers and chemistry systems built for cost-minded, quality-focused clinical laboratories.',
    productSlug: 'cellscan-30-analyzer',
    image: rawProducts[0].image,
  },
  {
    tagline: 'Hospital Furniture',
    headlineBefore: 'Care starts with the ',
    accentWord: 'right',
    headlineAfter: ' equipment.',
    subtitle: 'Electric hospital beds and emergency stretchers designed for patient comfort and clinical efficiency.',
    productSlug: 'electric-hospital-bed',
    image: PLACEHOLDER.bed,
  },
  {
    tagline: 'Critical Care',
    headlineBefore: 'Every second ',
    accentWord: 'counts',
    headlineAfter: ' in the ICU.',
    subtitle: 'Portable blood gas analyzers and patient monitors for point-of-care testing when it matters most.',
    productSlug: 'edan-i15-blood-gas-analyzer',
    image: PLACEHOLDER.monitor,
  },
  {
    tagline: 'Medical Consumables',
    headlineBefore: 'Small items. ',
    accentWord: 'Big',
    headlineAfter: ' impact.',
    subtitle: 'Gloves, collection tubes, and rapid test strips — the essentials that keep healthcare running.',
    productSlug: 'surgical-gloves-box',
    image: PLACEHOLDER.consumable,
  },
  {
    tagline: 'Immunoassay',
    headlineBefore: 'Results you can ',
    accentWord: 'trust',
    headlineAfter: '.',
    subtitle: 'POCT immunofluorescence readers for cardiac, cancer, diabetes, and infection biomarkers.',
    productSlug: 'ichroma-ii',
    image: rawProducts[2].image,
  },
  {
    tagline: 'Specimen Collection',
    headlineBefore: 'From sample to ',
    accentWord: 'answer',
    headlineAfter: '.',
    subtitle: 'Vacutainer tubes and collection systems that preserve specimen integrity from draw to lab.',
    productSlug: 'blood-collection-tubes',
    image: PLACEHOLDER.consumable,
  },
];

export const solutionTags = ['Equipments', 'Consumables', 'Laboratory Solutions', 'Critical Care', 'Hospital Furniture', 'Training & Service'];

export const valueProps = [
  { title: 'Deliver', description: 'Prompt delivery and installation' },
  { title: 'Inventory', description: 'Wide range of local inventory' },
  { title: 'Pricing', description: 'Internationally competitive pricing' },
  { title: 'Support', description: 'Comprehensive after-sales support' },
  { title: 'Experience', description: 'Over 10 years of experience' },
];

export const divisions = [
  { title: 'Equipments', image: PLACEHOLDER.lab, link: '/products?category=equipments' },
  { title: 'Consumables', image: PLACEHOLDER.consumable, link: '/products?category=consumables' },
  { title: 'Critical Care', image: PLACEHOLDER.monitor, link: '/products?category=critical-care' },
  { title: 'Furniture', image: PLACEHOLDER.bed, link: '/products?category=hospital-furniture' },
];

export const stats = [
  { value: '50+', label: 'Hospitals Supplied' },
  { value: '100+', label: 'Healthcare Facilities' },
  { value: '10+', label: 'Years Experience' },
  { value: '1,000+', label: 'Staff Trained' },
  { value: '300+', label: 'Youths Empowered' },
];

export const partners = ['Mindray', 'Omron', 'Haier', 'Sysmex', 'Abbott', 'Roche'];

export const projects = [
  { title: 'Laboratory Equipment — Nairobi Hospital', date: '28/07/2025', image: PLACEHOLDER.lab },
  { title: 'Patient Monitors — Aga Khan University Hospital', date: '28/07/2025', image: PLACEHOLDER.monitor },
  { title: 'Cold Chain Solutions — Regional Clinic Network', date: '15/06/2025', image: PLACEHOLDER.fridge },
  { title: 'Training Programme — County Health Labs', date: '02/05/2025', image: PLACEHOLDER.machine },
];

export const productCategories = ['All categories', 'Equipments', 'Consumables'];

const equipmentSlugs = new Set([
  'equipments', 'haematology', 'haematology-analyzers', 'haemoglobin-meters',
  'clinical-chemistry', 'immunoassay', 'critical-care', 'general-laboratory-equipments',
  'hospital-furniture', 'hospital-beds',
]);

const consumableSlugs = new Set([
  'consumables', 'haematology-reagents', 'haematology-controls-calibrators',
  'i-chroma-reagents', 'rapid-test-strips', 'blood-sugar-testing',
  'specimen-collections', 'medical-consumables',
]);

export function getProductBySlug(slug) {
  return products.find((p) => p.slug === slug);
}

/** Map catalog product to quote-cart shape */
export function toQuoteProduct(product) {
  const productId = product.product_id || product.productId || product.slug || product.id;
  const categoryId = product.category_id || product.categoryId || product.categorySlug || '';
  return {
    id: productId,
    slug: product.slug || String(productId),
    sku: product.sku || String(productId),
    name: product.name,
    categoryId,
    categoryName: product.category_name || product.categoryName || product.category || '',
    listPrice: product.listPrice ?? product.price ?? 0,
    priceUnit: product.priceUnit || product.stocking_unit || product.unit || 'unit',
    currency: product.currency || 'KES',
    price: product.listPrice ?? product.price ?? 0,
    unit: product.priceUnit || product.stocking_unit || product.unit || 'unit',
    image: product.image || product.image_url,
  };
}

export function getCategoryBySlug(slug) {
  return allCategories.find((c) => c.slug === slug);
}

export function getProductsByCategorySlug(categorySlug) {
  if (!categorySlug || categorySlug === 'all') return products;

  if (categorySlug === 'equipments') {
    return products.filter((p) => equipmentSlugs.has(p.categorySlug) || p.type === 'machine' || p.type === 'bed');
  }
  if (categorySlug === 'consumables') {
    return products.filter((p) => consumableSlugs.has(p.categorySlug) || p.type === 'consumable');
  }

  const cat = getCategoryBySlug(categorySlug);
  if (!cat) return products;

  const childSlugs = allCategories
    .filter((c) => c.parent_id === cat.category_id || c.parent_id === cat.slug)
    .map((c) => c.slug);
  const slugs = new Set([cat.slug, ...childSlugs]);
  return products.filter((p) => slugs.has(p.categorySlug));
}

export function getMainCategoryLabel(slug) {
  const main = mainCategories.find((m) => m.slug === slug);
  if (main) return main.label;
  const cat = getCategoryBySlug(slug);
  return cat?.name ?? 'Our Products';
}

/** Shuffle carousel order on each page load */
export function getShuffledHeroSlides() {
  return [...heroSlides].sort(() => Math.random() - 0.5);
}
