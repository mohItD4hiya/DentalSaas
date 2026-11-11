import { useEffect, useRef, useState } from 'react';
import { Chart as C, registerables } from 'chart.js'; import { Bar, Doughnut } from 'react-chartjs-2';
import { api } from './api.js'; C.register(...registerables);

const CLINIC_NAME = 'SmileCraft Dental Clinic';
const inr = n => '₹' + (n || 0).toLocaleString('en-IN');
const invoiceLines = invoice => {
  if (invoice.lineItems?.length) return invoice.lineItems;
  return [{
    description: invoice.description || 'Dental service',
    quantity: 1,
    unitPrice: Number(invoice.subtotal ?? invoice.amount ?? 0),
    amount: Number(invoice.subtotal ?? invoice.amount ?? 0),
  }];
};
const INDIAN_INSURERS = ['Star Health', 'Care Health', 'Max Bupa', 'Niva Bupa', 'ICICI Lombard', 'Self Pay'];
const APPOINTMENT_STATUS = ['Booked', 'Confirmed', 'Completed', 'Cancelled'];
const NAV_ITEMS = [
  ['Dashboard', 'dashboard'], ['Appointments', 'calendar'], ['Patients', 'patients'],
  ['Billing', 'billing'], ['Inventory', 'inventory'], ['Reports', 'reports'],
  ['AI Assistant', 'assistant'],
];
function Icon({ name, size = 20 }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
    patients: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    branches: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-7h6v7M9 9h.01M15 9h.01" /></>,
    billing: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h3M15 15h1M8 18h3" /></>,
    inventory: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5M12 13v4" /></>,
    reports: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /><path d="M17 7h2v2" /></>,
    assistant: <><path d="M12 3a8 8 0 0 0-4.2 14.8L7 21l4-2a8 8 0 1 0 1-16Z" /><path d="M9 10h.01M12 10h.01M15 10h.01M9 14h6" /></>,
    patientsCount: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 11a3 3 0 1 0 0-6M18 14a5 5 0 0 1 3 5v1" /></>,
    rupee: <><path d="M6 4h12M6 8h12M8 4c4 0 6 1.8 6 4s-2 4-6 4h-.5L16 20" /></>,
    tooth: <><path d="M12 4c-2-2-7-1-8 3-1 5 2 14 5 14 2 0 1-7 3-7s1 7 3 7c3 0 6-9 5-14-1-4-6-5-8-3Z" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common}>{paths[name] || paths.dashboard}</svg>;
}
const RESOURCES = {
  Appointments: { path: 'appointments', fields: [['patient', 'Patient'], ['branchName', 'Branch'], ['date', 'Date', 'date'], ['time', 'Time', 'time'], ['type', 'Type'], ['status', 'Status', APPOINTMENT_STATUS]] },
  Inventory: { path: 'inventory', fields: [['name', 'Item'], ['qty', 'In stock', 'number'], ['minQty', 'Reorder at', 'number']] },
};

function Login({ onDone }) {
  const [registering, setRegistering] = useState(false);
  const [activationToken] = useState(() => new URLSearchParams(window.location.search).get('activate') || '');
  const [f, setF] = useState(() => ({ name: '', email: 'dr.smith@dentalsaas.com', phone: '', password: activationToken ? '' : 'smile123' }));
  const [confirmPassword, setConfirmPassword] = useState('');
  const [err, setErr] = useState('');
  const go = async e => {
    e.preventDefault();
    setErr('');
    if (activationToken && f.password !== confirmPassword) {
      setErr('The passwords do not match.');
      return;
    }
    try {
      const d = activationToken
        ? await api('auth/patient/activate', 'POST', { token: activationToken, password: f.password })
        : registering
          ? await api('auth/patient/register', 'POST', f)
          : await api('auth/login', 'POST', { email: f.email, password: f.password });
      if (activationToken) window.history.replaceState({}, '', window.location.pathname);
      localStorage.token = d.token;
      localStorage.name = d.name;
      localStorage.role = d.role;
      if (d.patientId) localStorage.patientId = d.patientId;
      else localStorage.removeItem('patientId');
      if (d.branchId) localStorage.branchId = d.branchId;
      else localStorage.removeItem('branchId');
      onDone(d);
    } catch (error) {
      setErr(error.message);
    }
  };
  const changeMode = next => {
    setRegistering(next);
    setErr('');
    setF(next
      ? { name: '', email: '', phone: '', password: '' }
      : { name: '', email: 'dr.smith@dentalsaas.com', phone: '', password: 'smile123' });
  };
  return <div className="login"><form className="card" onSubmit={go}>
    <img className="clinic-logo login-logo" src="/clinic-logo.png" alt={`${CLINIC_NAME} logo`} />
    <h1>{CLINIC_NAME}</h1><p className="muted">Appointments and patient care for your Indian dental practice</p>
    {!activationToken && <div className="auth-mode"><button type="button" className={!registering ? '' : 'ghost'} onClick={() => changeMode(false)}>Sign in</button><button type="button" className={registering ? '' : 'ghost'} onClick={() => changeMode(true)}>Patient registration</button></div>}
    {registering && <input required autoComplete="name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Full name" />}
    {registering && <input required type="tel" autoComplete="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} title="Enter a 10-digit phone number" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="10-digit phone number" />}
    {activationToken && <h2 className="activation-heading">Activate your patient portal</h2>}
    {!activationToken && <input required type="email" autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="Email" />}
    <input required type="password" autoComplete={registering || activationToken ? 'new-password' : 'current-password'} minLength={registering || activationToken ? 8 : undefined} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder={registering || activationToken ? 'Create password (8+ characters)' : 'Password'} />
    {activationToken && <input required type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" />}
    {err && <p className="err" role="alert">{err}</p>}
    <button type="submit">{activationToken ? 'Activate account' : registering ? 'Create patient account' : 'Sign in'}</button>
  </form></div>;
}

function Resource({ title, path, fields }) {
  const [rows, setRows] = useState([]), [form, setForm] = useState({}), [q, setQ] = useState('');
  const [branches, setBranches] = useState([]), [error, setError] = useState('');
  const load = () => api(path).then(setRows); useEffect(() => { load(); }, [path]);
  useEffect(() => {
    if (path === 'appointments') api('branches').then(setBranches).catch(e => setError(e.message));
  }, [path]);
  const add = async () => {
    setError('');
    try {
      await api(path, 'POST', { ...form, ...(path === 'appointments' ? { branchId: form.branchId || branches.find(branch => branch.isActive)?._id } : {}) });
      setForm({});
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  const del = async id => {
    setError('');
    try { await api(`${path}/${id}`, 'DELETE'); await load(); }
    catch (e) { setError(e.message); }
  };
  const updateRow = async (id, patch) => {
    const row = rows.find(r => r._id === id); if (!row) return;
    setError('');
    try {
      await api(`${path}/${id}`, 'PUT', { ...row, ...patch });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  const updateStatus = async (id, status) => updateRow(id, { status });
  const consumeStock = async id => {
    const row = rows.find(r => r._id === id); if (!row) return;
    await api(`${path}/${id}`, 'PUT', { ...row, qty: Math.max(0, Number(row.qty || 0) - 1) });
    load();
  };
  const handleQtyChange = async (id, value) => {
    const row = rows.find(r => r._id === id); if (!row) return;
    const qty = Math.max(0, Number(value) || 0);
    await updateRow(id, { qty });
  };
  const shown = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  const rowDefaults = title === 'Billing' ? { insurance: INDIAN_INSURERS[0] } : {};
  return <>
    <h2>{title}</h2>
    {error && <p className="err" role="alert">{error}</p>}
    <div className="card form">{fields.filter(([k]) => !(path === 'appointments' && k === 'branchName')).map(([k, l, t]) => Array.isArray(t)
      ? <select key={k} value={form[k] || rowDefaults[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}><option value="">{l}</option>{t.map(o => <option key={o}>{o}</option>)}</select>
      : <input key={k} type={t || 'text'} placeholder={l} title={l} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} />)}
      {path === 'appointments' && <select aria-label="Appointment branch" required value={form.branchId || branches.find(branch => branch.isActive)?._id || ''} onChange={e => setForm({ ...form, branchId: e.target.value })}><option value="">Select branch</option>{branches.filter(branch => branch.isActive).map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}</select>}
      <button onClick={add}>Add {title.replace(/s$/, '').toLowerCase()}</button></div>
    <input className="search" placeholder={`Search ${title.toLowerCase()}`} value={q} onChange={e => setQ(e.target.value)} />
    <div className="card scroll"><table><thead><tr>{fields.map(([k, l]) => <th key={k}>{l}</th>)}<th /></tr></thead>
      <tbody>{shown.map(r => <tr key={r._id}>{fields.map(([k, , t]) => <td key={k}>
        {path === 'appointments' && k === 'branchName' ? <select aria-label={`${r.patient} appointment branch`} value={r.branchId || ''} onChange={e => updateRow(r._id, { branchId: e.target.value })}>
          {branches.filter(branch => branch.isActive || branch._id === r.branchId).map(branch => <option key={branch._id} value={branch._id}>{branch.name}{branch.isActive ? '' : ' (Inactive)'}</option>)}
        </select> : k === 'status' ? <div className="status-wrap">
          <span className={'tag ' + String(r[k] || '').toLowerCase()}>{r[k] || 'Booked'}</span>
          <select className="status-select" value={r[k] || ''} onChange={e => updateStatus(r._id, e.target.value)}>
            {Array.isArray(t) ? t.map(v => <option key={v} value={v}>{v}</option>) : <option value={r[k]}>{r[k]}</option>}
          </select>
          {path === 'appointments' && r[k] !== 'Confirmed' && r[k] !== 'Completed' && r[k] !== 'Cancelled' && <button className="mini" onClick={() => updateStatus(r._id, 'Confirmed')}>Confirm</button>}
        </div> : k === 'qty' && path === 'inventory' ? <div className="qty-cell"><input type="number" min="0" value={Number(r[k] || 0)} onChange={e => handleQtyChange(r._id, e.target.value)} /><button className="mini ghost" onClick={() => consumeStock(r._id)}>Use 1</button></div> : (k === 'amount' ? inr(r[k]) : r[k])}
      </td>)}
        <td><button className="ghost" onClick={() => del(r._id)}>Delete</button></td></tr>)}</tbody></table>
      {!shown.length && <p className="muted pad">Nothing here yet. Add your first {title.replace(/s$/, '').toLowerCase()} above.</p>}</div></>;
}

function Branches() {
  const emptyBranch = () => ({ name: '', address: '', phone: '' });
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyBranch);
  const [doctorForm, setDoctorForm] = useState({ branchId: '', name: '', email: '' });
  const [createdDoctor, setCreatedDoctor] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const load = async () => setBranches(await api('branches'));
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  const save = async event => {
    event.preventDefault();
    setError('');
    try {
      if (form.phone && !/^\d{10}$/.test(form.phone)) throw new Error('Branch phone number must contain exactly 10 digits.');
      if (editing) {
        await api(`branches/${editing._id}`, 'PUT', { ...form, isActive: editing.isActive });
      } else {
        await api('branches', 'POST', form);
      }
      setForm(emptyBranch());
      setEditing(null);
      setError('');
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  const edit = branch => {
    setEditing(branch);
    setForm({ name: branch.name || '', address: branch.address || '', phone: branch.phone || '' });
    setError('');
  };
  const toggleActive = async branch => {
    setError('');
    try {
      await api(`branches/${branch._id}`, 'PUT', { name: branch.name, address: branch.address, phone: branch.phone, isActive: !branch.isActive });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  const createDoctor = async event => {
    event.preventDefault();
    setError('');
    setCreatedDoctor(null);
    try {
      const result = await api(`branches/${doctorForm.branchId}/doctors`, 'POST', {
        name: doctorForm.name, email: doctorForm.email,
      });
      setCreatedDoctor(result);
      setDoctorForm(current => ({ ...current, name: '', email: '' }));
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  return <>
    <h2>Clinic branches</h2>
    <p className="muted">Branches in this clinic share the same patient records, visit history, treatments and invoices. Appointments are booked at a specific branch.</p>
    <form className="card form" onSubmit={save}>
      <input required placeholder="Branch name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input placeholder="Address (optional)" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
      <input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10-digit phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
      <button type="submit">{editing ? 'Save branch' : 'Add branch'}</button>
      {editing && <button type="button" className="ghost" onClick={() => { setEditing(null); setForm(emptyBranch()); }}>Cancel edit</button>}
    </form>
    {error && <p className="err" role="alert">{error}</p>}
    <h3>Branch doctor accounts</h3>
    <form className="card form" onSubmit={createDoctor}>
      <select required aria-label="Doctor branch" value={doctorForm.branchId} onChange={e => setDoctorForm({ ...doctorForm, branchId: e.target.value })}>
        <option value="">Select branch</option>{branches.filter(branch => branch.isActive).map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
      </select>
      <input required placeholder="Doctor name" value={doctorForm.name} onChange={e => setDoctorForm({ ...doctorForm, name: e.target.value })} />
      <input required type="email" placeholder="Doctor email" value={doctorForm.email} onChange={e => setDoctorForm({ ...doctorForm, email: e.target.value })} />
      <button type="submit">Create doctor account</button>
    </form>
    {createdDoctor && <p className="card pad" role="status">
      Account created for <strong>{createdDoctor.doctor.name}</strong> ({createdDoctor.doctor.email}).
      Temporary password: <strong>{createdDoctor.temporaryPassword}</strong>. Save and share it securely; it will not be shown again.
    </p>}
    <div className="card scroll"><table><thead><tr><th>Branch</th><th>Address</th><th>Phone</th><th>Status</th><th>Doctors</th><th>Actions</th></tr></thead>
      <tbody>{branches.map(branch => <tr key={branch._id}>
        <td>{branch.name}</td><td>{branch.address || '—'}</td><td>{branch.phone || '—'}</td><td>{branch.isActive ? 'Active' : 'Inactive'}</td>
        <td>{(branch.doctors || []).length ? branch.doctors.map(doctor => <div key={doctor._id}>{doctor.name} · {doctor.email}</div>) : 'No doctor assigned'}</td>
        <td><div className="patient-actions"><button type="button" className="ghost mini" onClick={() => edit(branch)}>Edit</button><button type="button" className="ghost mini" onClick={() => toggleActive(branch)}>{branch.isActive ? 'Deactivate' : 'Activate'}</button></div></td>
      </tr>)}</tbody></table>
      {!branches.length && <p className="muted pad">No branches have been added.</p>}</div>
  </>;
}

function Patients() {
  const emptyPatient = () => ({ name: '', age: '', phone: '', email: '', healthIssues: '' });
  const emptyVisit = () => ({ date: todayDate(), reason: '', prescription: '', prescriptionPdf: '', prescriptionFilename: '', notes: '' });
  const [patients, setPatients] = useState([]), [form, setForm] = useState(emptyPatient);
  const [search, setSearch] = useState(''), [selectedPatient, setSelectedPatient] = useState(null);
  const [visits, setVisits] = useState([]), [visitForm, setVisitForm] = useState(emptyVisit);
  const [error, setError] = useState(''), [visitError, setVisitError] = useState('');
  const [editingPatient, setEditingPatient] = useState(null), [editForm, setEditForm] = useState(emptyPatient), [editError, setEditError] = useState('');
  const [invitation, setInvitation] = useState(null), [invitationError, setInvitationError] = useState(''), [invitationCopied, setInvitationCopied] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState(null), [editVisitForm, setEditVisitForm] = useState(emptyVisit);
  const loadPatients = async () => setPatients(await api('patients'));
  useEffect(() => { loadPatients().catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!selectedPatient) return;
    setVisits([]);
    setVisitForm(emptyVisit());
    setEditingVisitId(null);
    setVisitError('');
    api(`patients/${selectedPatient._id}/visits`).then(setVisits).catch(e => setVisitError(e.message));
  }, [selectedPatient]);
  const addPatient = async e => {
    e.preventDefault();
    setError('');
    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      setError('Enter a 10-digit phone number, or leave it blank.');
      return;
    }
    try {
      await api('patients', 'POST', { ...form, age: form.age ? Number(form.age) : undefined });
      setForm(emptyPatient());
      await loadPatients();
    } catch (e) {
      setError(e.message);
    }
  };
  const deletePatient = async patient => {
    if (!window.confirm(`Delete ${patient.name}? Their visit records will remain in the database.`)) return;
    setError('');
    try {
      await api(`patients/${patient._id}`, 'DELETE');
      if (selectedPatient?._id === patient._id) setSelectedPatient(null);
      await loadPatients();
    } catch (e) {
      setError(e.message);
    }
  };
  const editPatient = patient => {
    setEditingPatient(patient);
    setEditForm({ name: patient.name || '', age: patient.age ?? '', phone: patient.phone || '', email: patient.email || '', healthIssues: patient.healthIssues || '' });
    setEditError('');
  };
  const savePatient = async event => {
    event.preventDefault();
    if (!editingPatient) return;
    setEditError('');
    if (editForm.phone && !/^\d{10}$/.test(editForm.phone)) {
      setEditError('Enter a 10-digit phone number, or leave it blank.');
      return;
    }
    try {
      await api(`patients/${editingPatient._id}`, 'PUT', {
        name: editForm.name.trim(),
        age: editForm.age === '' ? undefined : Number(editForm.age),
        phone: editForm.phone.trim(),
        email: editForm.email.trim().toLowerCase(),
        healthIssues: editForm.healthIssues.trim(),
      });
      await loadPatients();
      setEditingPatient(null);
    } catch (e) {
      setEditError(e.message);
    }
  };
  const createInvitation = async patient => {
    setInvitationError('');
    setInvitationCopied(false);
    try {
      const result = await api(`patients/${patient._id}/invitation`, 'POST', {});
      const activationUrl = new URL(window.location.href);
      activationUrl.search = '';
      activationUrl.searchParams.set('activate', result.token);
      setInvitation({ patientName: patient.name, url: activationUrl.toString(), expiresAt: result.expiresAt });
    } catch (e) {
      setInvitationError(e.message);
    }
  };
  const copyInvitation = async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.url);
      setInvitationCopied(true);
      setInvitationError('');
    } catch {
      setInvitationError('Could not copy automatically. Select and copy the link above.');
    }
  };
  const handlePrescriptionUpload = (event, updateForm) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.type && !file.type.includes('pdf')) {
      setVisitError('Please upload a PDF prescription file.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateForm(current => ({ ...current, prescriptionPdf: String(reader.result), prescriptionFilename: file.name }));
      setVisitError('');
    };
    reader.onerror = () => setVisitError('Unable to read the selected PDF. Please try another file.');
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  const clearPrescriptionUpload = () => {
    setVisitForm(current => ({ ...current, prescriptionPdf: '', prescriptionFilename: '' }));
    setVisitError('');
  };
  const editVisit = visit => {
    setEditingVisitId(visit._id);
    setEditVisitForm({
      date: visit.date || '', reason: visit.reason || '', prescription: visit.prescription || '',
      prescriptionPdf: visit.prescriptionPdf || '', prescriptionFilename: visit.prescriptionFilename || '', notes: visit.notes || '',
    });
    setVisitError('');
  };
  const cancelVisitEdit = () => {
    setEditingVisitId(null);
    setEditVisitForm(emptyVisit());
    setVisitError('');
  };
  const clearEditedPrescriptionUpload = () => {
    setEditVisitForm(current => ({ ...current, prescriptionPdf: '', prescriptionFilename: '' }));
    setVisitError('');
  };
  const updateVisit = async (event, visitId) => {
    event.preventDefault();
    if (!selectedPatient) return;
    setVisitError('');
    try {
      await api(`patients/${selectedPatient._id}/visits/${visitId}`, 'PUT', editVisitForm);
      setVisits(await api(`patients/${selectedPatient._id}/visits`));
      cancelVisitEdit();
    } catch (e) {
      setVisitError(e.message);
    }
  };
  const addVisit = async e => {
    e.preventDefault();
    if (!selectedPatient) return;
    setVisitError('');
    try {
      await api(`patients/${selectedPatient._id}/visits`, 'POST', visitForm);
      setVisitForm(emptyVisit());
      setVisits(await api(`patients/${selectedPatient._id}/visits`));
    } catch (e) {
      setVisitError(e.message);
    }
  };
  const shown = patients.filter(patient => JSON.stringify(patient).toLowerCase().includes(search.toLowerCase()));
  return <>
    <h2>Patients</h2>
    <p className="muted">Add an email to a patient record, then create an activation link so the patient can set a password and access their existing clinic data.</p>
    <form className="card form" onSubmit={addPatient}>
      <input required placeholder="Patient name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input type="number" min="0" placeholder="Age" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
      <input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} title="Enter a 10-digit phone number, or leave blank" placeholder="10-digit phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
      <input type="email" autoComplete="email" placeholder="Patient email (optional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      <input maxLength={500} placeholder="Known health issues (e.g. diabetes, allergies)" value={form.healthIssues} onChange={e => setForm({ ...form, healthIssues: e.target.value })} />
      <button type="submit">Add patient</button>
    </form>
    {error && <p className="err" role="alert">{error}</p>}
    <input className="search" placeholder="Search patients" value={search} onChange={e => setSearch(e.target.value)} />
    {invitationError && <p className="err" role="alert">{invitationError}</p>}
    <div className="card scroll"><table><thead><tr><th>Name</th><th>Age</th><th>Phone</th><th>Email</th><th>Portal access</th><th>Known health issues</th><th>Visit notes</th><th>Actions</th></tr></thead>
      <tbody>{shown.map(patient => <tr key={patient._id}>
        <td>{patient.name}</td><td>{patient.age || '—'}</td><td>{patient.phone || '—'}</td><td>{patient.email || '—'}</td>
        <td>{patient.portalAccount ? 'Active' : patient.email ? <button className="ghost mini" onClick={() => createInvitation(patient)}>Create activation link</button> : 'Email needed'}</td>
        <td className="health-issues-cell">{patient.healthIssues || '—'}</td>
        <td><button className="ghost mini" onClick={() => setSelectedPatient(patient)}>Open visit notebook</button></td>
        <td><div className="patient-actions"><button className="ghost mini" onClick={() => editPatient(patient)}>Edit</button><button className="ghost mini" onClick={() => deletePatient(patient)}>Delete</button></div></td>
      </tr>)}</tbody></table>
      {!shown.length && <p className="muted pad">No patients found. Add a patient above.</p>}</div>
    {editingPatient && <div className="invoice-modal patient-edit-modal" role="dialog" aria-modal="true" aria-label={`Edit ${editingPatient.name}`}>
      <form className="patient-edit-form" onSubmit={savePatient}>
        <header className="visit-header"><div><h2>Edit patient</h2><p className="muted">Update {editingPatient.name}'s details</p></div>
          <button type="button" className="ghost" onClick={() => setEditingPatient(null)}>Close</button>
        </header>
        <label>Patient name<input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></label>
        <label>Age<input type="number" min="0" value={editForm.age} onChange={e => setEditForm({ ...editForm, age: e.target.value })} /></label>
        <label>Phone (10 digits)<input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} title="Enter a 10-digit phone number, or leave blank" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></label>
        <label>Email<input type="email" autoComplete="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></label>
        <label>Known health issues<textarea maxLength={500} rows="3" value={editForm.healthIssues} onChange={e => setEditForm({ ...editForm, healthIssues: e.target.value })} placeholder="e.g. Diabetes, hypertension, allergies" /></label>
        {editError && <p className="err" role="alert">{editError}</p>}
        <div className="patient-edit-actions"><button type="button" className="ghost" onClick={() => setEditingPatient(null)}>Cancel</button><button type="submit">Save changes</button></div>
      </form>
    </div>}
    {invitation && <div className="invoice-modal invitation-modal" role="dialog" aria-modal="true" aria-label="Patient activation link">
      <section className="patient-edit-form">
        <header className="visit-header"><div><h2>Patient activation link</h2><p className="muted">For {invitation.patientName}</p></div><button type="button" className="ghost" onClick={() => setInvitation(null)}>Close</button></header>
        <p>Share this link securely with the patient. It expires in 24 hours and can be used once. The app does not send email automatically.</p>
        <input aria-label="Activation link" readOnly value={invitation.url} onFocus={event => event.target.select()} />
        <p className="muted">Expires {new Date(invitation.expiresAt).toLocaleString()}</p>
        {invitationError && <p className="err" role="alert">{invitationError}</p>}
        {invitationCopied && <p className="portal-notice" role="status">Activation link copied.</p>}
        <div className="patient-edit-actions"><button type="button" onClick={copyInvitation}>Copy link</button></div>
      </section>
    </div>}
    {selectedPatient && <div className="invoice-modal visit-modal" role="dialog" aria-modal="true" aria-label={`${selectedPatient.name} visit notebook`}>
      <section className="visit-notebook">
        <header className="visit-header"><div><h2>{selectedPatient.name}</h2><p className="muted">Visit history and clinical notebook</p></div>
          <button className="ghost" onClick={() => setSelectedPatient(null)}>Close</button>
        </header>
        <div className="visit-columns">
          <section className="visit-history"><h3>Previous visits</h3>
            {visitError && <p className="err" role="alert">{visitError}</p>}
            {!visitError && visits.length === 0 && <p className="muted">No visits recorded yet. Add a previous or current visit with prescriptions and notes.</p>}
            {visits.map(visit => <article className="visit-entry" key={visit._id}>
              {editingVisitId === visit._id ? <form className="visit-entry-edit" onSubmit={event => updateVisit(event, visit._id)}>
                <div className="visit-entry-heading"><strong>Edit visit record</strong></div>
                <label>Visit date<input required type="date" value={editVisitForm.date} onChange={e => setEditVisitForm({ ...editVisitForm, date: e.target.value })} /></label>
                <label>Reason / treatment<input value={editVisitForm.reason} onChange={e => setEditVisitForm({ ...editVisitForm, reason: e.target.value })} /></label>
                <label>Prescription<textarea rows="3" value={editVisitForm.prescription} onChange={e => setEditVisitForm({ ...editVisitForm, prescription: e.target.value })} /></label>
                <div className="upload-box">
                  <label className="upload-label" htmlFor={`edit-prescription-upload-${visit._id}`}>Prescription PDF</label>
                  <input id={`edit-prescription-upload-${visit._id}`} type="file" accept="application/pdf" onChange={event => handlePrescriptionUpload(event, setEditVisitForm)} />
                  {editVisitForm.prescriptionPdf && <div className="upload-meta">
                    <span>{editVisitForm.prescriptionFilename || 'Prescription.pdf'}</span>
                    <div className="upload-actions">
                      <a className="prescription-pdf" href={editVisitForm.prescriptionPdf} target="_blank" rel="noopener noreferrer">View PDF</a>
                      <button type="button" className="ghost mini" onClick={clearEditedPrescriptionUpload}>Remove</button>
                    </div>
                  </div>}
                </div>
                <label>Clinical notes<textarea rows="3" value={editVisitForm.notes} onChange={e => setEditVisitForm({ ...editVisitForm, notes: e.target.value })} /></label>
                {visitError && <p className="err" role="alert">{visitError}</p>}
                <div className="visit-entry-actions"><button type="button" className="ghost mini" onClick={cancelVisitEdit}>Cancel</button><button type="submit" className="mini">Save changes</button></div>
              </form> : <>
                <div className="visit-entry-heading">
                  <time dateTime={visit.date}>{visit.date}</time>
                  <button type="button" className="ghost mini" onClick={() => editVisit(visit)}>Edit</button>
                </div>
                {visit.reason && <h4>{visit.reason}</h4>}
                {visit.prescription && <div><strong>Prescription</strong><p className="prescription-text">{visit.prescription}</p></div>}
                {visit.prescriptionPdf && <div className="prescription-link-wrap"><a className="prescription-pdf" href={visit.prescriptionPdf} target="_blank" rel="noopener noreferrer">View PDF{visit.prescriptionFilename ? `: ${visit.prescriptionFilename}` : ''}</a></div>}
                {visit.notes && <div><strong>Clinical notes</strong><p className="prescription-text">{visit.notes}</p></div>}
              </>}
            </article>)}
          </section>
          <form className="visit-form" onSubmit={addVisit}>
            <h3>Record a visit</h3>
            <label>Visit date<input required type="date" value={visitForm.date} onChange={e => setVisitForm({ ...visitForm, date: e.target.value })} /></label>
            <label>Reason / treatment<input value={visitForm.reason} onChange={e => setVisitForm({ ...visitForm, reason: e.target.value })} placeholder="e.g. Root canal follow-up" /></label>
            <label>Prescription<textarea rows="4" value={visitForm.prescription} onChange={e => setVisitForm({ ...visitForm, prescription: e.target.value })} placeholder="Medication, dosage, and instructions" /></label>
            <div className="upload-box">
              <label className="upload-label" htmlFor="prescription-upload">Prescription PDF</label>
              <input id="prescription-upload" type="file" accept="application/pdf" onChange={event => handlePrescriptionUpload(event, setVisitForm)} />
              {visitForm.prescriptionPdf && (
                <div className="upload-meta">
                  <span>{visitForm.prescriptionFilename || 'Prescription.pdf'}</span>
                  <div className="upload-actions"><a className="prescription-pdf" href={visitForm.prescriptionPdf} target="_blank" rel="noopener noreferrer">View PDF</a><button type="button" className="ghost mini" onClick={clearPrescriptionUpload}>Remove</button></div>
                </div>
              )}
            </div>
            <label>Clinical notes<textarea rows="5" value={visitForm.notes} onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })} placeholder="Observations, diagnosis, and follow-up plan" /></label>
            {visitError && <p className="err" role="alert">{visitError}</p>}
            <button type="submit">Save visit notes</button>
          </form>
        </div>
      </section>
    </div>}
  </>;
}

function todayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function Billing() {
  const emptyLine = () => ({ description: '', quantity: '1', unitPrice: '' });
  const emptyForm = () => ({ patientId: '', date: todayDate(), lineItems: [emptyLine()], gstRate: '', insurance: 'Self Pay', status: 'Unpaid' });
  const [invoices, setInvoices] = useState([]), [patients, setPatients] = useState([]);
  const [form, setForm] = useState(emptyForm), [selected, setSelected] = useState(null), [err, setErr] = useState('');
  const load = async () => {
    const [invoiceRows, patientRows] = await Promise.all([api('invoices'), api('patients')]);
    setInvoices(invoiceRows);
    setPatients(patientRows);
  };
  useEffect(() => { load().catch(e => setErr(e.message)); }, []);
  const lineItems = form.lineItems.map(line => ({
    description: line.description.trim(),
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unitPrice) || 0,
    amount: (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
  }));
  const subtotal = lineItems.reduce((sum, line) => sum + line.amount, 0);
  const gstRate = Number(form.gstRate) || 0;
  const gstAmount = Math.round(subtotal * gstRate) / 100;
  const total = subtotal + gstAmount;
  const createInvoice = async e => {
    e.preventDefault();
    setErr('');
    try {
      const patient = patients.find(item => item._id === form.patientId);
      if (!patient) throw new Error('Select a patient for this invoice.');
      await api('invoices', 'POST', {
        patientId: patient._id, patient: patient.name, date: form.date,
        lineItems, description: lineItems.map(line => line.description).join(', '),
        subtotal, gstRate, gstAmount, amount: total, insurance: form.insurance, status: form.status,
      });
      setForm(emptyForm());
      await load();
    } catch (error) {
      setErr(error.message);
    }
  };
  const updateStatus = async (invoice, status) => {
    try {
      await api(`invoices/${invoice._id}`, 'PUT', { ...invoice, status });
      await load();
    } catch (error) {
      setErr(error.message);
    }
  };
  const removeInvoice = async invoice => {
    try {
      await api(`invoices/${invoice._id}`, 'DELETE');
      await load();
    } catch (error) {
      setErr(error.message);
    }
  };
  const invoiceNumber = invoice => `INV-${(invoice.date || invoice.createdAt || todayDate()).slice(0, 4)}-${invoice._id.slice(-6).toUpperCase()}`;
  const printInvoice = () => window.print();
  return <>
    <h2>Billing &amp; Invoices</h2>
    <form className="card invoice-form" onSubmit={createInvoice}>
      <label>Patient
        <select required value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })}>
          <option value="">Select patient</option>
          {patients.map(patient => <option key={patient._id} value={patient._id}>{patient.name}</option>)}
        </select>
      </label>
      <label>Bill date<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
      <div className="invoice-line-items">
        <div className="invoice-lines-heading"><strong>Services / treatments</strong><button type="button" className="ghost mini" onClick={() => setForm({ ...form, lineItems: [...form.lineItems, emptyLine()] })}>Add item</button></div>
        {form.lineItems.map((line, index) => <div className="invoice-line" key={index}>
          <label>Description<input required value={line.description} onChange={e => setForm({ ...form, lineItems: form.lineItems.map((item, i) => i === index ? { ...item, description: e.target.value } : item) })} placeholder="e.g. Consultation" /></label>
          <label>Qty<input required type="number" min="1" step="1" value={line.quantity} onChange={e => setForm({ ...form, lineItems: form.lineItems.map((item, i) => i === index ? { ...item, quantity: e.target.value } : item) })} /></label>
          <label>Rate (₹)<input required type="number" min="0.01" step="0.01" value={line.unitPrice} onChange={e => setForm({ ...form, lineItems: form.lineItems.map((item, i) => i === index ? { ...item, unitPrice: e.target.value } : item) })} /></label>
          {form.lineItems.length > 1 && <button type="button" className="ghost mini remove-invoice-line" aria-label={`Remove item ${index + 1}`} onClick={() => setForm({ ...form, lineItems: form.lineItems.filter((_, i) => i !== index) })}>Remove</button>}
        </div>)}
      </div>
      <label>GST rate (%) — optional<input type="number" min="0" max="100" step="0.01" value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })} placeholder="Leave blank for no GST" /></label>
      <label>Insurance / payment
        <select value={form.insurance} onChange={e => setForm({ ...form, insurance: e.target.value })}>
          {INDIAN_INSURERS.map(insurer => <option key={insurer}>{insurer}</option>)}
        </select>
      </label>
      <label>Payment status
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
          <option>Unpaid</option><option>Paid</option>
        </select>
      </label>
      <div className="invoice-total"><span>Subtotal: {inr(subtotal)}</span><span>GST: {inr(gstAmount)}</span><strong>Total: {inr(total)}</strong></div>
      {err && <p className="err" role="alert">{err}</p>}
      <button type="submit">Create invoice</button>
    </form>
    <div className="card scroll"><table><thead><tr><th>Invoice</th><th>Patient</th><th>Date</th><th>Service</th><th>Subtotal</th><th>GST</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{invoices.map(invoice => {
        const base = Number(invoice.subtotal ?? invoice.amount ?? 0);
        const tax = Number(invoice.gstAmount || 0);
        return <tr key={invoice._id}>
          <td>{invoiceNumber(invoice)}</td><td>{invoice.patient}</td><td>{invoice.date}</td><td>{invoiceLines(invoice).map(line => line.description).join(', ')}</td>
          <td>{inr(base)}</td><td>{inr(tax)}</td><td><strong>{inr(invoice.amount)}</strong></td>
          <td><select className="status-select" value={invoice.status || 'Unpaid'} onChange={e => updateStatus(invoice, e.target.value)}><option>Unpaid</option><option>Paid</option></select></td>
          <td><div className="invoice-actions"><button className="ghost mini" onClick={() => setSelected(invoice)}>View / Print</button><button className="ghost mini" onClick={() => removeInvoice(invoice)}>Delete</button></div></td>
        </tr>;
      })}</tbody></table>
      {!invoices.length && <p className="muted pad">No invoices yet. Create the first bill above.</p>}</div>
    {selected && <div className="invoice-modal" role="dialog" aria-modal="true" aria-label="Invoice preview">
      <article className="invoice-print">
        <header><div><h2>{CLINIC_NAME}</h2><p>Dental clinic invoice</p></div><div className="invoice-number"><strong>{invoiceNumber(selected)}</strong><br />Date: {selected.date}</div></header>
        <hr />
        <p><strong>Bill to:</strong> {selected.patient}</p>
        <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{invoiceLines(selected).map((line, index) => <tr key={index}><td>{line.description}</td><td>{line.quantity}</td><td>{inr(line.unitPrice)}</td><td>{inr(line.amount)}</td></tr>)}</tbody></table>
        <div className="invoice-breakdown"><p>Subtotal: {inr(selected.subtotal ?? selected.amount)}</p><p>GST ({Number(selected.gstRate || 0)}%): {inr(selected.gstAmount || 0)}</p><h3>Total: {inr(selected.amount)}</h3><p>Status: {selected.status || 'Unpaid'}</p></div>
        <p className="muted">Thank you for choosing {CLINIC_NAME}.</p>
        <div className="invoice-actions no-print"><button onClick={printInvoice}>Print bill</button><button className="ghost" onClick={() => setSelected(null)}>Close</button></div>
      </article>
    </div>}
  </>;
}

function Dashboard({ s }) {
  const cards = [
    ['Today’s appointments', s.todayAppointments, 'calendar', 'Appointments scheduled today'],
    ['Total patients', s.patients, 'patientsCount', 'Registered patient records'],
    ['Pending treatments', s.pendingTreatments, 'tooth', 'Require follow-up'],
    ['Monthly revenue', inr(s.monthlyRevenue), 'rupee', 'Paid invoices this month'],
  ];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return <>
    <header className="dashboard-heading"><div><p className="eyebrow">CLINIC OVERVIEW</p><h1>Good day, {localStorage.name || 'Doctor'}</h1><p className="muted">Here’s your practice summary for today.</p></div><span className="dashboard-date"><Icon name="calendar" size={17} />{today}</span></header>
    <div className="grid4 dashboard-stats">{cards.map(([label, value, icon, detail]) => <article key={label} className="stat">
      <div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon name={icon} size={19} /></span></div>
      <strong>{value}</strong><span className="stat-detail">{detail}</span>
    </article>)}</div>
    <div className="dashboard-panels">
      <section className="card dashboard-panel"><div className="panel-heading"><div><h2>Upcoming appointments</h2><p className="muted">Your next scheduled visits</p></div><span className="panel-count">{s.upcoming.length}</span></div>
        {s.upcoming.length ? <div className="appointment-list">{s.upcoming.map((appointment, i) => <article className="appointment-item" key={appointment._id || i}>
          <div className="appointment-time">{appointment.time}</div><div className="appointment-info"><strong>{appointment.patient}</strong><span>{appointment.type} · {appointment.branchName}</span></div>
          <span className={'tag ' + String(appointment.status || 'Booked').toLowerCase()}>{appointment.status || 'Booked'}</span>
        </article>)}</div> : <p className="muted empty-state">No upcoming appointments.</p>}
      </section>
      <section className="card dashboard-panel"><div className="panel-heading"><div><h2>Inventory alerts</h2><p className="muted">Items at or below reorder level</p></div><span className="panel-count">{s.lowStock.length}</span></div>
        {s.lowStock.length ? <div className="stock-list">{s.lowStock.map(item => <div className="stock-item" key={item}><span className="stock-dot" /><span>{item}</span></div>)}
        </div> : <p className="healthy-stock"><span className="healthy-dot" />All clinical supplies are well stocked.</p>}
      </section>
    </div>
  </>;
}
const dateValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDateValue = value => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
function Reports({ s }) {
  const rev = s.revenueByMonth, mix = Object.entries(s.treatmentMix);
  const today = new Date();
  const initialStart = dateValue(addDays(today, -29));
  const [appointments, setAppointments] = useState([]), [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(dateValue(today)), [grouping, setGrouping] = useState('day');
  const [patientError, setPatientError] = useState('');
  useEffect(() => { api('appointments').then(setAppointments).catch(e => setPatientError(e.message)); }, []);
  const startDate = parseDateValue(start), endDate = parseDateValue(end);
  const periodStart = date => {
    const result = new Date(date);
    if (grouping === 'week') {
      result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
    } else if (grouping === 'month') {
      result.setDate(1);
    }
    result.setHours(0, 0, 0, 0);
    return result;
  };
  const periods = [];
  if (start && end && startDate <= endDate) {
    for (let cursor = periodStart(startDate); cursor <= endDate;) {
      periods.push({ key: dateValue(cursor), label: grouping === 'month'
        ? cursor.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        : grouping === 'week' ? `Week of ${dateValue(cursor)}` : dateValue(cursor) });
      if (grouping === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      else cursor = addDays(cursor, grouping === 'week' ? 7 : 1);
    }
  }
  const appointmentCounts = new Map(periods.map(period => [period.key, 0]));
  if (start && end && startDate <= endDate) {
    appointments.forEach(appointment => {
      if (!appointment.date) return;
      const day = parseDateValue(appointment.date);
      if (Number.isNaN(day.getTime())) return;
      if (day < startDate || day > endDate) return;
      const key = dateValue(periodStart(day));
      appointmentCounts.set(key, (appointmentCounts.get(key) || 0) + 1);
    });
  }
  return <><h2>Reports</h2><div className="card patient-report">
    <div className="report-heading"><div><h3>Patient appointments</h3><p className="muted">Appointments scheduled in the selected date range</p></div>
      <div className="report-filters">
        <label>From<input type="date" value={start} max={end} onChange={e => setStart(e.target.value)} /></label>
        <label>To<input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} /></label>
        <label>Group by<select value={grouping} onChange={e => setGrouping(e.target.value)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
      </div>
    </div>
    {patientError ? <p className="err" role="alert">{patientError}</p> : startDate > endDate ? <p className="muted">Choose a valid date range.</p> :
      <div className="patient-chart"><Bar data={{ labels: periods.map(period => period.label), datasets: [{ label: 'Appointments', data: periods.map(period => appointmentCounts.get(period.key) || 0), backgroundColor: '#7c4199', borderRadius: 5, maxBarThickness: 42 }] }}
        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#74677b', maxRotation: 45, minRotation: 0 }, grid: { color: 'rgba(124,65,153,.07)' } }, y: { beginAtZero: true, ticks: { precision: 0, color: '#74677b' }, grid: { color: 'rgba(124,65,153,.12)' } } } }} /></div>}
  </div>
  <div className="grid2">
    <div className="card"><h3>Revenue by month</h3><Bar data={{ labels: rev.map(r => r[0]), datasets: [{ data: rev.map(r => r[1]), backgroundColor: '#9b63b2', borderRadius: 6 }] }} options={{ plugins: { legend: { display: false } } }} /></div>
    <div className="card"><h3>Treatment mix</h3><Doughnut data={{ labels: mix.map(m => m[0]), datasets: [{ data: mix.map(m => m[1]), backgroundColor: ['#7c4199', '#c98ae3', '#a865c1', '#e5c3f2', '#9b63b2'] }] }} /></div></div></>;
}
function PatientPortal({ name, onSignOut }) {
  const chatPrompts = [
    '📅 How do I book an appointment?',
    '📄 Where can I view my prescriptions & records?',
    '⏱️ What are clinic timings and location?',
    '🚨 Emergency dental care tips',
  ];
  const emptyBooking = () => ({ date: todayDate(), time: '', type: '', branchId: '' });
  const [appointments, setAppointments] = useState([]), [form, setForm] = useState(emptyBooking);
  const [branches, setBranches] = useState([]);
  const [branchesError, setBranchesError] = useState('');
  const [records, setRecords] = useState({ visits: [], treatments: [], invoices: [] });
  const [tab, setTab] = useState('Overview'), [error, setError] = useState(''), [recordsError, setRecordsError] = useState(''), [notice, setNotice] = useState('');
  const [appointmentRemindersEnabled, setAppointmentRemindersEnabled] = useState(false);
  const [preferenceError, setPreferenceError] = useState(''), [preferenceSaving, setPreferenceSaving] = useState(false);
  const [rescheduling, setRescheduling] = useState(null), [rescheduleForm, setRescheduleForm] = useState({ date: todayDate(), time: '', branchId: '' });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatMessagesEndRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([{
    sender: 'assistant',
    text: 'Hi! I can help you navigate appointments and records, and share general dental-care guidance. I can’t diagnose or replace advice from your dentist.',
  }]);
  const loadAppointments = async () => setAppointments(await api('patient/appointments'));
  const loadRecords = async () => setRecords(await api('patient/records'));
  useEffect(() => {
    loadAppointments().catch(e => setError(e.message));
    loadRecords().catch(e => setRecordsError(e.message));
    api('branches').then(branchList => {
      setBranches(branchList);
      setForm(current => ({ ...current, branchId: current.branchId || branchList[0]?._id || '' }));
    }).catch(e => setBranchesError(e.message));
    api('patient/preferences').then(preferences => setAppointmentRemindersEnabled(preferences.appointmentRemindersEnabled)).catch(e => setPreferenceError(e.message));
  }, []);
  const saveReminderPreference = async event => {
    const enabled = event.target.checked;
    setPreferenceSaving(true);
    setPreferenceError('');
    try {
      const preferences = await api('patient/preferences', 'PUT', { appointmentRemindersEnabled: enabled });
      setAppointmentRemindersEnabled(preferences.appointmentRemindersEnabled);
    } catch (e) {
      setPreferenceError(e.message);
    } finally {
      setPreferenceSaving(false);
    }
  };
  useEffect(() => {
    if (chatOpen) chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages, chatOpen]);
  const book = async e => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await api('patient/appointments', 'POST', form);
      setForm({ ...emptyBooking(), branchId: branches[0]?._id || '' });
      await loadAppointments();
      setNotice('Appointment request sent. It will be confirmed by clinic staff.');
    } catch (e) {
      setError(e.message);
    }
  };
  const cancelAppointment = async appointment => {
    if (!window.confirm('Cancel this appointment request?')) return;
    setError('');
    setNotice('');
    try {
      await api(`patient/appointments/${appointment._id}`, 'PATCH', { action: 'cancel' });
      await loadAppointments();
      setNotice('Appointment cancelled.');
    } catch (e) {
      setError(e.message);
    }
  };
  const openReschedule = appointment => {
    setRescheduling(appointment);
    setRescheduleForm({ date: appointment.date || todayDate(), time: appointment.time || '', branchId: appointment.branchId || branches[0]?._id || '' });
    setError('');
    setNotice('');
  };
  const rescheduleAppointment = async e => {
    e.preventDefault();
    if (!rescheduling) return;
    setError('');
    setNotice('');
    try {
      await api(`patient/appointments/${rescheduling._id}`, 'PATCH', rescheduleForm);
      await loadAppointments();
      setRescheduling(null);
      setNotice('Reschedule request sent. The clinic will confirm the updated time.');
    } catch (e) {
      setError(e.message);
    }
  };
  const invoiceNumber = invoice => `INV-${(invoice.date || invoice.createdAt || todayDate()).slice(0, 4)}-${invoice._id.slice(-6).toUpperCase()}`;
  const downloadInvoice = invoice => setSelectedInvoice(invoice);
  const printInvoice = () => window.print();
  const emergencyPhone = import.meta.env.VITE_CLINIC_PHONE || '';
  const emergencyDigits = emergencyPhone.replace(/\D/g, '');
  const recordsList = [
    ...records.visits.map(visit => ({ ...visit, kind: 'visit', recordDate: visit.date || visit.createdAt })),
    ...records.treatments.map(treatment => ({ ...treatment, kind: 'treatment', recordDate: treatment.followUp || treatment.createdAt })),
  ].sort((a, b) => String(b.recordDate || '').localeCompare(String(a.recordDate || '')));
  const outstanding = records.invoices.filter(invoice => invoice.status !== 'Paid').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const paidTotal = records.invoices.filter(invoice => invoice.status === 'Paid').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const totalBilled = records.invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const statusLabel = status => status === 'Booked' || status === 'Scheduled' ? 'Pending' : status || 'Pending';
  const canChangeAppointment = appointment => ['Booked', 'Confirmed'].includes(appointment.status || 'Booked') && appointment.date >= todayDate();
  const answerChat = question => {
    const text = question.toLowerCase();
    const urgent = /emergency|urgent|severe|swelling|bleed|bleeding|trauma|knocked|breathing|swallowing|uncontrolled/.test(text);
    if (urgent) {
      return {
        text: 'For difficulty breathing or swallowing, facial swelling, uncontrolled bleeding, or facial trauma, seek urgent professional care now. For other dental emergencies, contact your dentist promptly. I can’t assess symptoms or provide a diagnosis.',
        handover: true,
      };
    }
    if (/appointment|book|schedule|reschedul|cancel|status|confirm/.test(text)) {
      if (/status|confirm|cancelled|canceled/.test(text) && appointments.length) {
        return {
          text: `Your appointment requests: ${appointments.map(appointment => `${appointment.date} at ${appointment.time} — ${appointment.type}: ${statusLabel(appointment.status)}`).join('; ')}. You can reschedule or cancel eligible future appointments from Overview.`,
          action: { label: 'Open Overview', tab: 'Overview' },
        };
      }
      return {
        text: 'To book, open Overview, choose a date, available time, and reason, then select “Request appointment.” New requests are Pending until the clinic confirms them. You can review status and manage eligible future appointments in My appointments.',
        action: { label: 'Open Overview', tab: 'Overview' },
      };
    }
    if (/record|prescription|medical|treatment|clinical note|history/.test(text)) {
      return {
        text: 'Your past visits, treatment history, clinical notes, and prescription PDFs are in the Medical records tab.',
        action: { label: 'Open Medical records', tab: 'Medical records' },
      };
    }
    if (/bill|invoice|billing|payment|paid|balance/.test(text)) {
      return {
        text: 'Your invoice history, payment status, and billing summary are in the Billing tab. Use “Download / print PDF” to print or save an invoice.',
        action: { label: 'Open Billing', tab: 'Billing' },
      };
    }
    if (/timing|hours|open|location|address|where.*clinic/.test(text)) {
      return {
        text: 'Clinic hours and location haven’t been added to this portal yet. Please contact the clinic directly for current details.',
        handover: true,
      };
    }
    if (/toothache|tooth pain|pain|ache/.test(text)) {
      return {
        text: 'For toothache, arrange advice from a dentist, especially if pain is worsening or persistent. Until you receive professional advice, gently rinse with warm salt water and avoid very hot, cold, or sweet foods if they trigger pain. Don’t place aspirin or other medicines directly on the tooth or gums. Seek urgent care for facial swelling, uncontrolled bleeding, or difficulty breathing or swallowing.',
        handover: true,
      };
    }
    if (/extraction|root canal|after treatment|post.?treatment|aftercare|care after/.test(text)) {
      return {
        text: 'Follow the instructions your dentist gave you, including any medication directions. After an extraction, avoid disturbing the site and follow your dentist’s guidance about rinsing, eating, and activity. After a root canal, follow the restoration and follow-up plan. Contact your dentist if symptoms worsen or you’re concerned.',
      };
    }
    if (/hygiene|brush|floss|clean teeth/.test(text)) {
      return {
        text: 'General dental-care guidance: brush twice daily with fluoride toothpaste, clean between teeth daily, and attend check-ups as recommended by your dentist. Individual care needs can vary.',
      };
    }
    return {
      text: 'I can help with appointments, medical records, billing, and general dental-care guidance. For personal symptoms, treatment advice, or another complex question, contact the clinic so its team can help.',
      handover: true,
    };
  };
  const sendChatMessage = question => {
    const prompt = question.trim();
    if (!prompt) return;
    const response = answerChat(prompt);
    setChatMessages(current => [...current, { sender: 'patient', text: prompt }, { sender: 'assistant', ...response }]);
    setChatInput('');
  };
  return <div className="patient-portal">
    <header className="portal-header">
      <div className="portal-welcome"><img className="clinic-logo portal-logo" src="/clinic-logo.png" alt={`${CLINIC_NAME} logo`} /><div><h1>Welcome, {name}</h1><p>Book a visit and track your appointment requests.</p></div></div>
      <button className="ghost" onClick={onSignOut}>Sign out</button>
    </header>
    <nav className="portal-tabs" aria-label="Patient portal sections">
      {['Overview', 'Medical records', 'Billing', 'Settings'].map(section => <button key={section} type="button" className={tab === section ? 'on' : ''} aria-current={tab === section ? 'page' : undefined} onClick={() => setTab(section)}>{section}</button>)}
    </nav>
    {error && <p className="err" role="alert">{error}</p>}
    {notice && <p className="portal-notice" role="status">{notice}</p>}
    {tab === 'Overview' && <>
      <div className="portal-grid">
        <form className="card portal-booking" onSubmit={book}>
          <h2>Request an appointment</h2>
          <p className="muted">Your request will stay pending until clinic staff confirms it.</p>
          <label>Date<input required type="date" min={todayDate()} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
          <label>Available time
            <select required value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}>
              <option value="">Select a time</option>
              {['09:00', '10:30', '12:00', '14:00', '16:00'].map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </label>
          <label>Clinic branch
            <select required value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select a branch</option>
              {branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
            </select>
          </label>
          <label>Reason for visit
            <select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="">Select a reason</option>
              {['Routine Check-up', 'Dental Pain', 'Teeth Cleaning', 'Tooth Filling', 'Orthodontic Consultation', 'Other'].map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <button type="submit">Request appointment</button>
          {branchesError && <p className="err" role="alert">{branchesError}</p>}
        </form>
        <section className="card portal-appointments">
          <h2>My appointments</h2>
          {appointments.length ? appointments.map(appointment => <article className="portal-appointment" key={appointment._id}>
            <div className="portal-appointment-info"><strong>{appointment.date} at {appointment.time}</strong><p>{appointment.type} · {appointment.branchName}</p></div>
            <span className={'tag ' + statusLabel(appointment.status).toLowerCase()}>{statusLabel(appointment.status)}</span>
            {canChangeAppointment(appointment) && <div className="portal-appointment-actions">
              <button type="button" className="ghost mini" onClick={() => openReschedule(appointment)}>Reschedule</button>
              <button type="button" className="ghost mini" onClick={() => cancelAppointment(appointment)}>Cancel</button>
            </div>}
          </article>) : <p className="muted">You have no appointment requests yet.</p>}
        </section>
      </div>
      <section className="card portal-emergency">
        <div><p className="eyebrow">NEED URGENT DENTAL HELP?</p><h2>Dental emergency contacts</h2><p className="muted">For severe swelling, facial trauma, uncontrolled bleeding, or difficulty breathing or swallowing, seek urgent professional care.</p></div>
        {emergencyDigits.length >= 8 ? <div className="portal-emergency-actions">
          <a className="portal-contact-call" href={`tel:+${emergencyDigits}`}>Call clinic</a>
          <a className="portal-contact-whatsapp" href={`https://wa.me/${emergencyDigits}`} target="_blank" rel="noopener noreferrer">WhatsApp clinic</a>
        </div> : <p className="muted portal-contact-config">Clinic emergency contact is not configured yet.</p>}
      </section>
      <section className="card portal-care">
        <h2>Post-treatment care guidelines</h2>
        <p className="muted">General guidance only. Follow the instructions provided by your dentist for your specific treatment.</p>
        <ul>
          <li>Follow the care instructions and medication directions provided by your dental team.</li>
          <li>After a procedure, avoid disturbing the treated area and choose foods appropriate to your dentist’s advice.</li>
          <li>Keep the area clean as instructed, and attend any recommended follow-up visit.</li>
          <li>Contact your dentist if pain, bleeding, swelling, or other symptoms worsen or concern you.</li>
        </ul>
      </section>
      {rescheduling && <div className="invoice-modal portal-reschedule-modal" role="dialog" aria-modal="true" aria-label="Reschedule appointment">
        <form className="patient-edit-form" onSubmit={rescheduleAppointment}>
          <header className="visit-header"><div><h2>Reschedule appointment</h2><p className="muted">{rescheduling.type}</p></div><button type="button" className="ghost" onClick={() => setRescheduling(null)}>Close</button></header>
          <label>Date<input required type="date" min={todayDate()} value={rescheduleForm.date} onChange={e => setRescheduleForm({ ...rescheduleForm, date: e.target.value })} /></label>
          <label>Available time<select required value={rescheduleForm.time} onChange={e => setRescheduleForm({ ...rescheduleForm, time: e.target.value })}><option value="">Select a time</option>{['09:00', '10:30', '12:00', '14:00', '16:00'].map(time => <option key={time} value={time}>{time}</option>)}</select></label>
          <label>Clinic branch<select required value={rescheduleForm.branchId} onChange={e => setRescheduleForm({ ...rescheduleForm, branchId: e.target.value })}><option value="">Select a branch</option>{branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}</select></label>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="patient-edit-actions"><button type="button" className="ghost" onClick={() => setRescheduling(null)}>Cancel</button><button type="submit">Send reschedule request</button></div>
        </form>
      </div>}
    </>}
    {tab === 'Medical records' && <section className="card portal-records">
      <div className="portal-section-heading"><div><h2>Medical records &amp; prescriptions</h2><p className="muted">Your treatment history, visit notes, and prescription documents.</p></div></div>
      {recordsError && <p className="err" role="alert">{recordsError}</p>}
      {!recordsError && !recordsList.length && <p className="muted">No medical records are available yet.</p>}
      {recordsList.map((record, index) => <article className="portal-record" key={`${record.kind}-${record._id || index}`}>
        <div className="portal-record-heading"><div><span className="tag">{record.kind === 'visit' ? 'Visit' : 'Treatment'}</span><time>{record.recordDate ? String(record.recordDate).slice(0, 10) : 'Date not recorded'}</time></div><strong>{record.reason || record.procedure || 'Dental care'}</strong></div>
        {record.prescription && <div><strong>Prescription</strong><p className="prescription-text">{record.prescription}</p></div>}
        {record.notes && <div><strong>Clinical notes</strong><p className="prescription-text">{record.notes}</p></div>}
        {record.status && <p className="muted">Treatment status: {record.status}{record.followUp ? ` · Follow-up: ${record.followUp}` : ''}</p>}
        {record.prescriptionPdf && <a className="prescription-pdf" href={record.prescriptionPdf} target="_blank" rel="noopener noreferrer" download={record.prescriptionFilename || 'prescription.pdf'}>View / download prescription PDF{record.prescriptionFilename ? `: ${record.prescriptionFilename}` : ''}</a>}
      </article>)}
    </section>}
    {tab === 'Billing' && <section className="card portal-billing">
      <div className="portal-section-heading"><div><h2>Billing &amp; invoices</h2><p className="muted">Invoice summary for your visits.</p></div></div>
      <div className="portal-billing-summary">
        <div><span>Total billed</span><strong>{inr(totalBilled)}</strong></div>
        <div><span>Paid</span><strong>{inr(paidTotal)}</strong></div>
        <div><span>Outstanding</span><strong>{inr(outstanding)}</strong></div>
      </div>
      {recordsError && <p className="err" role="alert">{recordsError}</p>}
      {records.invoices.map(invoice => <article className="portal-invoice" key={invoice._id}>
        <div><strong>{invoiceNumber(invoice)}</strong><p>{invoice.date} · {invoiceLines(invoice).map(line => line.description).join(', ')}</p></div>
        <strong>{inr(invoice.amount)}</strong>
        <span className={'tag ' + String(invoice.status || 'Unpaid').toLowerCase()}>{invoice.status || 'Unpaid'}</span>
        <button type="button" className="ghost mini" onClick={() => downloadInvoice(invoice)}>Download / print PDF</button>
      </article>)}
      {!recordsError && !records.invoices.length && <p className="muted">No invoices are available yet.</p>}
    </section>}
    {tab === 'Settings' && <section className="card portal-settings">
      <div className="portal-section-heading"><div><h2>Appointment reminders</h2><p className="muted">Choose whether you would like to receive a reminder 24 hours before your appointment.</p></div></div>
      <label className="reminder-preference">
        <input type="checkbox" checked={appointmentRemindersEnabled} disabled={preferenceSaving} onChange={saveReminderPreference} />
        <span>Send me WhatsApp / SMS appointment reminders (24 hours before)</span>
      </label>
      {preferenceError && <p className="err" role="alert">{preferenceError}</p>}
      <p className="muted reminder-setup-note">This feature is in progress.</p>
    </section>}
    {selectedInvoice && <div className="invoice-modal portal-invoice-modal" role="dialog" aria-modal="true" aria-label="Invoice PDF preview">
      <article className="invoice-print">
        <header><div><h2>{CLINIC_NAME}</h2><p>Dental clinic invoice</p></div><div className="invoice-number"><strong>{invoiceNumber(selectedInvoice)}</strong><br />Date: {selectedInvoice.date}</div></header>
        <hr />
        <p><strong>Bill to:</strong> {name}</p>
        <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{invoiceLines(selectedInvoice).map((line, index) => <tr key={index}><td>{line.description}</td><td>{line.quantity}</td><td>{inr(line.unitPrice)}</td><td>{inr(line.amount)}</td></tr>)}</tbody></table>
        <div className="invoice-breakdown"><p>Subtotal: {inr(selectedInvoice.subtotal ?? selectedInvoice.amount)}</p><p>GST ({Number(selectedInvoice.gstRate || 0)}%): {inr(selectedInvoice.gstAmount || 0)}</p><h3>Total: {inr(selectedInvoice.amount)}</h3><p>Status: {selectedInvoice.status || 'Unpaid'}</p></div>
        <div className="invoice-actions no-print"><button type="button" onClick={printInvoice}>Print / Save as PDF</button><button type="button" className="ghost" onClick={() => setSelectedInvoice(null)}>Close</button></div>
      </article>
    </div>}
    <aside className={`patient-chat-widget${chatOpen ? ' is-open' : ''}`} aria-label="SmileCraft patient assistant">
      {chatOpen && <section className="patient-chat-panel" role="dialog" aria-modal="false" aria-label="SmileCraft Assistant">
        <header className="patient-chat-header">
          <div><span className="patient-chat-avatar" aria-hidden="true">SC</span><div><strong>SmileCraft Assistant</strong><small>Patient support</small></div></div>
          <button type="button" className="patient-chat-close" aria-label="Close chat" onClick={() => setChatOpen(false)}>×</button>
        </header>
        <div className="patient-chat-messages" aria-live="polite">
          {chatMessages.map((message, index) => <article className={`patient-chat-message ${message.sender}`} key={index}>
            <p>{message.text}</p>
            {message.action && <button type="button" className="patient-chat-action" onClick={() => { setTab(message.action.tab); setChatOpen(false); }}>{message.action.label}</button>}
            {message.handover && <div className="patient-chat-handover">
              {emergencyDigits.length >= 8 ? <>
                <a href={`tel:+${emergencyDigits}`}>Call Clinic</a>
                <a href={`https://wa.me/${emergencyDigits}`} target="_blank" rel="noopener noreferrer">Contact Support on WhatsApp</a>
              </> : <span>Clinic phone support is not configured. Please use your clinic’s known contact details. In a life-threatening emergency, contact local emergency services.</span>}
            </div>}
          </article>)}
          <div ref={chatMessagesEndRef} />
        </div>
        {chatMessages.length === 1 && <div className="patient-chat-prompts" aria-label="Suggested questions">
          {chatPrompts.map(prompt => <button type="button" key={prompt} onClick={() => sendChatMessage(prompt)}>{prompt}</button>)}
        </div>}
        <form className="patient-chat-compose" onSubmit={event => { event.preventDefault(); sendChatMessage(chatInput); }}>
          <input aria-label="Message the assistant" value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="Ask about appointments or care…" />
          <button type="submit" aria-label="Send message" disabled={!chatInput.trim()}>Send</button>
        </form>
      </section>}
      <button type="button" className="patient-chat-launcher" aria-label={chatOpen ? 'Close SmileCraft Assistant' : 'Open SmileCraft Assistant'} aria-expanded={chatOpen} onClick={() => setChatOpen(open => !open)}>
        {chatOpen ? <span aria-hidden="true">×</span> : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.2-.7L4 20l1.5-4.5a7.5 7.5 0 1 1 14.5-4Z" /><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" /></svg>}
      </button>
    </aside>
  </div>;
}
function Assistant() {
  const [msgs, setMsgs] = useState([{ r: 'ai', t: 'Hi Doctor. I can answer questions about clinic activity and share general oral-health information. For personal diagnosis or treatment advice, please examine the patient or refer to a dentist.' }]), [q, setQ] = useState('');
  const [listening, setListening] = useState(false), [voiceMessage, setVoiceMessage] = useState('');
  const recognitionRef = useRef(null);
  const ask = async text => {
    const t = text || q;
    if (!t) return;
    setQ('');
    setMsgs(m => [...m, { r: 'me', t }]);
    try {
      const d = await api('ai', 'POST', { q: t });
      setMsgs(m => [...m, { r: 'ai', t: d.answer }]);
    } catch (error) {
      setMsgs(m => [...m, { r: 'ai', t: `I couldn't answer that right now: ${error.message}` }]);
    }
  };
  const toggleVoiceInput = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage('Voice input is not supported by this browser. You can still type your question.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setListening(true);
      setVoiceMessage('Listening…');
    };
    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        setQ(transcript);
        setVoiceMessage(`Heard: “${transcript}”`);
        ask(transcript);
      }
    };
    recognition.onerror = event => {
      setVoiceMessage(event.error === 'not-allowed'
        ? 'Microphone access was denied. Allow microphone access or type your question.'
        : `Voice input failed (${event.error}). You can still type your question.`);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };
  return <><h2>AI Assistant</h2><div className="card chat">{msgs.map((m, i) => <p key={i} className={'bubble ' + m.r}>{m.t}</p>)}</div>
    <div className="chips">{['How many patients do we have?', 'Which patients have a follow-up?', 'Which patients have follow-ups this week?', 'How many appointments are today?', 'What is this month’s revenue?', 'How much is unpaid?', 'Which supplies are low?', 'How many treatments are pending?', 'How often should patients brush?', 'How can patients care for their teeth?'].map(x => <button className="ghost" key={x} onClick={() => ask(x)}>{x}</button>)}</div>
    <div className="card form assistant-compose"><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="Ask anything about your clinic" /><button type="button" className="ghost voice-button" onClick={toggleVoiceInput} aria-label={listening ? 'Stop voice input' : 'Ask using voice'} title={listening ? 'Stop listening' : 'Ask using voice'}><Icon name="mic" size={19} /><span>{listening ? 'Listening' : 'Voice'}</span></button><button onClick={() => ask()}>Ask AI</button></div>
    {voiceMessage && <p className="muted" role="status">{voiceMessage}</p>}
    <p className="muted ai-privacy">Clinic-data questions are answered from local clinic records. General questions may be sent to Google Gemini when configured; never include identifying patient information. Voice recognition may be processed by your browser’s speech service.</p></>;
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.token), [role, setRole] = useState(localStorage.role || 'doctor');
  const [tab, setTab] = useState('Dashboard'), [s, setS] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    if (authed && role === 'doctor') api('stats').then(setS).catch(() => setS(null));
  }, [authed, role, tab]);
  if (!authed) return <Login onDone={user => { setRole(user.role); setAuthed(true); }} />;
  const signOut = () => { localStorage.clear(); setAuthed(false); setRole('doctor'); };
  if (role === 'patient') return <PatientPortal name={localStorage.name} onSignOut={signOut} />;
  return <div className="app"><nav className={mobileNavOpen ? 'mobile-open' : ''}><div className="brand"><img className="clinic-logo nav-logo" src="/clinic-logo-sidebar.png" alt={`${CLINIC_NAME} logo`} /><button className="mobile-menu-toggle" aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(open => !open)}><span /><span /><span /></button></div>{NAV_ITEMS.map(([label, icon]) => <button key={label} className={`nav-link ${label === tab ? 'on' : ''}`} onClick={() => { setTab(label); setMobileNavOpen(false); }}><Icon name={icon} size={19} /><span>{label}</span></button>)}
    <button className="out" onClick={signOut}>Sign out</button></nav>
    <main><p className="muted">Welcome back, {localStorage.name}</p>
      {tab === 'Dashboard' && s && <Dashboard s={s} />}{tab === 'Reports' && s && <Reports s={s} />}{tab === 'AI Assistant' && <Assistant />}
      {tab === 'Billing' && <Billing />}
      {tab === 'Patients' && <Patients />}
      {RESOURCES[tab] && <Resource key={tab} title={tab} {...RESOURCES[tab]} />}</main></div>;
}
