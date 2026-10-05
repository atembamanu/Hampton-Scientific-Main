export function parseMulti(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinMulti(values) {
  return parseMulti(values).join(',');
}

export function branchOptionsForOrgs(orgs, orgIds) {
  const selected = (orgs || []).filter((org) => orgIds.includes(org.id));
  return selected.flatMap((org) => (org.branches || []).map((branch) => ({
    value: branch.id,
    label: selected.length > 1 ? `${branch.name} · ${org.name}` : branch.name,
  })));
}
