const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db', 'hospital.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB helpers ────────────────────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const init = { rdv: [], dossiers_medicaux: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ─── ROUTES: rdv ───────────────────────────────────────────────────────────────

// GET all appointments (optionally filter by patient_id)
app.get('/api/rdv', (req, res) => {
  const db = readDB();
  const { patient_id } = req.query;
  const list = patient_id
    ? db.rdv.filter(r => String(r.patient_id) === String(patient_id))
    : db.rdv;
  res.json(list);
});

// GET single appointment
app.get('/api/rdv/:id', (req, res) => {
  const db = readDB();
  const rdv = db.rdv.find(r => r.id === req.params.id);
  if (!rdv) return res.status(404).json({ error: 'Appointment not found' });
  res.json(rdv);
});

// POST create appointment
app.post('/api/rdv', (req, res) => {
  const { patient_id, patient_name, doctor, specialty, date, time, notes } = req.body;
  if (!patient_id || !patient_name || !doctor || !date || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const db = readDB();

  // Check for conflicts
  const conflict = db.rdv.find(r => r.doctor === doctor && r.date === date && r.time === time && r.status !== 'cancelled');
  if (conflict) return res.status(409).json({ error: 'Time slot already booked for this doctor' });

  const newRdv = {
    id: `rdv_${Date.now()}`,
    patient_id,
    patient_name,
    doctor,
    specialty: specialty || '',
    date,
    time,
    notes: notes || '',
    status: 'confirmed',
    created_at: new Date().toISOString()
  };
  db.rdv.push(newRdv);
  writeDB(db);
  res.status(201).json(newRdv);
});

// PATCH update appointment status
app.patch('/api/rdv/:id', (req, res) => {
  const db = readDB();
  const idx = db.rdv.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Appointment not found' });
  db.rdv[idx] = { ...db.rdv[idx], ...req.body, id: db.rdv[idx].id };
  writeDB(db);
  res.json(db.rdv[idx]);
});

// DELETE appointment
app.delete('/api/rdv/:id', (req, res) => {
  const db = readDB();
  const idx = db.rdv.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Appointment not found' });
  db.rdv[idx].status = 'cancelled';
  writeDB(db);
  res.json({ success: true });
});

// ─── ROUTES: dossiers_medicaux ─────────────────────────────────────────────────

// GET all medical records (optionally filter by patient_id)
app.get('/api/dossiers_medicaux', (req, res) => {
  const db = readDB();
  const { patient_id } = req.query;
  const list = patient_id
    ? db.dossiers_medicaux.filter(d => String(d.patient_id) === String(patient_id))
    : db.dossiers_medicaux;
  res.json(list);
});

// GET single record
app.get('/api/dossiers_medicaux/:id', (req, res) => {
  const db = readDB();
  const record = db.dossiers_medicaux.find(d => d.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  res.json(record);
});

// POST create medical record
app.post('/api/dossiers_medicaux', (req, res) => {
  const { patient_id, patient_name, type, doctor, description, date, attachments } = req.body;
  if (!patient_id || !patient_name || !type || !doctor || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const db = readDB();
  const newRecord = {
    id: `dm_${Date.now()}`,
    patient_id,
    patient_name,
    type,
    doctor,
    description: description || '',
    date,
    attachments: attachments || [],
    created_at: new Date().toISOString()
  };
  db.dossiers_medicaux.push(newRecord);
  writeDB(db);
  res.status(201).json(newRecord);
});

// GET available time slots for a doctor on a date
app.get('/api/slots', (req, res) => {
  const { doctor, date } = req.query;
  if (!doctor || !date) return res.status(400).json({ error: 'doctor and date required' });

  const allSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00'
  ];

  const db = readDB();
  const booked = db.rdv
    .filter(r => r.doctor === doctor && r.date === date && r.status !== 'cancelled')
    .map(r => r.time);

  const slots = allSlots.map(t => ({ time: t, available: !booked.includes(t) }));
  res.json(slots);
});

// ─── Catch-all → SPA ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🏥  Hospital App running at http://localhost:${PORT}\n`);
});
