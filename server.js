const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB connection ─────────────────────────────────────────────────────────
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});
// ─── ROUTES: rdv ───────────────────────────────────────────────────────────

// GET all RDV (optionally filter by patient_id)
app.get('/api/rdv', async (req, res) => {
    try {
        const { patient_id } = req.query;
        const result = patient_id
            ? await pool.query(
                `SELECT r.*, 
            p.nom AS patient_nom, p.prenom AS patient_prenom,
            per.nom AS medecin_nom, per.prenom AS medecin_prenom, per.profession
           FROM rdv r
           JOIN patients  p   ON r.patient_id  = p.patient_id
           JOIN personnel per ON r.medecin_id  = per.personnel_id
           WHERE r.patient_id = $1
           ORDER BY r.date_rdv ASC`, [patient_id])
            : await pool.query(
                `SELECT r.*,
            p.nom AS patient_nom, p.prenom AS patient_prenom,
            per.nom AS medecin_nom, per.prenom AS medecin_prenom, per.profession
           FROM rdv r
           JOIN patients  p   ON r.patient_id  = p.patient_id
           JOIN personnel per ON r.medecin_id  = per.personnel_id
           ORDER BY r.date_rdv ASC`);
        res.json(result.rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// GET single RDV
app.get('/api/rdv/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rdv WHERE rdv_id = $1', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'RDV not found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST create RDV
app.post('/api/rdv', async (req, res) => {
    try {
        const { patient_id, medecin_id, date_rdv } = req.body;
        if (!patient_id || !medecin_id || !date_rdv)
            return res.status(400).json({ error: 'patient_id, medecin_id, date_rdv requis' });

        // Conflict check: same doctor, same timeslot
        const conflict = await pool.query(
            'SELECT rdv_id FROM rdv WHERE medecin_id = $1 AND date_rdv = $2',
            [medecin_id, date_rdv]
        );
        if (conflict.rows.length)
            return res.status(409).json({ error: 'Ce créneau est déjà pris pour ce médecin' });

        const result = await pool.query(
            'INSERT INTO rdv (patient_id, medecin_id, date_rdv) VALUES ($1, $2, $3) RETURNING *',
            [patient_id, medecin_id, date_rdv]
        );
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE RDV
app.delete('/api/rdv/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM rdv WHERE rdv_id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET available time slots for a doctor on a date
app.get('/api/slots', async (req, res) => {
    try {
        const { medecin_id, date } = req.query;
        if (!medecin_id || !date)
            return res.status(400).json({ error: 'medecin_id and date required' });

        const allSlots = [
            '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
            '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
            '16:00', '16:30', '17:00'
        ];

        const result = await pool.query(
            `SELECT TO_CHAR(date_rdv, 'HH24:MI') AS time 
       FROM rdv WHERE medecin_id = $1 AND DATE(date_rdv) = $2`,
            [medecin_id, date]
        );
        const booked = result.rows.map(r => r.time);
        const slots = allSlots.map(t => ({ time: t, available: !booked.includes(t) }));
        res.json(slots);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ROUTES: dossiers_medicaux ─────────────────────────────────────────────

// GET all dossiers (optionally filter by patient_id)
app.get('/api/dossiers_medicaux', async (req, res) => {
    try {
        const { patient_id } = req.query;
        const result = patient_id
            ? await pool.query(
                `SELECT d.*,
            p.nom AS patient_nom, p.prenom AS patient_prenom,
            per.nom AS medecin_nom, per.prenom AS medecin_prenom
           FROM dossiers_medicaux d
           JOIN patients  p   ON d.patient_id = p.patient_id
           JOIN personnel per ON d.medecin_id = per.personnel_id
           WHERE d.patient_id = $1
           ORDER BY d.date_admission DESC`, [patient_id])
            : await pool.query(
                `SELECT d.*,
            p.nom AS patient_nom, p.prenom AS patient_prenom,
            per.nom AS medecin_nom, per.prenom AS medecin_prenom
           FROM dossiers_medicaux d
           JOIN patients  p   ON d.patient_id = p.patient_id
           JOIN personnel per ON d.medecin_id = per.personnel_id
           ORDER BY d.date_admission DESC`);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET single dossier
app.get('/api/dossiers_medicaux/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM dossiers_medicaux WHERE dossier_id = $1', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Dossier not found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST create dossier
app.post('/api/dossiers_medicaux', async (req, res) => {
    try {
        const { patient_id, medecin_id, date_admission, diagnostic } = req.body;
        if (!patient_id || !medecin_id)
            return res.status(400).json({ error: 'patient_id et medecin_id requis' });

        const result = await pool.query(
            `INSERT INTO dossiers_medicaux (patient_id, medecin_id, date_admission, diagnostic)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [patient_id, medecin_id, date_admission || new Date(), diagnostic || '']
        );
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ROUTES: patients ──────────────────────────────────────────────────────

app.get('/api/patients', async (req, res) => {
    try {
        const result = await pool.query('SELECT patient_id, nom, prenom, date_naissance FROM patients ORDER BY nom');
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ROUTES: personnel ─────────────────────────────────────────────────────

app.get('/api/personnel', async (req, res) => {
    try {
        const { service } = req.query;
        const query = service
            ? `SELECT personnel_id,
           pgp_sym_decrypt(nom, $1)    AS nom,
           pgp_sym_decrypt(prenom, $1) AS prenom,
           date_naissance, profession, service
         FROM personnel
         WHERE service = $2
         ORDER BY pgp_sym_decrypt(nom, $1)`
            : `SELECT personnel_id,
           pgp_sym_decrypt(nom, $1)    AS nom,
           pgp_sym_decrypt(prenom, $1) AS prenom,
           date_naissance, profession, service
         FROM personnel
         ORDER BY pgp_sym_decrypt(nom, $1)`;

        const params = service
            ? [process.env.CLE_CHIFFREMENT, service]
            : [process.env.CLE_CHIFFREMENT];

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── ROUTES: prescriptions ────────────────────────────────────────────────

app.get('/api/prescriptions', async (req, res) => {
    try {
        const { patient_id } = req.query;
        const result = patient_id
            ? await pool.query(
                `SELECT pr.*,
            per.nom AS medecin_nom, per.prenom AS medecin_prenom
           FROM prescriptions pr
           JOIN personnel per ON pr.medecin_id = per.personnel_id
           WHERE pr.patient_id = $1
           ORDER BY pr.date_debut DESC`, [patient_id])
            : await pool.query('SELECT * FROM prescriptions ORDER BY date_debut DESC');
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Catch-all → SPA ───────────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n  🏥  Hospital App → http://localhost:${PORT}\n`);
});


// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { login, password, role } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM utilisateurs WHERE login = $1', [login]
        );
        if (!result.rows.length) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
        if (role === 'medecin' && !user.is_medecin) return res.status(403).json({ error: 'Accès non autorisé.' });
        if (role === 'patient' && user.is_medecin) return res.status(403).json({ error: 'Utilisez le portail médecin.' });

        res.json({ user_id: user.user_id, patient_id: user.patient_id || null, role: user.is_medecin ? 'medecin' : 'patient' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
    const { nom, prenom, dob, secu, login, password, email, role } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const is_medecin = role === 'medecin';

        // Create patient record if not a doctor
        let patient_id = null;
        if (!is_medecin) {
            const p = await pool.query(
                `INSERT INTO patients (nom, prenom, date_naissance, num_secu, rgpd)
         VALUES (pgp_sym_encrypt($1,$5), pgp_sym_encrypt($2,$5), $3, pgp_sym_encrypt($4,$5), true)
         RETURNING patient_id`,
                [nom, prenom, dob, secu || '', process.env.CLE_CHIFFREMENT]
            );
            patient_id = p.rows[0].patient_id;
        }

        await pool.query(
            `INSERT INTO utilisateurs (login, password, email, is_medecin, date_creation)
       VALUES ($1, $2, $3, $4, now())`,
            [login, hash, email || '', is_medecin]
        );

        res.status(201).json({ success: true, patient_id });
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'Cet identifiant ou email est déjà pris.' });
        res.status(500).json({ error: e.message });
    }
});