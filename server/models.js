const mongoose = require('mongoose');
const M = (n, d) => mongoose.model(n, new mongoose.Schema(d, { timestamps: true }));
const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
const Branch = mongoose.model('Branch', branchSchema);
const patientInvitationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  email: { type: String, required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
patientInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const PatientInvitation = mongoose.model('PatientInvitation', patientInvitationSchema);
const appointmentSchema = new mongoose.Schema({
  patient: String, patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  date: String, time: String, type: String, status: { type: String, default: 'Scheduled' },
}, { timestamps: true });
appointmentSchema.index(
  { branchId: 1, date: 1, time: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['Booked', 'Confirmed', 'Scheduled'] } } },
);
const Appointment = mongoose.model('Appointment', appointmentSchema);
module.exports = {
  Branch,
  User: M('User', {
    name: String, email: { type: String, unique: true }, password: String,
    role: { type: String, enum: ['doctor', 'patient'], default: 'doctor' },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  }),
  Patient: M('Patient', {
    name: String, age: Number, phone: String, email: String, healthIssues: String, history: String,
    appointmentRemindersEnabled: { type: Boolean, default: false },
  }),
  PatientInvitation,
  Visit: M('Visit', {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    date: { type: String, required: true }, reason: String,
    prescription: String, prescriptionPdf: String, prescriptionFilename: String, notes: String,
  }),
  Appointment,
  Treatment: M('Treatment', {
    patient: String, patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    procedure: String, notes: String, status: { type: String, default: 'Pending' }, followUp: String,
  }),
  Invoice: M('Invoice', {
    patient: String, patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    date: String, description: String,
    lineItems: [{ description: String, quantity: Number, unitPrice: Number, amount: Number }],
    subtotal: Number, gstRate: Number,
    gstAmount: Number, amount: Number, insurance: String, status: { type: String, default: 'Unpaid' },
  }),
  Item: M('Item', { name: String, qty: Number, minQty: { type: Number, default: 10 } }),
};
