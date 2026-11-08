const mongoose = require('mongoose');
const M = (n, d) => mongoose.model(n, new mongoose.Schema(d, { timestamps: true }));
module.exports = {
  User: M('User', {
    name: String, email: { type: String, unique: true }, password: String,
    role: { type: String, enum: ['doctor', 'patient'], default: 'doctor' },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  }),
  Patient: M('Patient', {
    name: String, age: Number, phone: String, healthIssues: String, history: String,
    appointmentRemindersEnabled: { type: Boolean, default: false },
  }),
  Visit: M('Visit', {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    date: { type: String, required: true }, reason: String,
    prescription: String, prescriptionPdf: String, prescriptionFilename: String, notes: String,
  }),
  Appointment: M('Appointment', {
    patient: String, patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    date: String, time: String, type: String, status: { type: String, default: 'Scheduled' },
  }),
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
