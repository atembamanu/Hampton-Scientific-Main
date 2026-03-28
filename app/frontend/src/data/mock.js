// Mock data for Hampton Scientific Limited - Updated with actual prices

export const productCategories = [
  {
    id: '1',
    name: 'Diagnostic Test Kits & Reagents',
    description: 'Products used for laboratory testing and disease diagnosis across clinical and research settings.',
    image: 'https://images.unsplash.com/photo-1656337426914-5e5ba162d606?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwbGFib3JhdG9yeSUyMGVxdWlwbWVudHxlbnwwfHx8fDE3Njg0NzI2NzR8MA&ixlib=rb-4.1.0&q=85',
    products: [
      { id: 'p1', name: 'Blood grouping kit (A, B, D)', price: 1600, unit: '1*10ml', inStock: true },
      { id: 'p2', name: 'Widal Reagent Kit', price: 1000, unit: '1*50ml', inStock: true },
      { id: 'p3', name: 'ASOT Reagent kit', price: 1400, unit: '1*50ml', inStock: true },
      { id: 'p4', name: 'Rheumatoid Factor (RF)', price: 1600, unit: '1*50ML', inStock: true },
      { id: 'p5', name: 'Salmonella Ag', price: 3800, unit: '1*25T', inStock: true },
      { id: 'p6', name: 'Salmonella AB', price: 3200, unit: '1*25T', inStock: true },
      { id: 'p7', name: 'H pylori Ag', price: 3500, unit: '1*25T', inStock: true },
      { id: 'p8', name: 'H pylori AB', price: 3300, unit: '1*50T', inStock: true },
      { id: 'p9', name: 'Rota Adeno Virus', price: 4700, unit: '1*25T', inStock: true },
      { id: 'p10', name: 'Dengue Combo NSI/Igg/Igm Cellex', price: 11444, unit: '1*25T', inStock: true },
      { id: 'p11', name: 'Cholera Ag', price: 7600, unit: '1*25T', inStock: true },
      { id: 'p12', name: 'Syphilis/VDRL', price: 1400, unit: '1*50T', inStock: true },
      { id: 'p13', name: 'Gonorrhea Strips', price: 5220, unit: '1*25T', inStock: true },
      { id: 'p14', name: 'Malaria pf Ag', price: 1740, unit: '1*25T', inStock: true },
      { id: 'p15', name: 'Malaria pf/Pan Ag', price: 2900, unit: '1*25T', inStock: true },
      { id: 'p16', name: 'Faecal Occult Blood (FOB)', price: 4700, unit: '1*25T', inStock: true },
      { id: 'p17', name: 'Brucellosis', price: 4410, unit: '1*40T', inStock: true },
      { id: 'p18', name: 'Prostate Specific (PSA) Ag', price: 4640, unit: '1*40T', inStock: true },
      { id: 'p19', name: 'Hepatitis A', price: 5220, unit: '1*25T', inStock: true },
      { id: 'p20', name: 'Hepatitis B', price: 1500, unit: '1*50T', inStock: true },
      { id: 'p21', name: 'Hepatitis C', price: 4600, unit: '1*50T', inStock: true }
    ]
  },
  {
    id: '2',
    name: 'Blood Collection & Hematology Supplies',
    description: 'Supplies required for blood sampling, handling, and hematological analysis.',
    image: 'https://images.unsplash.com/photo-1601839215170-6ce5854968d6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwyfHxtZWRpY2FsJTIwbGFib3JhdG9yeSUyMGVxdWlwbWVudHxlbnwwfHx8fDE3Njg0NzI2NzR8MA&ixlib=rb-4.1.0&q=85',
    products: [
      { id: 'p22', name: 'Purple Top Vacutainers (EDTA)', price: 1100, unit: "100's", inStock: true },
      { id: 'p23', name: 'Red Top with clot Activator Vacutainers', price: 1100, unit: "100's", inStock: true },
      { id: 'p24', name: 'Plain Top without Clot Activator', price: 930, unit: "100's", inStock: true },
      { id: 'p25', name: 'Yellow Top Vacutainers', price: 2600, unit: "100's", inStock: true },
      { id: 'p26', name: 'Blue Top (Sodium Citrate) Vacutainers', price: 2600, unit: "100's", inStock: true },
      { id: 'p27', name: 'Grey Top (Sodium Fluoride) vacutainers', price: 2600, unit: "100's", inStock: true },
      { id: 'p28', name: 'Green Top Vacutainers', price: 2600, unit: "100's", inStock: true },
      { id: 'p29', name: 'Purple Top Microtainers', price: 2600, unit: "100's", inStock: true },
      { id: 'p30', name: 'Plain Top Microtainers', price: 2600, unit: "100's", inStock: true },
      { id: 'p31', name: 'Vacutainer needles', price: 1400, unit: "100's", inStock: true },
      { id: 'p32', name: 'Tourniquet', price: 560, unit: '1pc', inStock: true },
      { id: 'p33', name: 'Blood Lancets', price: 240, unit: "100's", inStock: true },
      { id: 'p34', name: 'ESR Tubes(disposable)', price: 70, unit: '1pc', inStock: true },
      { id: 'p35', name: 'ESR Tubes (Glass)', price: 180, unit: '1pc', inStock: true },
      { id: 'p36', name: 'ESR Stand', price: 3900, unit: '1pc', inStock: true }
    ]
  },
  {
    id: '3',
    name: 'Urinalysis & Stool Collection Supplies',
    description: 'Consumables designed for urine and stool specimen collection and routine analysis.',
    image: 'https://images.unsplash.com/photo-1656337426953-554b8e5b50f5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwzfHxtZWRpY2FsJTIwbGFib3JhdG9yeSUyMGVxdWlwbWVudHxlbnwwfHx8fDE3Njg0NzI2NzR8MA&ixlib=rb-4.1.0&q=85',
    products: [
      { id: 'p37', name: 'URINALYSIS STRIPS P10', price: 1400, unit: '100T', inStock: true },
      { id: 'p38', name: 'URINALYSIS STRIPS (mission)', price: 1400, unit: '100T', inStock: true },
      { id: 'p39', name: 'Urine Containers 50ml', price: 1200, unit: "100's", inStock: true },
      { id: 'p40', name: 'Sterile Urine Containers', price: 18, unit: '1pc', inStock: true },
      { id: 'p41', name: 'Stool Containers with spoon', price: 1200, unit: "100's", inStock: true },
      { id: 'p42', name: 'Sterile Stool Containers', price: 18, unit: '1pc', inStock: true },
      { id: 'p43', name: 'Polypots (white lids)3ml', price: 600, unit: "100's", inStock: true }
    ]
  },
  {
    id: '4',
    name: 'Rapid Test & Point-of-Care Testing',
    description: 'Fast-response diagnostic products for outpatient, emergency, and bedside testing.',
    image: 'https://images.unsplash.com/photo-1766297247072-93fd815afef3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHw0fHxtZWRpY2FsJTIwbGFib3JhdG9yeSUyMGVxdWlwbWVudHxlbnwwfHx8fDE3Njg0NzI2NzR8MA&ixlib=rb-4.1.0&q=85',
    products: [
      { id: 'p44', name: 'PDT/HCG URINE', price: 450, unit: '1*50T', inStock: true },
      { id: 'p45', name: 'PDT/HCG (BLOOD +URINE) Accurate', price: 600, unit: '1*50T', inStock: true },
      { id: 'p46', name: 'On Call sugar strips', price: 1100, unit: '1pc', inStock: true },
      { id: 'p47', name: '201 Hb Strips', price: 4500, unit: '50T', inStock: true },
      { id: 'p48', name: 'Hemo control Hb strips', price: 4100, unit: '50T', inStock: true }
    ]
  },
  {
    id: '5',
    name: 'Laboratory Slides & Microscopy Supplies',
    description: 'Materials used in microscopy, slide preparation, and optical examination.',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwxfHxoZWFsdGhjYXJlfGVufDB8fHx8MTc2ODQ3MjY4MHww&ixlib=rb-4.1.0&q=85',
    products: [
      { id: 'p49', name: 'Plain Microscope Slides', price: 210, unit: "72's", inStock: true },
      { id: 'p50', name: 'Frosted microscope Slides', price: 240, unit: "72's", inStock: true },
      { id: 'p51', name: 'Cover slips', price: 800, unit: "1000's", inStock: true },
      { id: 'p52', name: 'Oil Immersion', price: 600, unit: '100ml', inStock: true },
      { id: 'p53', name: 'Field Stain A Solution', price: 840, unit: '500ml', inStock: true },
      { id: 'p54', name: 'Field Stain B Solution', price: 840, unit: '500ml', inStock: true },
      { id: 'p55', name: 'Crystal Violet', price: 900, unit: '500ml', inStock: true },
      { id: 'p56', name: "Lugol's Iodine", price: 900, unit: '500ml', inStock: true },
      { id: 'p57', name: 'Giemsa Stain Solution', price: 900, unit: '500ml', inStock: true },
      { id: 'p58', name: 'Giemsa Powder', price: 2088, unit: '25g', inStock: true },
      { id: 'p59', name: 'Acetone', price: 850, unit: '500ml', inStock: true },
      { id: 'p60', name: 'Neutral Red', price: 900, unit: '500ml', inStock: true }
    ]
  },
  {
    id: '6',
    name: 'General Laboratory Reagents & Chemicals',
    description: 'Essential laboratory reagents and chemicals used in routine and specialized testing.',
    image: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwyfHxoZWFsdGhjYXJlfGVufDB8fHx8MTc2ODQ3MjY4MHww&ixlib=rb-4.1.0&q=85',
    products: [
      { id: 'p61', name: 'Bovine Albumin', price: 1400, unit: '1*10ml', inStock: true },
      { id: 'p62', name: 'Anti-Human Globulin', price: 1400, unit: '1*10ml', inStock: true },
      { id: 'p63', name: 'Acetic Acid 2.5L', price: 2100, unit: '2.5L', inStock: true },
      { id: 'p64', name: 'Acetic Acid 1L', price: 1750, unit: '1L', inStock: true }
    ]
  },
  {
    id: '7',
    name: 'Pipetting & Sample Handling Consumables',
    description: 'Products that support accurate sample preparation, transfer, and handling.',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHwzfHxoZWFsdGhjYXJlfGVufDB8fHx8MTc2ODQ3MjY4MHww&ixlib=rb-4.1.0&q=85',
    products: [
      { id: 'p65', name: 'Applicator Sticks', price: 522, unit: "500's", inStock: true },
      { id: 'p66', name: 'Wooden Tongue Dep', price: 450, unit: "100's", inStock: true },
      { id: 'p67', name: 'Pipette Tips Yellow', price: 750, unit: "1000's", inStock: true },
      { id: 'p68', name: 'Pipette Tips Blue', price: 750, unit: "500's", inStock: true },
      { id: 'p69', name: 'Micropipette (5-50,10-1000,20-200,100-1000) UL', price: 9280, unit: '1pc', inStock: true },
      { id: 'p70', name: 'Centrifuge Tubes (Falcon tubes)', price: 100, unit: '1pc', inStock: true }
    ]
  },
  {
    id: '8',
    name: 'Safety, Waste & Infection Control Supplies',
    description: 'Items that ensure laboratory safety, proper waste disposal, and infection control compliance.',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHw0fHxoZWFsdGhjYXJlfGVufDB8fHx8MTc2ODQ3MjY4MHww&ixlib=rb-4.1.0&q=85',
    products: [
      { id: 'p71', name: 'Sterile HVS Swabs', price: 1400, unit: "100's", inStock: true },
      { id: 'p72', name: 'Alcohol Swabs', price: 300, unit: '1pkt', inStock: true },
      { id: 'p73', name: 'Biohazard Bin 20L', price: 2900, unit: '1pc', inStock: true },
      { id: 'p74', name: 'Biohazard Bin 30L', price: 2400, unit: '1pc', inStock: true },
      { id: 'p75', name: 'Biohazard Bin Liners', price: 120, unit: '1pc', inStock: true }
    ]
  },
  {
    id: '9',
    name: 'Equipment, Instruments & Accessories',
    description: 'Laboratory equipment, instruments, and supporting accessories for diagnostic operations.',
    image: 'https://images.unsplash.com/photo-1638202993928-7267aad84c31?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwzfHxtZWRpY2FsfGVufDB8fHx8MTc2ODQ3MjY4NHww&ixlib=rb-4.1.0&q=85',
    products: [
      { id: 'p76', name: 'Hemo Control Microcuvettes', price: 4100, unit: '50s', inStock: true },
      { id: 'p77', name: '201 Hemoque Microcuvettes', price: 5220, unit: '50s', inStock: true },
      { id: 'p78', name: 'Lab Timer', price: 2900, unit: '1pc', inStock: true },
      { id: 'p79', name: 'Room Thermometer', price: 2900, unit: '1pc', inStock: true },
      { id: 'p80', name: 'Fridge Thermometer', price: 2900, unit: '1pc', inStock: true },
      { id: 'p81', name: 'Test Tubes Glass (10*75) ml', price: 20, unit: '1pc', inStock: true },
      { id: 'p82', name: 'Test Tubes Glass (12*75) ml', price: 20, unit: '1pc', inStock: true },
      { id: 'p83', name: 'Stainless Test Tube Rack', price: 1200, unit: '1pc', inStock: true },
      { id: 'p84', name: 'Centrifuge Brushes', price: 250, unit: '1pc', inStock: true },
      { id: 'p85', name: 'Centrifuge Buckets', price: 500, unit: '1pc', inStock: true },
      { id: 'p86', name: 'Staining Rack', price: 2900, unit: '1pc', inStock: true },
      { id: 'p87', name: 'Blood Grouping Tile', price: 600, unit: '1pc', inStock: true }
    ]
  }
];

export const trainingPrograms = [
  {
    id: 't1',
    title: 'Diagnostic & Laboratory Analyzer Training',
    description: 'Training on automated and semi-automated diagnostic systems',
    duration: '2-3 days',
    topics: [
      'Malaria analyzers and blood parasite detection systems',
      'Hematology analyzers (CBC, WBC differential, morphology-based systems)',
      'Clinical chemistry analyzers (basic operation level)',
      'Analyzer startup, shutdown, and workflow management',
      'Sample loading, test execution, and result interpretation',
      'Quality control and error handling'
    ]
  },
  {
    id: 't2',
    title: 'Sample Collection & Preparation Equipment',
    description: 'Training on correct use of sample collection devices',
    duration: '1 day',
    topics: [
      'Blood collection devices and accessories',
      'Sample preparation tools (slides, staining systems, centrifuges)',
      'Capillary and venous sampling techniques',
      'Pre-analytical best practices to reduce errors'
    ]
  },
  {
    id: 't3',
    title: 'Microscopy & Imaging Equipment',
    description: 'Comprehensive microscopy training',
    duration: '1-2 days',
    topics: [
      'Proper microscope setup and calibration',
      'Slide preparation, staining, and focusing techniques',
      'Oil immersion handling and lens care',
      'Digital imaging and result review (where applicable)'
    ]
  },
  {
    id: 't4',
    title: 'Point-of-Care & Rapid Testing Equipment',
    description: 'POCT device operation and quality assurance',
    duration: '1 day',
    topics: [
      'Point-of-care testing devices',
      'Rapid diagnostic test workflows',
      'Result timing, reading, and documentation',
      'POCT quality assurance and compliance'
    ]
  },
  {
    id: 't5',
    title: 'Cold Chain & Storage Equipment',
    description: 'Proper storage and temperature monitoring',
    duration: '1 day',
    topics: [
      'Laboratory refrigerators and temperature monitoring devices',
      'Proper storage of reagents and test kits',
      'Cold chain compliance and documentation'
    ]
  },
  {
    id: 't6',
    title: 'Equipment Installation & Commissioning',
    description: 'Complete installation and setup procedures',
    duration: '1-2 days',
    topics: [
      'Equipment placement and environmental requirements',
      'Power, safety, and connectivity checks',
      'Initial setup and functional verification',
      'User acceptance testing'
    ]
  },
  {
    id: 't7',
    title: 'Routine Maintenance & Basic Troubleshooting',
    description: 'Preventive maintenance and fault identification',
    duration: '1 day',
    topics: [
      'Daily, weekly, and monthly maintenance procedures',
      'Cleaning and consumable replacement',
      'Identification of common faults and alerts',
      'Escalation procedures for advanced servicing'
    ]
  },
  {
    id: 't8',
    title: 'Laboratory Safety & Equipment Compliance',
    description: 'Safety protocols and compliance standards',
    duration: '1 day',
    topics: [
      'Equipment-related biosafety practices',
      'Infection control and waste management',
      'Safe handling of sharps and biohazard materials',
      'Documentation and compliance standards'
    ]
  },
  {
    id: 't9',
    title: 'Digital Systems & Reporting',
    description: 'Software interfaces and data management',
    duration: '1 day',
    topics: [
      'Equipment software interfaces',
      'Result validation and reporting',
      'Data storage, export, and remote review features'
    ]
  }
];

export const contactInfo = {
  address: 'Ushuru Pension Plaza, Muthangari Drive Block C, First Floor',
  poBox: 'P. O. Box 162 - 00517 Westlands, Nairobi',
  phone: '0717 023 814',
  email: 'info@hamptonscientific.com',
  website: 'www.hamptonscientific.com'
};
