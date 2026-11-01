require('dotenv').config();
const express = require('express'), cors = require('cors'), mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const { User, Patient, Visit, Appointment, Treatment, Invoice, Item } = require('./models');
const app = express(); app.use(cors(), express.json({ limit: '10mb' }));
const SECRET = process.env.JWT_SECRET || 'dev-secret';
const validPhone = phone => phone === undefined || phone === null || phone === '' || (typeof phone === 'string' && /^\d{10}$/.test(phone));

const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in again.' }); }
};
const requireDoctor = (req, res, next) => {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Doctor or staff access is required.' });
  next();
};
const createTokenResponse = user => ({
  token: jwt.sign({
    id: user._id, name: user.name, role: user.role,
    ...(user.patientId ? { patientId: user.patientId } : {}),
  }, SECRET, { expiresIn: '8h' }),
  name: user.name, role: user.role, patientId: user.patientId || null,
});
app.post('/api/auth/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const u = await User.findOne({ email });
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) return res.status(400).json({ error: 'Wrong email or password.' });
  res.json(createTokenResponse(u));
});
app.post('/api/auth/patient/register', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!name || !email || !phone || !password) return res.status(400).json({ error: 'Name, email, phone, and password are required.' });
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Phone number must contain exactly 10 digits.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });

  let patient;
  try {
    patient = await Patient.create({ name, phone, history: '' });
    const user = await User.create({
      name, email, password: await bcrypt.hash(password, 10), role: 'patient', patientId: patient._id,
    });
    res.status(201).json(createTokenResponse(user));
  } catch (error) {
    if (patient) await Patient.findByIdAndDelete(patient._id);
    if (error.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
    console.error('Patient registration failed:', error.message);
    res.status(500).json({ error: 'Could not create the patient account. Please try again.' });
  }
});

const crud = (path, Model, sort = { createdAt: -1 }) => {
  app.get(`/api/${path}`, auth, requireDoctor, async (_, res) => res.json(await Model.find().sort(sort)));
  app.post(`/api/${path}`, auth, requireDoctor, async (req, res) => {
    if (path === 'patients' && !validPhone(req.body.phone)) return res.status(400).json({ error: 'Phone number must contain exactly 10 digits.' });
    res.json(await Model.create(req.body));
  });
  app.put(`/api/${path}/:id`, auth, requireDoctor, async (req, res) => {
    if (path === 'patients' && !validPhone(req.body.phone)) return res.status(400).json({ error: 'Phone number must contain exactly 10 digits.' });
    const updated = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Record not found.' });
    res.json(updated);
  });
  app.delete(`/api/${path}/:id`, auth, requireDoctor, async (req, res) => { await Model.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
};
crud('patients', Patient); crud('appointments', Appointment, { date: 1, time: 1 });
crud('treatments', Treatment); crud('invoices', Invoice); crud('inventory', Item, { name: 1 });

app.get('/api/patients/:id/visits', auth, requireDoctor, async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  res.json(await Visit.find({ patient: patient._id }).sort({ date: -1, createdAt: -1 }));
});
app.post('/api/patients/:id/visits', auth, requireDoctor, async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  if (!req.body.date) return res.status(400).json({ error: 'Visit date is required.' });
  res.status(201).json(await Visit.create({
    patient: patient._id, date: req.body.date, reason: req.body.reason || '',
    prescription: req.body.prescription || '', prescriptionPdf: req.body.prescriptionPdf || '',
    prescriptionFilename: req.body.prescriptionFilename || '', notes: req.body.notes || '',
  }));
});
app.put('/api/patients/:id/visits/:visitId', auth, requireDoctor, async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  if (!req.body.date) return res.status(400).json({ error: 'Visit date is required.' });
  const visit = await Visit.findOneAndUpdate(
    { _id: req.params.visitId, patient: patient._id },
    {
      $set: {
        date: req.body.date, reason: req.body.reason || '',
        prescription: req.body.prescription || '', prescriptionPdf: req.body.prescriptionPdf || '',
        prescriptionFilename: req.body.prescriptionFilename || '', notes: req.body.notes || '',
      },
    },
    { new: true, runValidators: true },
  );
  if (!visit) return res.status(404).json({ error: 'Visit record not found.' });
  res.json(visit);
});
app.get('/api/patient/appointments', auth, async (req, res) => {
  if (req.user.role !== 'patient' || !req.user.patientId) return res.status(403).json({ error: 'Patient account access is required.' });
  const patient = await Patient.findById(req.user.patientId);
  if (!patient) return res.status(404).json({ error: 'Patient profile was not found.' });
  const uniqueName = await Patient.countDocuments({ name: patient.name }) === 1;
  const ownership = [{ patientId: patient._id }];
  if (uniqueName) ownership.push({ patient: patient.name, patientId: { $exists: false } });
  res.json(await Appointment.find({ $or: ownership }).sort({ date: 1, time: 1 }));
});
app.patch('/api/patient/appointments/:id', auth, async (req, res) => {
  if (req.user.role !== 'patient' || !req.user.patientId) return res.status(403).json({ error: 'Patient account access is required.' });
  const patient = await Patient.findById(req.user.patientId);
  if (!patient) return res.status(404).json({ error: 'Patient profile was not found.' });
  const ownership = [{ patientId: patient._id }];
  if (await Patient.countDocuments({ name: patient.name }) === 1) ownership.push({ patient: patient.name, patientId: { $exists: false } });
  const appointment = await Appointment.findOne({ _id: req.params.id, $or: ownership });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
  if (!['Booked', 'Confirmed'].includes(appointment.status || 'Booked')) {
    return res.status(400).json({ error: 'This appointment can no longer be changed.' });
  }
  const todayInIndia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  if (appointment.date < todayInIndia) return res.status(400).json({ error: 'Past appointments can no longer be changed.' });
  if (req.body.action === 'cancel') {
    appointment.status = 'Cancelled';
    await appointment.save();
    return res.json(appointment);
  }
  const { date, time } = req.body;
  const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: 'Choose a valid appointment date.' });
  }
  if (date < todayInIndia) return res.status(400).json({ error: 'Appointment date cannot be in the past.' });
  if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ error: 'Choose a valid appointment time.' });
  appointment.date = date;
  appointment.time = time;
  appointment.status = 'Booked';
  await appointment.save();
  res.json(appointment);
});
app.post('/api/patient/appointments', auth, async (req, res) => {
  if (req.user.role !== 'patient' || !req.user.patientId) return res.status(403).json({ error: 'Patient account access is required.' });
  const { date, time, type } = req.body;
  const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: 'Choose a valid appointment date.' });
  }
  const todayInIndia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  if (date < todayInIndia) return res.status(400).json({ error: 'Appointment date cannot be in the past.' });
  if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ error: 'Choose a valid appointment time.' });
  if (typeof type !== 'string' || !type.trim()) return res.status(400).json({ error: 'Choose an appointment reason.' });
  const patient = await Patient.findById(req.user.patientId);
  if (!patient) return res.status(404).json({ error: 'Patient profile was not found.' });
  const appointment = await Appointment.create({
    patient: patient.name, patientId: patient._id, date, time, type: type.trim(), status: 'Booked',
  });
  res.status(201).json(appointment);
});
app.get('/api/patient/records', auth, async (req, res) => {
  if (req.user.role !== 'patient' || !req.user.patientId) return res.status(403).json({ error: 'Patient account access is required.' });
  const patient = await Patient.findById(req.user.patientId);
  if (!patient) return res.status(404).json({ error: 'Patient profile was not found.' });
  const uniqueName = await Patient.countDocuments({ name: patient.name }) === 1;
  const legacyRecordFilter = uniqueName ? [{ patient: patient.name, patientId: { $exists: false } }] : [];
  const [visits, treatments, invoices] = await Promise.all([
    Visit.find({ patient: patient._id }).sort({ date: -1, createdAt: -1 }),
    Treatment.find({ $or: [{ patientId: patient._id }, ...legacyRecordFilter] }).sort({ createdAt: -1 }),
    Invoice.find({ $or: [{ patientId: patient._id }, ...legacyRecordFilter] }).sort({ date: -1, createdAt: -1 }),
  ]);
  res.json({ visits, treatments, invoices });
});

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
app.get('/api/stats', auth, requireDoctor, async (_, res) => res.json(await stats()));

app.post('/api/ai', auth, requireDoctor, async (req, res) => {
  const question = typeof req.body.q === 'string' ? req.body.q.trim() : '';
  if (!question) return res.status(400).json({ error: 'Enter a question for the assistant.' });
  const s = await stats(), q = question.toLowerCase();
  const isClinicDataQuestion =
    (/patient/.test(q) && /how many|number|count|total|clinic records/.test(q)) ||
    (/appointment|schedule/.test(q) && /today|upcoming|next|how many|clinic/.test(q)) ||
    /unpaid|outstanding|balance|revenue|income|money|earnings|stock|inventory|suppl/.test(q) ||
    (/treatment/.test(q) && /pending|how many|clinic/.test(q));
  let a = `There are ${s.patients} patients, ${s.todayAppointments} appointments today, and ${s.pendingTreatments} pending treatments.`;
  if (/how many|number|count|total/.test(q) && /patient/.test(q)) a = `There are ${s.patients} patients in the clinic records.`;
  else if (/today/.test(q) && /appointment|schedule/.test(q)) a = `There are ${s.todayAppointments} appointments scheduled for today.`;
  else if (/unpaid|outstanding|balance/.test(q)) a = `Unpaid invoices total ₹${s.unpaidTotal.toLocaleString('en-IN')}.`;
  else if (/revenue|income|money|earnings/.test(q)) a = `This month's paid invoice revenue is ₹${s.monthlyRevenue.toLocaleString('en-IN')}.`;
  else if (/stock|inventory|suppl/.test(q)) a = s.lowStock.length ? 'Reorder soon: ' + s.lowStock.join(', ') + '.' : 'All supplies are well stocked.';
  else if (/pending|treatment/.test(q)) a = `${s.pendingTreatments} treatments are pending. Review the patient records and follow up as appropriate.`;
  else if (/next|upcoming|schedule|appointment/.test(q)) a = s.upcoming.length ? 'Upcoming appointments: ' + s.upcoming.map(x => `${x.patient} (${x.date} ${x.time}, ${x.type})`).join('; ') : 'No upcoming appointments.';
  else if (/brush|brushing/.test(q)) a = 'A common oral-health recommendation is to brush twice a day for about two minutes with a fluoride toothpaste and a soft-bristled brush. Individual needs can differ, so follow your dentist’s advice.';
  else if (/floss|between teeth|interdental/.test(q)) a = 'Cleaning between teeth once a day with floss or an appropriate interdental cleaner can help remove plaque where a toothbrush may not reach. Ask a dentist to demonstrate the right technique.';
  else if (/check.?up|dental visit|dentist visit|how often.*dentist/.test(q)) a = 'Routine dental check-up frequency depends on a person’s oral health and risk factors. A dentist can recommend an appropriate interval after an examination.';
  else if (/toothache|tooth pain|severe pain|swelling|knocked.*tooth|dental emergency/.test(q)) a = 'I can’t assess an individual dental problem here. Contact a dentist promptly for advice; facial swelling, trauma, uncontrolled bleeding, or difficulty breathing or swallowing needs urgent professional care.';
  else if (/care.*teeth|oral hygiene|healthy teeth/.test(q)) a = 'General oral-health basics include brushing twice daily with fluoride toothpaste, cleaning between teeth daily, limiting frequent sugary snacks and drinks, and attending dental check-ups as recommended. This is general education, not a diagnosis.';
  else a = '';

  if (isClinicDataQuestion || !process.env.GEMINI_API_KEY) {
    return res.json({ answer: a || 'Add a Gemini API key to enable broader general-knowledge answers.' });
  }

  {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
          store: false,
          system_instruction: 'You are a dental clinic assistant. Answer general questions clearly and briefly. You do not have access to clinic records. Do not diagnose, prescribe medicines, or present general guidance as a substitute for a dental examination. Recommend a dentist for patient-specific symptoms, and urgent professional care for severe swelling, uncontrolled bleeding, facial trauma, or difficulty breathing or swallowing. Do not ask users to provide identifying patient information.',
          input: question,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        console.error('Gemini API request failed with status:', r.status);
        return res.status(502).json({ error: 'Gemini could not answer. Check the API key, model, and available quota.' });
      }
      const answer = d.output_text || (Array.isArray(d.steps)
        ? d.steps.filter(step => step.type === 'model_output')
          .flatMap(step => Array.isArray(step.content) ? step.content : [])
          .filter(part => part.type === 'text')
          .map(part => part.text || '')
          .join('')
        : '');
      if (!answer) {
        console.error('Gemini API response did not contain a text answer.');
        return res.status(502).json({ error: 'Gemini returned no text answer. Please try again.' });
      }
      return res.json({ answer });
    } catch (error) {
      console.error('Gemini API request failed:', error.message);
      return res.status(502).json({ error: 'Gemini is temporarily unavailable. Please try again.' });
    }
  }
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dentalsaas').then(() =>
  app.listen(process.env.PORT || 5000, () => console.log('API running on port ' + (process.env.PORT || 5000))));
