export const NAV_GROUPS = [
  { id: 'reagents', label: 'Reagents' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'consumables', label: 'Consumables' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'other', label: 'Other' },
];

export const navGroupLabel = (id) => NAV_GROUPS.find((group) => group.id === id)?.label || 'Other';
