const mongoose = require('mongoose');
const M = (n, d) => mongoose.model(n, new mongoose.Schema(d, { timestamps: true }));
module.exports = {
  User: M('User', { name: String, email: { type: String, unique: true }, password: String }),
  Patient: M('Patient', { name: String, age: Number, phone: String, history: String }),
  Appointment: M('Appointment', { patient: String, date: String, time: String, type: String, status: { type: String, default: 'Scheduled' } }),
  Treatment: M('Treatment', { patient: String, procedure: String, notes: String, status: { type: String, default: 'Pending' }, followUp: String }),
  Invoice: M('Invoice', { patient: String, date: String, amount: Number, insurance: String, status: { type: String, default: 'Unpaid' } }),
  Item: M('Item', { name: String, qty: Number, minQty: { type: Number, default: 10 } }),
};
