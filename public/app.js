/* ═══════════════════════════════════════════════════════════════════════════
   MediCare — Patient Portal  |  app.js
   ═══════════════════════════════════════════════════════════════════════════ */

const API = 'http://localhost:3000/api';

/* ─── Navigation ─────────────────────────────────────────────────────────── */

// Load doctors from DB into the select on page load
async function loadPersonnel() {
    const res = await fetch(`${API}/personnel`);
    const list = await res.json();
    const sel = document.getElementById('doctor-select');
    sel.innerHTML = '<option value="">-- Choisir un médecin --</option>' +
        list.map(p => `<option value="${p.personnel_id}">${p.prenom} ${p.nom} — ${p.profession}</option>`).join('');
}


function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`section-${name}`);
  if (el) {
    el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (name === 'rdv-list')      loadRdvList();
  if (name === 'dossiers-list') loadDossiersList();
    if (name === 'booking') {
        initCalendar(); loadPersonnel();
    }
}

function toggleMobileMenu() {
  document.getElementById('mobile-drawer').classList.toggle('open');
}
function closeMobileMenu() {
  document.getElementById('mobile-drawer').classList.remove('open');
}

/* ─── Toast ──────────────────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ─── Modal ──────────────────────────────────────────────────────────────── */
let _modalCallback = null;
function openModal(title, body, confirmCb) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  document.getElementById('modal-confirm-btn').onclick = () => { confirmCb(); closeModal(); };
  document.getElementById('modal-overlay').classList.add('open');
  _modalCallback = confirmCb;
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

/* ─── Doctors from DB ────────────────────────────────────────────────────── */
async function loadPersonnel() {
    try {
        const specialty = document.getElementById('specialty-select').value;
        const url = specialty
            ? `${API}/personnel?service=${encodeURIComponent(specialty)}`
            : `${API}/personnel`;
        const res = await fetch(url);
        const list = await res.json();
        const sel = document.getElementById('doctor-select');
        sel.innerHTML = '<option value="">-- Choisir un médecin --</option>' +
            list.map(p =>
                `<option value="${p.personnel_id}">${p.prenom} ${p.nom} — ${p.profession}</option>`
            ).join('');
        selectedSlot = null;
        selectedDate = null;
        updateSummary();
        fetchSlots();
    } catch (e) {
        console.error('Impossible de charger le personnel', e);
    }
}

/* ─── Calendar ───────────────────────────────────────────────────────────── */
let calDate     = new Date();
let selectedDate = null;

function initCalendar() {
  calDate = new Date();
  selectedDate = null;
  renderCalendar();
}

function changeMonth(dir) {
  calDate.setMonth(calDate.getMonth() + dir);
  renderCalendar();
}

function renderCalendar() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const y = calDate.getFullYear();
  const m = calDate.getMonth();

  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(calDate);
  document.getElementById('cal-month-label').textContent = label.charAt(0).toUpperCase() + label.slice(1);

  const firstDay = new Date(y, m, 1);
  const lastDay  = new Date(y, m + 1, 0);
  // Monday-first: getDay() returns 0=Sun,1=Mon ... convert
  let startOffset = (firstDay.getDay() + 6) % 7;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Empty cells before first day
  for (let i = 0; i < startOffset; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(y, m, d);
    const cell = document.createElement('div');
    const iso  = isoDate(date);
    cell.textContent = d;
    cell.className = 'cal-day';

    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isPast    = date < today;

    if (isPast || isWeekend) {
      cell.classList.add('disabled');
    } else {
      if (date.getTime() === today.getTime()) cell.classList.add('today');
      if (selectedDate === iso) cell.classList.add('selected');
      cell.onclick = () => selectDate(iso);
    }
    grid.appendChild(cell);
  }
}

function selectDate(iso) {
  selectedDate = iso;
  selectedSlot = null;
  renderCalendar();
  fetchSlots();
  updateSummary();
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateFR(iso) {
  const [y,m,d] = iso.split('-');
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

/* ─── Time Slots ─────────────────────────────────────────────────────────── */
let selectedSlot = null;

async function fetchSlots() {
  const doctor = document.getElementById('doctor-select').value;
  const container = document.getElementById('slots-container');

  if (!doctor || !selectedDate) {
    container.innerHTML = '<p class="slots-placeholder">Sélectionnez un médecin et une date pour voir les créneaux disponibles.</p>';
    return;
  }

  container.innerHTML = '<p class="slots-placeholder">Chargement des créneaux...</p>';

  try {
    const res  = await fetch(`${API}/slots?medecin_id=${encodeURIComponent(doctor)}&date=${selectedDate}`);
    const slots = await res.json();

    const dateLabel = document.createElement('p');
    dateLabel.className = 'slots-date-label';
    dateLabel.textContent = formatDateFR(selectedDate);

    const grid = document.createElement('div');
    grid.className = 'slots-grid';

    slots.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'slot-btn' + (!s.available ? ' taken' : '') + (s.time === selectedSlot ? ' selected' : '');
      btn.textContent = s.time;
      btn.disabled = !s.available;
      if (s.available) {
        btn.onclick = () => { selectedSlot = s.time; fetchSlots(); updateSummary(); };
      }
      grid.appendChild(btn);
    });

    container.innerHTML = '';
    container.appendChild(dateLabel);
    container.appendChild(grid);
  } catch (e) {
    container.innerHTML = '<p class="slots-placeholder">Erreur de chargement des créneaux.</p>';
  }
}

/* ─── Summary & Confirm ──────────────────────────────────────────────────── */
function updateSummary() {
  const patientName = document.getElementById('patient-name').value.trim();
  const patientId   = document.getElementById('patient-id').value.trim();
    const doctorSel = document.getElementById('doctor-select');
    const doctor = doctorSel.value;
    const doctorLabel = doctorSel.options[doctorSel.selectedIndex]?.text || '';
    const specialty = document.getElementById('specialty-select').value;
  const body        = document.getElementById('summary-body');
  const confirmBtn  = document.getElementById('confirm-btn');

  const allFilled = patientName && patientId && doctor && selectedDate && selectedSlot;

  if (!allFilled) {
    const missing = [];
    if (!patientName) missing.push('Nom');
    if (!patientId)   missing.push('N° Patient');
    if (!doctor)      missing.push('Médecin');
    if (!selectedDate) missing.push('Date');
    if (!selectedSlot) missing.push('Créneau');
    body.innerHTML = `<p class="summary-empty">Manquant : ${missing.join(', ')}</p>`;
    confirmBtn.disabled = true;
    return;
  }

  body.innerHTML = `
    <div class="summary-row"><span class="summary-key">Patient</span><span class="summary-val">${patientName}</span></div>
    <div class="summary-row"><span class="summary-key">N° Patient</span><span class="summary-val">${patientId}</span></div>
    <div class="summary-row"><span class="summary-key">Médecin</span><span class="summary-val">${doctorLabel}</span></div>
    <div class="summary-row"><span class="summary-key">Spécialité</span><span class="summary-val">${specialty}</span></div>
    <div class="summary-row"><span class="summary-key">Date</span><span class="summary-val">${formatDateFR(selectedDate)}</span></div>
    <div class="summary-row"><span class="summary-key">Heure</span><span class="summary-val">${selectedSlot}</span></div>
  `;
  confirmBtn.disabled = false;
}

// Trigger summary update on input changes
document.getElementById('patient-name').addEventListener('input', updateSummary);
document.getElementById('patient-id').addEventListener('input', updateSummary);

async function confirmBooking() {
  const payload = {
    patient_id: parseInt(document.getElementById('patient-id').value.trim()),
    patient_name: document.getElementById('patient-name').value.trim(),
    medecin_id: parseInt(document.getElementById('doctor-select').value),
    specialty:    document.getElementById('specialty-select').value,
    date_rdv: `${selectedDate}T${selectedSlot}:00`,
    time:         selectedSlot,
    notes:        document.getElementById('rdv-notes').value.trim(),
  };

  try {
    const res  = await fetch(`${API}/rdv`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erreur lors de la réservation', 'error');
      return;
    }

    showToast('Rendez-vous confirmé avec succès !', 'success');

    // Reset form
    document.getElementById('patient-name').value = '';
    document.getElementById('patient-id').value   = '';
    document.getElementById('specialty-select').value = '';
    document.getElementById('doctor-select').innerHTML = '<option value="">-- Choisir un médecin --</option>';
    document.getElementById('rdv-notes').value    = '';
    selectedDate = null;
    selectedSlot = null;
    initCalendar();
    updateSummary();

    setTimeout(() => showSection('rdv-list'), 1000);
  } catch (e) {
    showToast('Impossible de contacter le serveur.', 'error');
  }
}

/* ─── RDV List ───────────────────────────────────────────────────────────── */
async function loadRdvList() {
  const container   = document.getElementById('rdv-list-container');
  const patientId   = document.getElementById('rdv-filter-patient').value.trim();
  const statusFilter = document.getElementById('rdv-filter-status').value;

  container.innerHTML = '<p class="loading-msg">Chargement...</p>';

  try {
    const url = patientId ? `${API}/rdv?patient_id=${encodeURIComponent(patientId)}` : `${API}/rdv`;
    const res  = await fetch(url);
    let list   = await res.json();

    if (statusFilter) list = list.filter(r => r.status === statusFilter);
    list = list.sort((a,b) => new Date(a.date+' '+a.time) - new Date(b.date+' '+b.time));

    if (!list.length) {
      container.innerHTML = '<p class="empty-msg">Aucun rendez-vous trouvé.</p>';
      return;
    }

    container.innerHTML = '';
    list.forEach(rdv => {
      const [y,m,d] = rdv.date.split('-');
      const months  = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

      const card = document.createElement('div');
      card.className = 'rdv-card';
      card.innerHTML = `
        <div class="rdv-date-block">
          <div class="rdv-date-day">${parseInt(d)}</div>
          <div class="rdv-date-month">${months[parseInt(m)-1]}</div>
        </div>
        <div class="rdv-info">
          <h3>${rdv.doctor} — ${rdv.specialty || 'Consultation'}</h3>
          <p>Patient : ${rdv.patient_name} (${rdv.patient_id})</p>
          ${rdv.notes ? `<p style="margin-top:4px;font-style:italic;">${rdv.notes}</p>` : ''}
        </div>
        <div class="rdv-meta">
          <span class="rdv-time-badge">🕐 ${rdv.time}</span>
          <span class="status-badge status-${rdv.status}">${rdv.status === 'confirmed' ? 'Confirmé' : 'Annulé'}</span>
          ${rdv.status === 'confirmed'
            ? `<button class="btn-cancel-rdv" onclick="cancelRdv('${rdv.id}')">Annuler</button>`
            : ''}
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = '<p class="empty-msg">Erreur de chargement. Le serveur est-il en ligne ?</p>';
  }
}

async function cancelRdv(id) {
  openModal(
    'Annuler le rendez-vous',
    'Êtes-vous sûr de vouloir annuler ce rendez-vous ? Cette action ne peut pas être annulée.',
    async () => {
      try {
        const res = await fetch(`${API}/rdv/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Rendez-vous annulé.', 'info');
          loadRdvList();
        } else {
          showToast('Erreur lors de l\'annulation.', 'error');
        }
      } catch (e) {
        showToast('Impossible de contacter le serveur.', 'error');
      }
    }
  );
}

/* ─── Dossiers List ──────────────────────────────────────────────────────── */
const DOSSIER_ICONS = {
  'Analyse de sang': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M12 2v4M16 2v4M5 6h14l-1.5 12H6.5L5 6z"/></svg>`,
  'Radiographie':    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="9" y2="9"/><line x1="3" y1="15" x2="9" y2="15"/></svg>`,
  'Ordonnance':      `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
  'Compte rendu':    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>`,
  'Vaccination':     `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5 5l7 7-7 7"/></svg>`,
  'default':         `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>`,
};

async function loadDossiersList() {
  const container  = document.getElementById('dossiers-list-container');
  const patientId  = document.getElementById('dm-filter-patient').value.trim();
  const typeFilter = document.getElementById('dm-filter-type').value;

  container.innerHTML = '<p class="loading-msg">Chargement...</p>';

  try {
    const url = patientId ? `${API}/dossiers_medicaux?patient_id=${encodeURIComponent(patientId)}` : `${API}/dossiers_medicaux`;
    const res  = await fetch(url);
    let list   = await res.json();

    if (typeFilter) list = list.filter(d => d.type === typeFilter);
    list = list.sort((a,b) => new Date(b.date) - new Date(a.date));

    if (!list.length) {
      container.innerHTML = '<p class="empty-msg">Aucun dossier médical trouvé.</p>';
      return;
    }

    container.innerHTML = '';
    list.forEach(dm => {
      const icon = DOSSIER_ICONS[dm.type] || DOSSIER_ICONS['default'];
      const card = document.createElement('div');
      card.className = 'dossier-card';
      card.innerHTML = `
        <div class="dossier-icon-block">${icon}</div>
        <div class="dossier-info">
          <h3>${dm.type}</h3>
          <p>${dm.doctor} — ${dm.patient_name} (${dm.patient_id})</p>
          ${dm.description ? `<p class="dossier-desc">${dm.description}</p>` : ''}
          <span class="type-badge">${dm.type}</span>
        </div>
        <div style="text-align:right; white-space:nowrap;">
          <p style="font-size:13px; font-weight:600; color:var(--gray-dark);">${formatDateFR(dm.date)}</p>
          <p style="font-size:12px; color:var(--gray-muted); margin-top:4px;">ID: ${dm.id}</p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = '<p class="empty-msg">Erreur de chargement. Le serveur est-il en ligne ?</p>';
  }
}

/* ─── Init ───────────────────────────────────────────────────────────────── */
showSection('home');
