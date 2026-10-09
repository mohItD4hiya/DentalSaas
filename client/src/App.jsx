import { useEffect, useState } from 'react';
import { Chart as C, registerables } from 'chart.js'; import { Bar, Doughnut } from 'react-chartjs-2';
import { api } from './api.js'; C.register(...registerables);

const CLINIC_NAME = 'SmileCraft Dental Clinic';
const inr = n => '₹' + (n || 0).toLocaleString('en-IN');
const INDIAN_INSURERS = ['Star Health', 'Care Health', 'Max Bupa', 'Niva Bupa', 'ICICI Lombard', 'Self Pay'];
const APPOINTMENT_STATUS = ['Booked', 'Confirmed', 'Completed', 'Cancelled'];
const RESOURCES = {
  Appointments: { path: 'appointments', fields: [['patient', 'Patient'], ['date', 'Date', 'date'], ['time', 'Time', 'time'], ['type', 'Type'], ['status', 'Status', APPOINTMENT_STATUS]] },
  Patients: { path: 'patients', fields: [['name', 'Name'], ['age', 'Age', 'number'], ['phone', 'Phone'], ['history', 'Medical history']] },
  Treatments: { path: 'treatments', fields: [['patient', 'Patient'], ['procedure', 'Procedure'], ['notes', 'Clinical notes'], ['status', 'Status', ['Pending', 'Done']], ['followUp', 'Follow-up', 'date']] },
  Billing: { path: 'invoices', fields: [['patient', 'Patient'], ['date', 'Date', 'date'], ['amount', 'Amount (₹)', 'number'], ['insurance', 'Insurance', INDIAN_INSURERS], ['status', 'Status', ['Unpaid', 'Paid']]] },
  Inventory: { path: 'inventory', fields: [['name', 'Item'], ['qty', 'In stock', 'number'], ['minQty', 'Reorder at', 'number']] },
};

function Login({ onDone }) {
  const [f, setF] = useState({ email: 'dr.smith@dentalsaas.com', password: 'smile123' }), [err, setErr] = useState('');
  const go = async () => { try { const d = await api('auth/login', 'POST', f); localStorage.token = d.token; localStorage.name = d.name; onDone(); } catch (e) { setErr(e.message); } };
  return <div className="login"><div className="card"><h1>{CLINIC_NAME}</h1><p className="muted">Manage appointments, billing and patient care for your Indian dental practice</p>
    <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="Email" />
    <input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="Password" />
    {err && <p className="err">{err}</p>}<button onClick={go}>Sign in</button></div></div>;
}

function Resource({ title, path, fields }) {
  const [rows, setRows] = useState([]), [form, setForm] = useState({}), [q, setQ] = useState('');
  const load = () => api(path).then(setRows); useEffect(() => { load(); }, [path]);
  const add = async () => { await api(path, 'POST', form); setForm({}); load(); };
  const del = async id => { await api(`${path}/${id}`, 'DELETE'); load(); };
  const updateRow = async (id, patch) => {
    const row = rows.find(r => r._id === id); if (!row) return;
    await api(`${path}/${id}`, 'PUT', { ...row, ...patch });
    load();
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
    await api(`${path}/${id}`, 'PUT', { ...row, qty });
    load();
  };
  const shown = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  const rowDefaults = title === 'Billing' ? { insurance: INDIAN_INSURERS[0] } : {};
  return <>
    <h2>{title}</h2>
    <div className="card form">{fields.map(([k, l, t]) => Array.isArray(t)
      ? <select key={k} value={form[k] || rowDefaults[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}><option value="">{l}</option>{t.map(o => <option key={o}>{o}</option>)}</select>
      : <input key={k} type={t || 'text'} placeholder={l} title={l} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} />)}
      <button onClick={add}>Add {title.replace(/s$/, '').toLowerCase()}</button></div>
    <input className="search" placeholder={`Search ${title.toLowerCase()}`} value={q} onChange={e => setQ(e.target.value)} />
    <div className="card scroll"><table><thead><tr>{fields.map(([k, l]) => <th key={k}>{l}</th>)}<th /></tr></thead>
      <tbody>{shown.map(r => <tr key={r._id}>{fields.map(([k, , t]) => <td key={k}>
        {k === 'status' ? <div className="status-wrap">
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

function Dashboard({ s }) {
  const cards = [['Today\'s appointments', s.todayAppointments, '#2f6fed'], ['Total patients', s.patients, '#12b886'], ['Pending treatments', s.pendingTreatments, '#7c5cff'], ['Monthly revenue', inr(s.monthlyRevenue), '#f0525a']];
  return <><h2>Dashboard</h2><div className="grid4">{cards.map(([l, v, c]) => <div key={l} className="stat" style={{ background: c }}><b>{v}</b><span>{l}</span></div>)}</div>
    <div className="grid2"><div className="card"><h3>Upcoming appointments</h3>{s.upcoming.map((a, i) => <div className="row" key={i}><span>{a.time}</span><b>{a.patient}</b><span className="tag">{a.type}</span></div>)}</div>
      <div className="card"><h3>Low stock</h3>{s.lowStock.length ? s.lowStock.map(x => <div className="row" key={x}>{x}</div>) : <p className="muted">All clinical supplies are well stocked.</p>}</div></div></>;
}
function Reports({ s }) {
  const rev = s.revenueByMonth, mix = Object.entries(s.treatmentMix);
  return <><h2>Reports</h2><div className="grid2">
    <div className="card"><h3>Revenue by month</h3><Bar data={{ labels: rev.map(r => r[0]), datasets: [{ data: rev.map(r => r[1]), backgroundColor: '#2f6fed', borderRadius: 6 }] }} options={{ plugins: { legend: { display: false } } }} /></div>
    <div className="card"><h3>Treatment mix</h3><Doughnut data={{ labels: mix.map(m => m[0]), datasets: [{ data: mix.map(m => m[1]), backgroundColor: ['#2f6fed', '#12b886', '#7c5cff', '#f0525a', '#f59f00'] }] }} /></div></div></>;
}
function Assistant() {
  const [msgs, setMsgs] = useState([{ r: 'ai', t: 'Hi Doctor. Ask me about today\'s schedule, revenue, pending treatments or low stock in your clinic.' }]), [q, setQ] = useState('');
  const ask = async text => { const t = text || q; if (!t) return; setQ(''); setMsgs(m => [...m, { r: 'me', t }]); const d = await api('ai', 'POST', { q: t }); setMsgs(m => [...m, { r: 'ai', t: d.answer }]); };
  return <><h2>AI Assistant</h2><div className="card chat">{msgs.map((m, i) => <p key={i} className={'bubble ' + m.r}>{m.t}</p>)}</div>
    <div className="chips">{['What is on today?', 'How is revenue?', 'Which supplies are low?', 'Pending treatments?'].map(x => <button className="ghost" key={x} onClick={() => ask(x)}>{x}</button>)}</div>
    <div className="card form"><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="Ask anything about your clinic" /><button onClick={() => ask()}>Ask AI</button></div></>;
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.token), [tab, setTab] = useState('Dashboard'), [s, setS] = useState(null);
  useEffect(() => { if (authed) api('stats').then(setS); }, [authed, tab]);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const tabs = ['Dashboard', ...Object.keys(RESOURCES), 'Reports', 'AI Assistant'];
  return <div className="app"><nav><div className="brand">{CLINIC_NAME}</div>{tabs.map(t => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
    <button className="out" onClick={() => { localStorage.clear(); setAuthed(false); }}>Sign out</button></nav>
    <main><p className="muted">Welcome back, {localStorage.name}</p>
      {tab === 'Dashboard' && s && <Dashboard s={s} />}{tab === 'Reports' && s && <Reports s={s} />}{tab === 'AI Assistant' && <Assistant />}
      {RESOURCES[tab] && <Resource key={tab} title={tab} {...RESOURCES[tab]} />}</main></div>;
}
