require('dotenv').config();
const mongoose = require('mongoose'), bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const { Branch, User, Patient, Visit, Appointment, Treatment, Invoice, Item } = require('./models');
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dentalsaas');
  await Promise.all([Branch, User, Patient, Visit, Appointment, Treatment, Invoice, Item].map(m => m.deleteMany()));
  const rohiniBranch = await Branch.create({ name: 'Rohini' });
  const pitampuraBranch = await Branch.create({ name: 'Pitampura' });
  await User.create({ name: 'Dr. S. Mehta', email: 'dr.smith@dentalsaas.com', password: await bcrypt.hash('smile123', 10), role: 'doctor' });
  const branchDoctors = [
    { name: 'Dr Sameer', email: 'sameer@gmail.com', branchId: rohiniBranch._id, temporaryPassword: randomBytes(9).toString('hex') },
    { name: 'Dr Aarav', email: 'aarav@gmail.com', branchId: pitampuraBranch._id, temporaryPassword: randomBytes(9).toString('hex') },
  ];
  await Promise.all(branchDoctors.map(async doctor => User.create({
    name: doctor.name, email: doctor.email, branchId: doctor.branchId,
    password: await bcrypt.hash(doctor.temporaryPassword, 10), role: 'doctor',
  })));
  const names = ['Aarav Nair', 'Diya Kapoor', 'Rohan Mehta', 'Ananya Iyer'];
  const patients = await Patient.insertMany(names.map((name, i) => ({ name, age: 22 + i * 9, phone: '98' + (10000000 + i * 1234567), history: 'No known allergies' })));
  await User.create({
    name: patients[0].name, email: 'aarav.patient@dentalsaas.com',
    password: await bcrypt.hash('patient123', 10), role: 'patient', patientId: patients[0]._id,
  });
  await Visit.insertMany([
    { patient: patients[0]._id, date: d(-90), reason: 'Routine dental check-up', prescription: 'Chlorhexidine mouthwash, use as directed.', notes: 'Routine examination. Advised twice-daily brushing and six-month follow-up.' },
    { patient: patients[0]._id, date: d(-30), reason: 'Sensitivity consultation', prescription: 'Desensitising toothpaste, twice daily for two weeks.', notes: 'Mild sensitivity reported. Review if symptoms continue.' },
    { patient: patients[1]._id, date: d(-60), reason: 'Teeth cleaning', prescription: 'No medication prescribed.', notes: 'Scaling completed. Oral hygiene instructions provided.' },
  ]);
  const types = ['Routine Check-up', 'Teeth Cleaning', 'Tooth Filling', 'Orthodontic Consultation'], times = ['09:00', '10:30', '12:00', '14:00'];
  await Appointment.insertMany(names.map((patient, i) => ({
    patient, patientId: patients[i]._id, branchId: i % 2 === 0 ? rohiniBranch._id : pitampuraBranch._id,
    date: d(i > 1 ? i - 1 : 0), time: times[i], type: types[i], status: i % 2 === 0 ? 'Booked' : 'Confirmed',
  })));
  const procs = ['Teeth Cleaning', 'Tooth Filling', 'Root Canal', 'Wisdom Tooth Extraction', 'Teeth Whitening', 'Crown Consultation'];
  await Treatment.insertMany(procs.map((procedure, i) => ({ patient: names[i % 4], patientId: patients[i % patients.length]._id, procedure, notes: 'Routine Indian dental care plan', status: i % 3 ? 'Done' : 'Pending', followUp: d(14) })));
  const insurers = ['Star Health', 'Care Health', 'Max Bupa', 'ICICI Lombard', 'Self Pay'];
  await Invoice.insertMany([0, 1, 2, 3, 4, 5].map(i => ({ patient: names[i % 4], patientId: patients[i % patients.length]._id, date: d(-i * 20), amount: 1800 + i * 2600, insurance: insurers[i % insurers.length], status: i === 1 ? 'Unpaid' : 'Paid' })));
  await Item.insertMany([['Nitrile gloves (box)', 36], ['Local anesthetic cartridges', 7], ['Composite resin', 16], ['Surgical masks (box)', 9]].map(([name, qty]) => ({ name, qty, minQty: 10 })));
  console.log('Seeded Indian clinic data.');
  console.log('Clinic admin: dr.smith@dentalsaas.com / smile123');
  for (const doctor of branchDoctors) {
    console.log(`${doctor.name} (${doctor.email}) temporary password: ${doctor.temporaryPassword}`);
  }
  await mongoose.disconnect();
})();
