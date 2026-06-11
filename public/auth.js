const API = 'http://localhost:3000/api';
let currentRole = 'patient';

/* ─── Screen navigation ──────────────────────────────────────────────────── */
function showScreen(name) {
    document.querySelectorAll('.login-screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(`screen-${name}`).classList.remove('hidden');
}

function selectRole(role) {
    currentRole = role;
    const label = role === 'patient' ? 'Patient' : 'Médecin';
    const icon = role === 'patient' ? '🧑‍⚕️' : '👨‍⚕️';

    document.getElementById('login-role-badge').textContent = `${icon} ${label}`;
    document.getElementById('signup-role-badge').textContent = `${icon} ${label}`;

    // Hide numéro sécu for doctors
    document.getElementById('signup-secu-group').style.display =
        role === 'medecin' ? 'none' : '';

    showScreen('login');
}

function togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
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

/* ─── Login ──────────────────────────────────────────────────────────────── */
async function handleLogin() {
    const login = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    errEl.classList.add('hidden');

    if (!login || !password) {
        errEl.textContent = 'Veuillez remplir tous les champs.';
        errEl.classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password, role: currentRole }),
        });
        const data = await res.json();

        if (!res.ok) {
            errEl.textContent = data.error || 'Identifiant ou mot de passe incorrect.';
            errEl.classList.remove('hidden');
            return;
        }

        // Store session info
        sessionStorage.setItem('user_id', data.user_id);
        sessionStorage.setItem('patient_id', data.patient_id || '');
        sessionStorage.setItem('role', data.role);
        sessionStorage.setItem('nom', data.nom || '');
        sessionStorage.setItem('prenom', data.prenom || '');

        showToast('Connexion réussie !', 'success');
        setTimeout(() => {
            window.location.href = data.role === 'medecin'
                ? 'portailmedecin.html'
                : 'portailpatient.html';
        }, 800);

    } catch (e) {
        errEl.textContent = 'Impossible de contacter le serveur.';
        errEl.classList.remove('hidden');
    }
}

/* ─── Signup ─────────────────────────────────────────────────────────────── */
async function handleSignup() {
    const nom = document.getElementById('signup-nom').value.trim();
    const prenom = document.getElementById('signup-prenom').value.trim();
    const dob = document.getElementById('signup-dob').value;
    const secu = document.getElementById('signup-secu').value.trim();
    const login = document.getElementById('signup-login').value.trim();
    const password = document.getElementById('signup-password').value;
    const errEl = document.getElementById('signup-error');

    errEl.classList.add('hidden');

    if (!nom || !prenom || !dob || !login || !password) {
        errEl.textContent = 'Veuillez remplir tous les champs obligatoires.';
        errEl.classList.remove('hidden');
        return;
    }
    if (password.length < 8) {
        errEl.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
        errEl.classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch(`${API}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nom, prenom, dob, secu, login, password, role: currentRole }),
        });
        const data = await res.json();

        if (!res.ok) {
            errEl.textContent = data.error || 'Erreur lors de la création du compte.';
            errEl.classList.remove('hidden');
            return;
        }

        showToast('Compte créé avec succès !', 'success');
        setTimeout(() => showScreen('login'), 1000);

    } catch (e) {
        errEl.textContent = 'Impossible de contacter le serveur.';
        errEl.classList.remove('hidden');
    }
}

/* ─── Enter key support ──────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const active = document.querySelector('.login-screen:not(.hidden)').id;
    if (active === 'screen-login') handleLogin();
    if (active === 'screen-signup') handleSignup();
});