require('dotenv').config();
const express = require('express'), cors = require('cors'), mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const { randomBytes, createHash } = require('crypto');
const { Branch, User, Patient, PatientInvitation, Visit, Appointment, Treatment, Invoice, Item } = require('./models');
const app = express(); app.use(cors(), express.json({ limit: '10mb' }));
const SECRET = process.env.JWT_SECRET || 'dev-secret';
const validPhone = phone => phone === undefined || phone === null || phone === '' || (typeof phone === 'string' && /^\d{10}$/.test(phone));
const normalizeEmail = email => typeof email === 'string' ? email.trim().toLowerCase() : '';
const validEmail = email => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const hashInvitationToken = token => createHash('sha256').update(token).digest('hex');
const activeAppointmentStatuses = ['Booked', 'Confirmed', 'Scheduled'];
const appointmentSlotConflict = async (branchId, date, time, excludeId) => {
  const query = { branchId, date, time, status: { $in: activeAppointmentStatuses } };
  if (excludeId) query._id = { $ne: excludeId };
  return Appointment.exists(query);
};
const activeBranch = async branchId => branchId && mongoose.isValidObjectId(branchId)
  ? Branch.findOne({ _id: branchId, isActive: true })
  : null;
const respondWithSlotConflict = res => res.status(409).json({ error: 'That time slot is already booked. Please choose another time.' });
const isDuplicateKeyError = error => error && error.code === 11000;

const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in again.' }); }
};
const requireDoctor = (req, res, next) => {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Doctor or staff access is required.' });
  next();
};
const requireClinicAdmin = (req, res, next) => {
  if (req.user.role !== 'doctor' || req.user.branchId) return res.status(403).json({ error: 'Clinic-wide staff access is required.' });
  next();
};
const createTokenResponse = user => ({
  token: jwt.sign({
    id: user._id, name: user.name, role: user.role,
    ...(user.patientId ? { patientId: user.patientId } : {}),
    ...(user.branchId ? { branchId: user.branchId } : {}),
  }, SECRET, { expiresIn: '8h' }),
  name: user.name, role: user.role, patientId: user.patientId || null, branchId: user.branchId || null,
});
app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const u = await User.findOne({ email });
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) return res.status(400).json({ error: 'Wrong email or password.' });
  res.json(createTokenResponse(u));
});
app.post('/api/auth/change-password', auth, async (req, res) => {
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const user = await User.findById(req.user.id).select('password');
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ ok: true });
});
app.post('/api/auth/patient/activate', async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ error: 'This activation link is invalid or expired. Ask the clinic for a new link.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const invitation = await PatientInvitation.findOne({
    tokenHash: hashInvitationToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!invitation) return res.status(400).json({ error: 'This activation link is invalid or expired. Ask the clinic for a new link.' });
  const patient = await Patient.findOne({ _id: invitation.patientId, email: invitation.email });
  if (!patient) return res.status(400).json({ error: 'This activation link is no longer valid. Ask the clinic for a new link.' });
  try {
    const user = await User.create({
      name: patient.name, email: invitation.email,
      password: await bcrypt.hash(password, 10), role: 'patient', patientId: patient._id,
    });
    await PatientInvitation.deleteMany({ patientId: patient._id });
    res.status(201).json(createTokenResponse(user));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account already uses this email. Please contact the clinic.' });
    throw error;
  }
});
app.post('/api/auth/patient/register', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body.email);
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!name || !email || !phone || !password) return res.status(400).json({ error: 'Name, email, phone, and password are required.' });
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Phone number must contain exactly 10 digits.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });
  if (await Patient.exists({ email })) return res.status(409).json({ error: 'A clinic record already uses this email. Ask the clinic for an activation link to access that record.' });

  let patient;
  try {
    patient = await Patient.create({ name, phone, email, history: '' });
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

app.get('/api/branches', auth, async (req, res) => {
  const filter = req.user.role === 'patient' ? { isActive: true }
    : req.user.branchId ? { _id: req.user.branchId } : {};
  const branches = await Branch.find(filter).sort({ name: 1 });
  if (req.user.role !== 'doctor' || req.user.branchId) return res.json(branches);
  const doctors = await User.find({ role: 'doctor', branchId: { $in: branches.map(branch => branch._id) } })
    .select('name email branchId').lean();
  const doctorsByBranch = new Map();
  for (const doctor of doctors) {
    const key = String(doctor.branchId);
    if (!doctorsByBranch.has(key)) doctorsByBranch.set(key, []);
    doctorsByBranch.get(key).push({ _id: doctor._id, name: doctor.name, email: doctor.email });
  }
  res.json(branches.map(branch => ({
    ...branch.toObject(),
    doctors: doctorsByBranch.get(String(branch._id)) || [],
  })));
});
app.post('/api/branches', auth, requireClinicAdmin, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  if (!name) return res.status(400).json({ error: 'Branch name is required.' });
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Branch phone number must contain exactly 10 digits.' });
  try {
    res.status(201).json(await Branch.create({ name, address, phone }));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A branch with that name already exists.' });
    throw error;
  }
});
app.put('/api/branches/:id', auth, requireClinicAdmin, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  if (!name) return res.status(400).json({ error: 'Branch name is required.' });
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Branch phone number must contain exactly 10 digits.' });
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ error: 'Branch status must be active or inactive.' });
  if (!req.body.isActive && await Branch.countDocuments({ isActive: true, _id: { $ne: req.params.id } }) === 0) {
    return res.status(400).json({ error: 'At least one clinic branch must remain active.' });
  }
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id, { $set: { name, address, phone, isActive: req.body.isActive } },
      { new: true, runValidators: true },
    );
    if (!branch) return res.status(404).json({ error: 'Branch not found.' });
    res.json(branch);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A branch with that name already exists.' });
    throw error;
  }
});
app.post('/api/branches/:id/doctors', auth, requireClinicAdmin, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body.email);
  if (!name) return res.status(400).json({ error: 'Doctor name is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid doctor email address.' });
  const branch = await Branch.findOne({ _id: req.params.id, isActive: true });
  if (!branch) return res.status(404).json({ error: 'Active clinic branch not found.' });
  if (await User.exists({ email }) || await Patient.exists({ email })) {
    return res.status(409).json({ error: 'That email is already used by a patient or account.' });
  }
  const temporaryPassword = randomBytes(9).toString('hex');
  try {
    const doctor = await User.create({
      name, email, password: await bcrypt.hash(temporaryPassword, 10), role: 'doctor', branchId: branch._id,
    });
    res.status(201).json({
      doctor: { _id: doctor._id, name: doctor.name, email: doctor.email, branchId: doctor.branchId },
      temporaryPassword,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account already uses this email.' });
    throw error;
  }
});

const crud = (path, Model, sort = { createdAt: -1 }) => {
  app.get(`/api/${path}`, auth, requireDoctor, async (req, res) => {
    const filter = path === 'appointments' && req.user.branchId ? { branchId: req.user.branchId } : {};
    const rows = await Model.find(filter).sort(sort);
    if (path === 'appointments') {
      const branches = await Branch.find({ _id: { $in: rows.map(appointment => appointment.branchId).filter(Boolean) } }).select('name').lean();
      const branchNames = new Map(branches.map(branch => [String(branch._id), branch.name]));
      return res.json(rows.map(appointment => ({
        ...appointment.toObject(),
        branchName: branchNames.get(String(appointment.branchId)) || 'Unknown branch',
      })));
    }
    if (path !== 'patients') return res.json(rows);
    const linkedUsers = await User.find({ role: 'patient', patientId: { $in: rows.map(patient => patient._id) } }).select('patientId');
    const linkedPatientIds = new Set(linkedUsers.map(user => String(user.patientId)));
    res.json(rows.map(patient => ({ ...patient.toObject(), portalAccount: linkedPatientIds.has(String(patient._id)) })));
  });
  app.post(`/api/${path}`, auth, requireDoctor, async (req, res) => {
    if (path === 'patients' && !validPhone(req.body.phone)) return res.status(400).json({ error: 'Phone number must contain exactly 10 digits.' });
    if (path === 'patients') {
      const email = normalizeEmail(req.body.email);
      if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
      if (email && (await Patient.exists({ email }) || await User.exists({ email }))) return res.status(409).json({ error: 'That email is already used by another patient or account.' });
      req.body.email = email || undefined;
    }
    if (path === 'appointments') {
      const branch = await activeBranch(req.body.branchId);
      if (!branch) return res.status(400).json({ error: 'Choose an active clinic branch.' });
      if (req.user.branchId && String(branch._id) !== String(req.user.branchId)) {
        return res.status(403).json({ error: 'You can only manage appointments at your assigned branch.' });
      }
      if (activeAppointmentStatuses.includes(req.body.status || 'Scheduled')
        && await appointmentSlotConflict(branch._id, req.body.date, req.body.time)) return respondWithSlotConflict(res);
    }
    try {
      res.json(await Model.create(req.body));
    } catch (error) {
      if (path === 'appointments' && isDuplicateKeyError(error)) return respondWithSlotConflict(res);
      throw error;
    }
  });
  app.put(`/api/${path}/:id`, auth, requireDoctor, async (req, res) => {
    if (path === 'patients' && !validPhone(req.body.phone)) return res.status(400).json({ error: 'Phone number must contain exactly 10 digits.' });
    if (path === 'patients') {
      const email = normalizeEmail(req.body.email);
      if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
      if (email && (await Patient.exists({ email, _id: { $ne: req.params.id } }))) {
        return res.status(409).json({ error: 'That email is already used by another patient record.' });
      }
      const linkedUser = await User.findOne({ role: 'patient', patientId: req.params.id });
      const currentPatient = await Patient.findById(req.params.id).select('email');
      if (!currentPatient) return res.status(404).json({ error: 'Record not found.' });
      if (linkedUser && !email) return res.status(400).json({ error: 'A linked patient account must keep an email address.' });
      if (email && await User.exists({ email, ...(linkedUser ? { _id: { $ne: linkedUser._id } } : {}) })) {
        return res.status(409).json({ error: 'That email is already used by another account.' });
      }
      req.body.email = email;
      req.patientEmailChanged = normalizeEmail(currentPatient.email) !== email;
    }
    if (path === 'appointments') {
      const existing = await Appointment.findById(req.params.id).select('branchId');
      if (!existing) return res.status(404).json({ error: 'Record not found.' });
      if (req.user.branchId && String(existing.branchId) !== String(req.user.branchId)) {
        return res.status(404).json({ error: 'Appointment not found.' });
      }
      const branchId = req.body.branchId || existing.branchId;
      const branch = branchId && mongoose.isValidObjectId(branchId)
        ? Branch.findById(branchId)
        : null;
      const selectedBranch = await branch;
      if (req.user.branchId && String(branchId) !== String(req.user.branchId)) {
        return res.status(403).json({ error: 'You can only manage appointments at your assigned branch.' });
      }
      if (!selectedBranch || (String(branchId) !== String(existing.branchId) && !selectedBranch.isActive)) {
        return res.status(400).json({ error: 'Choose an active clinic branch.' });
      }
      if (activeAppointmentStatuses.includes(req.body.status || 'Scheduled')
        && await appointmentSlotConflict(branchId, req.body.date, req.body.time, req.params.id)) return respondWithSlotConflict(res);
      req.body.branchId = branchId;
    }
    let updated;
    try {
      updated = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    } catch (error) {
      if (path === 'appointments' && isDuplicateKeyError(error)) return respondWithSlotConflict(res);
      throw error;
    }
    if (!updated) return res.status(404).json({ error: 'Record not found.' });
    if (path === 'patients' && req.patientEmailChanged) {
      await User.updateOne({ role: 'patient', patientId: updated._id }, { $set: { email: req.body.email } });
      await PatientInvitation.deleteMany({ patientId: updated._id });
    }
    res.json(updated);
  });
  app.delete(`/api/${path}/:id`, auth, requireDoctor, async (req, res) => {
    if (path === 'appointments' && req.user.branchId
      && !await Appointment.exists({ _id: req.params.id, branchId: req.user.branchId })) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    if (path === 'patients' && await User.exists({ role: 'patient', patientId: req.params.id })) {
      return res.status(409).json({ error: 'This patient has a portal account and cannot be deleted while it is linked.' });
    }
    await Model.findByIdAndDelete(req.params.id); res.json({ ok: true });
  });
};
crud('patients', Patient); crud('appointments', Appointment, { date: 1, time: 1 });
crud('treatments', Treatment); crud('invoices', Invoice); crud('inventory', Item, { name: 1 });

app.post('/api/patients/:id/invitation', auth, requireDoctor, async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  if (!patient.email || !validEmail(patient.email)) return res.status(400).json({ error: 'Add a valid patient email before creating an activation link.' });
  if (await User.exists({ role: 'patient', patientId: patient._id })) return res.status(409).json({ error: 'This patient already has portal access.' });
  if (await User.exists({ email: patient.email })) return res.status(409).json({ error: 'This email already belongs to an account. Contact the clinic administrator.' });
  if (await Patient.exists({ email: patient.email, _id: { $ne: patient._id } })) return res.status(409).json({ error: 'This email is also assigned to another patient record.' });
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await PatientInvitation.deleteMany({ patientId: patient._id });
  await PatientInvitation.create({
    patientId: patient._id, email: patient.email, tokenHash: hashInvitationToken(token), expiresAt,
  });
  res.status(201).json({ token, expiresAt });
});

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
  const appointments = await Appointment.find({ $or: ownership }).sort({ date: 1, time: 1 });
  const branches = await Branch.find({ _id: { $in: appointments.map(appointment => appointment.branchId).filter(Boolean) } }).select('name').lean();
  const branchNames = new Map(branches.map(branch => [String(branch._id), branch.name]));
  res.json(appointments.map(appointment => ({
    ...appointment.toObject(),
    branchName: branchNames.get(String(appointment.branchId)) || 'Unknown branch',
  })));
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
  const branchId = req.body.branchId || appointment.branchId;
  const branch = await activeBranch(branchId);
  if (!branch) return res.status(400).json({ error: 'Choose an active clinic branch.' });
  if (await appointmentSlotConflict(branch._id, date, time, appointment._id)) return respondWithSlotConflict(res);
  appointment.date = date;
  appointment.time = time;
  appointment.branchId = branch._id;
  appointment.status = 'Booked';
  try {
    await appointment.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) return respondWithSlotConflict(res);
    throw error;
  }
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
  const branch = await activeBranch(req.body.branchId);
  if (!branch) return res.status(400).json({ error: 'Choose an active clinic branch.' });
  if (await appointmentSlotConflict(branch._id, date, time)) return respondWithSlotConflict(res);
  let appointment;
  try {
    appointment = await Appointment.create({
      patient: patient.name, patientId: patient._id, branchId: branch._id, date, time, type: type.trim(), status: 'Booked',
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return respondWithSlotConflict(res);
    throw error;
  }
  res.status(201).json(appointment);
});
app.get('/api/patient/preferences', auth, async (req, res) => {
  if (req.user.role !== 'patient' || !req.user.patientId) return res.status(403).json({ error: 'Patient account access is required.' });
  const patient = await Patient.findById(req.user.patientId);
  if (!patient) return res.status(404).json({ error: 'Patient profile was not found.' });
  res.json({ appointmentRemindersEnabled: Boolean(patient.appointmentRemindersEnabled) });
});
app.put('/api/patient/preferences', auth, async (req, res) => {
  if (req.user.role !== 'patient' || !req.user.patientId) return res.status(403).json({ error: 'Patient account access is required.' });
  if (typeof req.body.appointmentRemindersEnabled !== 'boolean') {
    return res.status(400).json({ error: 'Choose whether appointment reminders should be enabled.' });
  }
  const patient = await Patient.findByIdAndUpdate(
    req.user.patientId,
    { $set: { appointmentRemindersEnabled: req.body.appointmentRemindersEnabled } },
    { new: true, runValidators: true },
  );
  if (!patient) return res.status(404).json({ error: 'Patient profile was not found.' });
  res.json({ appointmentRemindersEnabled: Boolean(patient.appointmentRemindersEnabled) });
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

async function stats(branchId) {
  const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
  const [patients, appts, treatments, invoices, items, branches] = await Promise.all([
    Patient.countDocuments(), Appointment.find(branchId ? { branchId } : {}).sort({ date: 1, time: 1 }), Treatment.find(), Invoice.find(), Item.find(), Branch.find().select('name').lean()]);
  const branchNames = new Map(branches.map(branch => [String(branch._id), branch.name]));
  const paid = invoices.filter(i => i.status === 'Paid');
  const byMonth = {}; paid.forEach(i => { const m = (i.date || '').slice(0, 7); byMonth[m] = (byMonth[m] || 0) + i.amount; });
  const byProc = {}; treatments.forEach(t => { byProc[t.procedure] = (byProc[t.procedure] || 0) + 1; });
  return {
    patients, todayAppointments: appts.filter(a => a.date === today).length,
    pendingTreatments: treatments.filter(t => t.status === 'Pending').length,
    monthlyRevenue: paid.filter(i => (i.date || '').startsWith(month)).reduce((s, i) => s + i.amount, 0),
    unpaidTotal: invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0),
    upcoming: appts.filter(a => a.date >= today && a.status !== 'Cancelled').slice(0, 5)
      .map(appointment => ({ ...appointment.toObject(), branchName: branchNames.get(String(appointment.branchId)) || 'Unknown branch' })),
    revenueByMonth: Object.entries(byMonth).sort().slice(-6), treatmentMix: byProc,
    lowStock: items.filter(i => i.qty <= i.minQty).map(i => `${i.name} (${i.qty} left)`),
  };
}
app.get('/api/stats', auth, requireDoctor, async (req, res) => res.json(await stats(req.user.branchId)));

app.post('/api/ai', auth, requireDoctor, async (req, res) => {
  const question = typeof req.body.q === 'string' ? req.body.q.trim() : '';
  if (!question) return res.status(400).json({ error: 'Enter a question for the assistant.' });
  const s = await stats(req.user.branchId), q = question.toLowerCase();
  const isFollowUpQuestion = /follow[\s-]?ups?/.test(q) && /(patient|who|which|due|upcoming|overdue|have|has|list)/.test(q);
  if (isFollowUpQuestion) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const asksThisWeek = /this week|this week's|next 7 days/.test(q);
    let followUpFilter = {
      followUp: { $exists: true, $nin: ['', null] },
      status: { $not: /^(done|completed|cancelled)$/i },
    };
    let periodLabel = '';
    if (asksThisWeek) {
      const todayUtc = new Date(`${today}T00:00:00Z`);
      const daysUntilSunday = (7 - todayUtc.getUTCDay()) % 7;
      const weekEnd = new Date(todayUtc);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + daysUntilSunday);
      const weekEndValue = weekEnd.toISOString().slice(0, 10);
      followUpFilter = {
        ...followUpFilter,
        followUp: { $gte: today, $lte: weekEndValue },
      };
      periodLabel = ` scheduled from ${today} through ${weekEndValue}`;
    }
    const followUps = await Treatment.find({
      ...followUpFilter,
    }).sort({ followUp: 1 }).lean();
    const patientIds = followUps.map(treatment => treatment.patientId).filter(Boolean);
    const patients = await Patient.find({ _id: { $in: patientIds } }).select('_id name').lean();
    const patientNames = new Map(patients.map(patient => [String(patient._id), patient.name]));
    const entries = followUps.map(treatment => {
      const name = (treatment.patientId && patientNames.get(String(treatment.patientId))) || treatment.patient || 'Unknown patient';
      const timing = /^\d{4}-\d{2}-\d{2}$/.test(treatment.followUp) && treatment.followUp < today ? 'overdue' : 'due';
      const details = [treatment.followUp, treatment.procedure, timing === 'overdue' ? 'overdue' : 'upcoming'].filter(Boolean).join(', ');
      return `${name} (${details})`;
    });
    return res.json({
      answer: entries.length
        ? `Patients with active follow-ups${periodLabel}: ${entries.join('; ')}.`
        : asksThisWeek ? `There are no active follow-ups${periodLabel}.` : 'There are no active follow-ups recorded.',
    });
  }
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

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dentalsaas').then(async () => {
  const linkedAccounts = await User.find({ role: 'patient', patientId: { $exists: true, $ne: null } }).select('email patientId').lean();
  await Promise.all(linkedAccounts.map(account => Patient.updateOne(
    { _id: account.patientId },
    { $set: { email: account.email } },
  )));
  let defaultBranch = await Branch.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!defaultBranch) defaultBranch = await Branch.create({ name: 'Main Branch' });
  await Appointment.updateMany(
    { $or: [{ branchId: { $exists: false } }, { branchId: null }] },
    { $set: { branchId: defaultBranch._id } },
  );
  const appointmentIndexes = await Appointment.collection.indexes();
  if (appointmentIndexes.some(index => index.name === 'date_1_time_1')) {
    await Appointment.collection.dropIndex('date_1_time_1');
  }
  await Appointment.collection.createIndex(
    { branchId: 1, date: 1, time: 1 },
    { name: 'branchId_1_date_1_time_1', unique: true, partialFilterExpression: { status: { $in: activeAppointmentStatuses } } },
  );
  app.listen(process.env.PORT || 5000, () => console.log('API running on port ' + (process.env.PORT || 5000)));
}).catch(error => {
  console.error('Could not connect to MongoDB or initialize patient accounts:', error.message);
  process.exitCode = 1;
});
