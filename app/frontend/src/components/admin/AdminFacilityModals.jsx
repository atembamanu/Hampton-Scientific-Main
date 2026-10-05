import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../config/apiBaseUrl';
import { getAdminHeader } from '../../utils/adminAuth';
import { AdminFormModal } from './AdminFormModal';
import { PasswordStrength, isPasswordValid } from '../facility/PasswordStrength';
import { FACILITY_TYPES } from './FieldDetailsForm';
import { isValidEmail, isValidPhone } from '../../utils/validation';

const fieldClass = 'w-full h-10 px-3 border border-ink/15 rounded-lg text-sm bg-white';

const emptyFacility = {
  name: '', facilityType: 'hospital', phone: '', email: '', addressLine: '', county: '',
  firstName: '', lastName: '', contactPhone: '', loginEmail: '', password: '',
  registeredByUserId: '',
};

export const useFacilityOptions = (open) => {
  const headers = getAdminHeader();
  const [counties, setCounties] = useState([]);
  const [agents, setAgents] = useState([]);
  useEffect(() => {
    if (!open) return;
    axios.get(`${API_URL}/api/admin/field/counties`, { headers })
      .then((res) => setCounties(res.data.counties || []))
      .catch(() => setCounties([]));
    axios.get(`${API_URL}/api/admin/field/agents`, { headers })
      .then((res) => setAgents(res.data.agents || []))
      .catch(() => setAgents([]));
  }, [open]);
  return { counties, agents, headers };
};

export const FacilityCreateModal = ({ open, onOpenChange, onSaved }) => {
  const { counties, agents, headers } = useFacilityOptions(open);
  const [form, setForm] = useState(emptyFacility);
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!isValidPhone(form.phone) || !isValidEmail(form.email) || !isValidPhone(form.contactPhone) || !isValidEmail(form.loginEmail)) {
      toast.error('Enter a valid phone and email for the facility and its admin.');
      return;
    }
    if (!isPasswordValid(form.password)) {
      toast.error('Set a facility admin password that meets the requirements.');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/admin/ops/organizations`, {
        organization: {
          name: form.name,
          facilityType: form.facilityType,
          phone: form.phone,
          email: form.email,
          addressLine: form.addressLine,
          county: form.county,
          country: 'Kenya',
        },
        primaryContact: {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.contactPhone,
          email: form.loginEmail,
        },
        credentials: { email: form.loginEmail, password: form.password },
        multiBranch: false,
        registeredByUserId: form.registeredByUserId || null,
      }, { headers });
      toast.success('Facility created');
      setForm(emptyFacility);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not create this facility.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminFormModal open={open} onOpenChange={onOpenChange} title="Add facility" description="The facility admin signs in with the email and password you set. Credit a sales agent only when this facility should count toward their target." wide>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 mt-4">
        <label className="text-sm sm:col-span-2"><span className="block text-xs text-ink-muted mb-1">Facility name</span><input required value={form.name} onChange={set('name')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Type</span>
          <select required value={form.facilityType} onChange={set('facilityType')} className={fieldClass}>{FACILITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
        </label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">County</span>
          <select required value={form.county} onChange={set('county')} className={fieldClass}><option value="">Select county</option>{counties.map((county) => <option key={county} value={county}>{county}</option>)}</select>
        </label>
        <label className="text-sm sm:col-span-2"><span className="block text-xs text-ink-muted mb-1">Address</span><input required value={form.addressLine} onChange={set('addressLine')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Facility phone</span><input required value={form.phone} onChange={set('phone')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Facility email</span><input required type="email" value={form.email} onChange={set('email')} className={fieldClass} /></label>
        <p className="sm:col-span-2 text-xs uppercase tracking-wide text-ink-muted">Facility admin</p>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">First name</span><input required value={form.firstName} onChange={set('firstName')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Last name</span><input required value={form.lastName} onChange={set('lastName')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Contact phone</span><input required value={form.contactPhone} onChange={set('contactPhone')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Login email</span><input required type="email" value={form.loginEmail} onChange={set('loginEmail')} className={fieldClass} /></label>
        <label className="text-sm sm:col-span-2"><span className="block text-xs text-ink-muted mb-1">Password</span><input required type="password" value={form.password} onChange={set('password')} className={fieldClass} /><PasswordStrength password={form.password} /></label>
        <label className="text-sm sm:col-span-2"><span className="block text-xs text-ink-muted mb-1">Credit to sales agent</span>
          <select value={form.registeredByUserId} onChange={set('registeredByUserId')} className={fieldClass}>
            <option value="">Do not credit a target</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm disabled:opacity-60">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Create facility</button>
        </div>
      </form>
    </AdminFormModal>
  );
};

export const FacilityEditModal = ({ open, onOpenChange, org, registeredBy, onSaved }) => {
  const { counties, agents, headers } = useFacilityOptions(open);
  const [form, setForm] = useState(emptyFacility);
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (!open || !org) return;
    setForm((current) => ({
      ...current,
      name: org.name || '',
      facilityType: org.facilityType || 'hospital',
      phone: org.phone || '',
      email: org.email || '',
      addressLine: org.addressLine || '',
      county: org.county || '',
      registeredByUserId: registeredBy?.id || '',
    }));
  }, [open, org, registeredBy]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/admin/ops/organizations/${org.id}`, {
        name: form.name,
        facilityType: form.facilityType,
        phone: form.phone,
        email: form.email,
        addressLine: form.addressLine,
        county: form.county,
        registeredByUserId: form.registeredByUserId || null,
      }, { headers });
      toast.success('Facility updated');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not update this facility.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminFormModal open={open} onOpenChange={onOpenChange} title="Edit facility" wide>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 mt-4">
        <label className="text-sm sm:col-span-2"><span className="block text-xs text-ink-muted mb-1">Facility name</span><input required value={form.name} onChange={set('name')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Type</span>
          <select required value={form.facilityType} onChange={set('facilityType')} className={fieldClass}>{FACILITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
        </label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">County</span>
          <select required value={form.county} onChange={set('county')} className={fieldClass}><option value="">Select county</option>{counties.map((county) => <option key={county} value={county}>{county}</option>)}</select>
        </label>
        <label className="text-sm sm:col-span-2"><span className="block text-xs text-ink-muted mb-1">Address</span><input required value={form.addressLine} onChange={set('addressLine')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Phone</span><input required value={form.phone} onChange={set('phone')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Email</span><input required type="email" value={form.email} onChange={set('email')} className={fieldClass} /></label>
        <label className="text-sm sm:col-span-2"><span className="block text-xs text-ink-muted mb-1">Credit to sales agent</span>
          <select value={form.registeredByUserId} onChange={set('registeredByUserId')} className={fieldClass}>
            <option value="">Do not credit a target</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm disabled:opacity-60">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save facility</button>
        </div>
      </form>
    </AdminFormModal>
  );
};

const emptyBranch = { name: '', branchCode: '', phone: '', email: '', physicalAddress: '', county: '', contactName: '' };

export const BranchFormModal = ({ open, onOpenChange, orgId, branch, counties, onSaved }) => {
  const headers = getAdminHeader();
  const [form, setForm] = useState(emptyBranch);
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (!open) return;
    setForm(branch ? {
      name: branch.name || '',
      branchCode: branch.branchCode || '',
      phone: branch.phone || '',
      email: branch.email || '',
      physicalAddress: branch.physicalAddress || '',
      county: branch.county || '',
      contactName: branch.contactName || '',
    } : emptyBranch);
  }, [open, branch]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, email: form.email || null, phone: form.phone || null };
      if (branch) {
        await axios.put(`${API_URL}/api/admin/ops/organizations/${orgId}/branches/${branch.id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/api/admin/ops/organizations/${orgId}/branches`, payload, { headers });
      }
      toast.success(branch ? 'Branch updated' : 'Branch added');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not save this branch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminFormModal open={open} onOpenChange={onOpenChange} title={branch ? 'Edit branch' : 'Add branch'} wide>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 mt-4">
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Name</span><input required value={form.name} onChange={set('name')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Code</span><input required value={form.branchCode} onChange={set('branchCode')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Contact name</span><input value={form.contactName} onChange={set('contactName')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">County</span>
          <select value={form.county} onChange={set('county')} className={fieldClass}><option value="">Select county</option>{(counties || []).map((county) => <option key={county} value={county}>{county}</option>)}</select>
        </label>
        <label className="text-sm sm:col-span-2"><span className="block text-xs text-ink-muted mb-1">Address</span><input required value={form.physicalAddress} onChange={set('physicalAddress')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Phone</span><input value={form.phone} onChange={set('phone')} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Email</span><input type="email" value={form.email} onChange={set('email')} className={fieldClass} /></label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm disabled:opacity-60">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save branch</button>
        </div>
      </form>
    </AdminFormModal>
  );
};

const emptyUser = { firstName: '', lastName: '', email: '', phone: '', jobTitle: '', role: 'branch_user', password: '', branchIds: [] };

export const FacilityUserFormModal = ({ open, onOpenChange, orgId, user, branches, onSaved }) => {
  const headers = getAdminHeader();
  const [form, setForm] = useState(emptyUser);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(user ? {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      jobTitle: user.jobTitle || '',
      role: user.role || 'branch_user',
      password: '',
      branchIds: (user.branches || []).map((branch) => branch.id),
    } : { ...emptyUser, branchIds: branches?.[0] ? [branches[0].id] : [] });
  }, [open, user, branches]);

  const toggleBranch = (branchId) => {
    setForm((current) => ({
      ...current,
      branchIds: current.branchIds.includes(branchId)
        ? current.branchIds.filter((id) => id !== branchId)
        : [...current.branchIds, branchId],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!user && !isPasswordValid(form.password)) {
      toast.error('Set a password that meets the requirements.');
      return;
    }
    if (form.password && !isPasswordValid(form.password)) {
      toast.error('Set a password that meets the requirements.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        jobTitle: form.jobTitle || null,
        role: form.role,
        branchIds: form.branchIds,
      };
      if (form.password) payload.password = form.password;
      if (user) {
        await axios.put(`${API_URL}/api/admin/ops/organizations/${orgId}/users/${user.id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/api/admin/ops/organizations/${orgId}/users`, { ...payload, email: form.email, password: form.password }, { headers });
      }
      toast.success(user ? 'User updated' : 'User added');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not save this user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminFormModal open={open} onOpenChange={onOpenChange} title={user ? 'Edit user' : 'Add user'} wide>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 mt-4">
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">First name</span><input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Last name</span><input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Email</span><input required type="email" disabled={Boolean(user)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Phone</span><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Job title</span><input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={fieldClass} /></label>
        <label className="text-sm"><span className="block text-xs text-ink-muted mb-1">Role</span>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={fieldClass}>
            <option value="org_admin">Facility Admin</option>
            <option value="branch_admin">Branch Manager</option>
            <option value="branch_user">Branch personnel</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2"><span className="block text-xs text-ink-muted mb-1">{user ? 'New password (optional)' : 'Password'}</span><input type="password" required={!user} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={fieldClass} />{form.password ? <PasswordStrength password={form.password} /> : null}</label>
        <div className="sm:col-span-2">
          <span className="block text-xs text-ink-muted mb-1">Branches</span>
          <div className="border border-ink/10 rounded-lg p-2 space-y-1">
            {(branches || []).map((branch) => (
              <label key={branch.id} className="flex items-center gap-2 text-sm px-2 py-1">
                <input type="checkbox" checked={form.branchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />
                {branch.name}
              </label>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm disabled:opacity-60">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save user</button>
        </div>
      </form>
    </AdminFormModal>
  );
};
