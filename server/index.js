require('dotenv').config();
const express = require('express'), cors = require('cors'), mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const { User, Patient, Appointment, Treatment, Invoice, Item } = require('./models');
const app = express(); app.use(cors(), express.json());
const SECRET = process.env.JWT_SECRET || 'dev-secret';

const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in again.' }); }
};
app.post('/api/auth/login', async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) return res.status(400).json({ error: 'Wrong email or password.' });
  res.json({ token: jwt.sign({ id: u._id, name: u.name }, SECRET, { expiresIn: '8h' }), name: u.name });
});

const crud = (path, Model, sort = { createdAt: -1 }) => {
  app.get(`/api/${path}`, auth, async (_, res) => res.json(await Model.find().sort(sort)));
  app.post(`/api/${path}`, auth, async (req, res) => res.json(await Model.create(req.body)));
  app.put(`/api/${path}/:id`, auth, async (req, res) => res.json(await Model.findByIdAndUpdate(req.params.id, req.body, { new: true })));
  app.delete(`/api/${path}/:id`, auth, async (req, res) => { await Model.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
};
crud('patients', Patient); crud('appointments', Appointment, { date: 1, time: 1 });
crud('treatments', Treatment); crud('invoices', Invoice); crud('inventory', Item, { name: 1 });

async function stats() {
  const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
  const [patients, appts, treatments, invoices, items] = await Promise.all([
    Patient.countDocuments(), Appointment.find().sort({ date: 1, time: 1 }), Treatment.find(), Invoice.find(), Item.find()]);
  const paid = invoices.filter(i => i.status === 'Paid');
  const byMonth = {}; paid.forEach(i => { const m = (i.date || '').slice(0, 7); byMonth[m] = (byMonth[m] || 0) + i.amount; });
  const byProc = {}; treatments.forEach(t => { byProc[t.procedure] = (byProc[t.procedure] || 0) + 1; });
  return {
    patients, todayAppointments: appts.filter(a => a.date === today).length,
    pendingTreatments: treatments.filter(t => t.status === 'Pending').length,
    monthlyRevenue: paid.filter(i => (i.date || '').startsWith(month)).reduce((s, i) => s + i.amount, 0),
    unpaidTotal: invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0),
    upcoming: appts.filter(a => a.date >= today && a.status !== 'Cancelled').slice(0, 5),
    revenueByMonth: Object.entries(byMonth).sort().slice(-6), treatmentMix: byProc,
    lowStock: items.filter(i => i.qty <= i.minQty).map(i => `${i.name} (${i.qty} left)`),
  };
}
app.get('/api/stats', auth, async (_, res) => res.json(await stats()));

app.post('/api/ai', auth, async (req, res) => {
  const s = await stats(), q = (req.body.q || '').toLowerCase();
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400,
          system: 'You are a dental clinic assistant. Answer briefly using this live clinic data: ' + JSON.stringify(s),
          messages: [{ role: 'user', content: req.body.q }] }) });
      const d = await r.json(); if (d.content) return res.json({ answer: d.content[0].text });
    } catch {}
  }
  let a = `You have ${s.todayAppointments} appointments today, ${s.pendingTreatments} pending treatments and ${s.patients} patients.`;
  if (/stock|inventory|suppl/.test(q)) a = s.lowStock.length ? 'Reorder soon: ' + s.lowStock.join(', ') + '.' : 'All supplies are well stocked.';
  else if (/revenue|money|income|bill|unpaid/.test(q)) a = `This month's revenue is ₹${s.monthlyRevenue.toLocaleString('en-IN')}. Unpaid invoices total ₹${s.unpaidTotal.toLocaleString('en-IN')}; consider sending reminders.`;
  else if (/next|upcoming|schedule|appointment/.test(q)) a = s.upcoming.length ? 'Next up: ' + s.upcoming.map(x => `${x.patient} (${x.date} ${x.time}, ${x.type})`).join('; ') : 'No upcoming appointments.';
  else if (/pending|treatment/.test(q)) a = `${s.pendingTreatments} treatments are pending. Follow up with those patients to book their next visit.`;
  res.json({ answer: a });
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dentalsaas').then(() =>
  app.listen(process.env.PORT || 5000, () => console.log('API running on port ' + (process.env.PORT || 5000))));
