require('dotenv').config();
const mongoose = require('mongoose'), bcrypt = require('bcryptjs');
const { User, Patient, Appointment, Treatment, Invoice, Item } = require('./models');
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dentalsaas');
  await Promise.all([User, Patient, Appointment, Treatment, Invoice, Item].map(m => m.deleteMany()));
  await User.create({ name: 'Dr. S. Mehta', email: 'dr.smith@dentalsaas.com', password: await bcrypt.hash('smile123', 10) });
  const names = ['Aarav Nair', 'Diya Kapoor', 'Rohan Mehta', 'Ananya Iyer'];
  await Patient.insertMany(names.map((name, i) => ({ name, age: 22 + i * 9, phone: '98' + (10000000 + i * 1234567), history: 'No known allergies' })));
  const types = ['Routine Check-up', 'Teeth Cleaning', 'Tooth Filling', 'Orthodontic Consultation'], times = ['09:00', '10:30', '12:00', '14:00'];
  await Appointment.insertMany(names.map((patient, i) => ({ patient, date: d(i > 1 ? i - 1 : 0), time: times[i], type: types[i], status: i % 2 === 0 ? 'Booked' : 'Confirmed' })));
  const procs = ['Teeth Cleaning', 'Tooth Filling', 'Root Canal', 'Wisdom Tooth Extraction', 'Teeth Whitening', 'Crown Consultation'];
  await Treatment.insertMany(procs.map((procedure, i) => ({ patient: names[i % 4], procedure, notes: 'Routine Indian dental care plan', status: i % 3 ? 'Done' : 'Pending', followUp: d(14) })));
  const insurers = ['Star Health', 'Care Health', 'Max Bupa', 'ICICI Lombard', 'Self Pay'];
  await Invoice.insertMany([0, 1, 2, 3, 4, 5].map(i => ({ patient: names[i % 4], date: d(-i * 20), amount: 1800 + i * 2600, insurance: insurers[i % insurers.length], status: i === 1 ? 'Unpaid' : 'Paid' })));
  await Item.insertMany([['Nitrile gloves (box)', 36], ['Local anesthetic cartridges', 7], ['Composite resin', 16], ['Surgical masks (box)', 9]].map(([name, qty]) => ({ name, qty, minQty: 10 })));
  console.log('Seeded Indian clinic data. Login: dr.smith@dentalsaas.com / smile123'); process.exit();
})();
