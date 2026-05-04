'use strict';

const state = {
    role: localStorage.getItem('signchain.role') || 'cliente',
    documents: [],
};

const el = {
    roleSwitcher: document.querySelector('.role-switcher'),
    roleSelect: document.getElementById('role-select'),
    mspBadge: document.getElementById('msp-badge'),
    createPanel: document.getElementById('create-panel'),
    createForm: document.getElementById('create-form'),
    createDropzone: document.getElementById('create-dropzone'),
    createFile: document.getElementById('create-file'),
    createPick: document.getElementById('create-pick'),
    createClear: document.getElementById('create-clear'),
    docsGrid: document.getElementById('docs-grid'),
    refreshBtn: document.getElementById('refresh-btn'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    toastContainer: document.getElementById('toast-container'),
};

const MSP_OF = { cliente: 'ClienteMSP', proveedor: 'ProveedorMSP' };

function applyRole() {
    el.roleSwitcher.dataset.role = state.role;
    el.roleSelect.value = state.role;
    el.mspBadge.textContent = MSP_OF[state.role];
    el.createPanel.style.opacity = state.role === 'cliente' ? '1' : '0.55';
    el.createPanel.style.pointerEvents = state.role === 'cliente' ? 'auto' : 'none';
    el.createPanel.title = state.role === 'cliente'
        ? ''
        : 'Cambia el rol a Cliente para crear documentos.';
}

el.roleSelect.addEventListener('change', () => {
    state.role = el.roleSelect.value;
    localStorage.setItem('signchain.role', state.role);
    applyRole();
    loadDocuments();
});

function toast(message, kind = 'info', ms = 4000) {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = message;
    el.toastContainer.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.2s';
        setTimeout(() => t.remove(), 200);
    }, ms);
}

function fmtBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch { return iso; }
}

function shortHash(h) {
    if (!h) return '';
    return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

function setupDropzone(zone, fileInput, onFile) {
    const empty = zone.querySelector('.dropzone-empty');
    const filled = zone.querySelector('.dropzone-filled');
    const fileName = filled.querySelector('.file-name');
    const fileSize = filled.querySelector('.file-size');

    function show(file) {
        if (!file) {
            empty.hidden = false;
            filled.hidden = true;
            fileInput.value = '';
            return;
        }
        empty.hidden = true;
        filled.hidden = false;
        fileName.textContent = file.name;
        fileSize.textContent = fmtBytes(file.size);
        if (onFile) onFile(file);
    }

    fileInput.addEventListener('change', () => show(fileInput.files[0]));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) {
            const dt = new DataTransfer();
            dt.items.add(e.dataTransfer.files[0]);
            fileInput.files = dt.files;
            show(fileInput.files[0]);
        }
    });

    return { reset: () => show(null) };
}

const createDz = setupDropzone(el.createDropzone, el.createFile);
el.createPick.addEventListener('click', () => el.createFile.click());
el.createClear.addEventListener('click', () => createDz.reset());

el.createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.role !== 'cliente') {
        toast('Solo el Cliente puede crear documentos. Cambia el rol arriba.', 'error');
        return;
    }
    const fd = new FormData(el.createForm);
    if (!fd.get('file') || !fd.get('file').name) {
        toast('Selecciona un archivo primero.', 'error');
        return;
    }
    const submitBtn = el.createForm.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';
    try {
        const res = await fetch('/api/documents', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        toast(`Documento ${data.id} creado · hash ${shortHash(data.hash)}`, 'ok');
        el.createForm.reset();
        createDz.reset();
        loadDocuments();
    } catch (err) {
        toast(`Error creando: ${err.message}`, 'error', 7000);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear documento';
    }
});

function statusPill(status) {
    return `<span class="status-pill status-${status}">${status}</span>`;
}

function signerDots(doc) {
    const orgs = (doc.signatures || []).map((s) => s.org);
    const cli = orgs.includes('ClienteMSP');
    const prov = orgs.includes('ProveedorMSP');
    return `
        <div class="signers" title="Firmantes">
            <span class="signer-dot ${cli ? 'signed-cliente' : ''}" title="Cliente"></span>
            <span class="signer-dot ${prov ? 'signed-proveedor' : ''}" title="Proveedor"></span>
        </div>
    `;
}

function renderDocs() {
    if (!state.documents.length) {
        el.docsGrid.innerHTML = '<p class="empty-state">No hay documentos en el ledger todavía. Crea uno arriba.</p>';
        return;
    }
    el.docsGrid.innerHTML = state.documents.map((d) => `
        <article class="doc-card" data-id="${d.id}">
            <span class="doc-id">${d.id}</span>
            <h3 class="doc-title">${escapeHtml(d.title)}</h3>
            <div class="doc-meta">
                ${statusPill(d.status)}
                ${signerDots(d)}
            </div>
            <div class="doc-hash">${shortHash(d.hash)}</div>
            <div class="doc-meta">
                <span>${escapeHtml(d.createdBy || '')}</span>
                <span>${fmtDate(d.createdAt)}</span>
            </div>
        </article>
    `).join('');

    el.docsGrid.querySelectorAll('.doc-card').forEach((card) => {
        card.addEventListener('click', () => openDocModal(card.dataset.id));
    });
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function loadDocuments() {
    try {
        const res = await fetch(`/api/documents?role=${state.role}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        state.documents = data.documents.sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || ''));
        renderDocs();
    } catch (err) {
        el.docsGrid.innerHTML = `<p class="empty-state">Error: ${escapeHtml(err.message)}</p>`;
    }
}
el.refreshBtn.addEventListener('click', loadDocuments);

function closeModal() {
    el.modal.hidden = true;
    el.modalBody.innerHTML = '';
}
el.modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeModal();
});

async function openDocModal(id) {
    const doc = state.documents.find((d) => d.id === id);
    if (!doc) return;
    el.modalTitle.textContent = `${doc.id} · ${doc.title}`;
    el.modal.hidden = false;
    el.modalBody.innerHTML = `
        <dl class="kv">
            <dt>Estado</dt>          <dd>${statusPill(doc.status)}</dd>
            <dt>Hash</dt>            <dd class="mono">${doc.hash}</dd>
            <dt>Descripción</dt>     <dd>${escapeHtml(doc.description) || '<span class="muted">—</span>'}</dd>
            <dt>Creado por</dt>      <dd>${escapeHtml(doc.createdBy)}</dd>
            <dt>Cert ID creador</dt> <dd class="mono">${shortHash(doc.createdByCertID)}</dd>
            <dt>Creado en</dt>       <dd>${fmtDate(doc.createdAt)}</dd>
            ${doc.rejectionReason ? `<dt>Motivo rechazo</dt><dd>${escapeHtml(doc.rejectionReason)}</dd>` : ''}
        </dl>

        <div>
            <h4 style="margin:0 0 8px;font-size:14px;color:var(--text-dim);">Firmas (${doc.signatures.length})</h4>
            ${doc.signatures.length === 0
                ? '<p class="muted">Aún sin firmas.</p>'
                : `<div class="signature-list">${doc.signatures.map((s) => `
                    <div class="signature-item">
                        <div class="sig-org">
                            <span class="signer-dot ${s.org === 'ClienteMSP' ? 'signed-cliente' : 'signed-proveedor'}"></span>
                            ${s.org}
                        </div>
                        <div class="muted">Firmado en ${fmtDate(s.timestamp)}</div>
                        <div class="mono" style="font-size:11px;color:var(--text-mute)">cert ${shortHash(s.signerCertID)}</div>
                    </div>
                `).join('')}</div>`}
        </div>

        ${renderModalActions(doc)}
    `;

    bindModalActions(doc);
}

function renderModalActions(doc) {
    const myMsp = MSP_OF[state.role];
    const alreadySigned = doc.signatures.some((s) => s.org === myMsp);
    const terminalStates = ['fully-approved', 'rejected', 'cancelled'];
    const isTerminal = terminalStates.includes(doc.status);
    const canCancel = state.role === 'cliente' && doc.createdBy === 'ClienteMSP' && !isTerminal;

    if (isTerminal) {
        return `
            <div class="modal-actions">
                <p class="muted" style="margin:0;flex:1;">Documento en estado final. No hay más acciones.</p>
            </div>
        `;
    }

    let signSection = '';
    if (alreadySigned) {
        signSection = `<p class="muted" style="margin:0;flex:1;">Ya has firmado como <b>${myMsp}</b>.</p>`;
    } else {
        signSection = `
            <div style="flex:1;display:grid;gap:8px;">
                <label class="muted small" for="sign-file-input">
                    Sube de nuevo el archivo original. La app calcula su hash y lo compara con el del ledger antes de firmar.
                </label>
                <input type="file" id="sign-file-input" />
                <button class="primary" id="sign-btn">Firmar como ${state.role}</button>
            </div>
        `;
    }

    let rejectSection = '';
    if (!alreadySigned) {
        rejectSection = `
            <details>
                <summary class="link-btn" style="cursor:pointer;">Rechazar</summary>
                <div style="margin-top:10px;display:grid;gap:8px;">
                    <input type="text" id="reject-reason" placeholder="Motivo del rechazo" />
                    <button class="danger" id="reject-btn">Rechazar como ${state.role}</button>
                </div>
            </details>
        `;
    }

    let cancelSection = '';
    if (canCancel) {
        cancelSection = `<button class="ghost" id="cancel-btn">Cancelar documento</button>`;
    }

    return `
        <div class="modal-actions" style="flex-direction:column;align-items:stretch;">
            ${signSection}
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${rejectSection}
                ${cancelSection}
            </div>
        </div>
    `;
}

function bindModalActions(doc) {
    const signBtn = document.getElementById('sign-btn');
    const signFileInput = document.getElementById('sign-file-input');
    if (signBtn && signFileInput) {
        signBtn.addEventListener('click', async () => {
            if (!signFileInput.files[0]) {
                toast('Selecciona el archivo a firmar.', 'error');
                return;
            }
            signBtn.disabled = true;
            signBtn.textContent = 'Firmando...';
            try {
                const fd = new FormData();
                fd.append('file', signFileInput.files[0]);
                fd.append('role', state.role);
                const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}/sign`, {
                    method: 'POST', body: fd,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                toast(`Firmado como ${data.signedBy}. Nuevo estado: ${data.newStatus}`, 'ok');
                closeModal();
                loadDocuments();
            } catch (err) {
                toast(`Error firmando: ${err.message}`, 'error', 8000);
                signBtn.disabled = false;
                signBtn.textContent = `Firmar como ${state.role}`;
            }
        });
    }

    const rejectBtn = document.getElementById('reject-btn');
    if (rejectBtn) {
        rejectBtn.addEventListener('click', async () => {
            const reason = document.getElementById('reject-reason').value.trim();
            if (!reason) { toast('Indica un motivo.', 'error'); return; }
            rejectBtn.disabled = true;
            try {
                const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}/reject`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: state.role, reason }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                toast(`Documento ${doc.id} rechazado.`, 'ok');
                closeModal();
                loadDocuments();
            } catch (err) {
                toast(`Error rechazando: ${err.message}`, 'error', 8000);
                rejectBtn.disabled = false;
            }
        });
    }

    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            if (!confirm(`¿Cancelar el documento ${doc.id}?`)) return;
            cancelBtn.disabled = true;
            try {
                const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: state.role }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                toast(`Documento ${doc.id} cancelado.`, 'ok');
                closeModal();
                loadDocuments();
            } catch (err) {
                toast(`Error cancelando: ${err.message}`, 'error', 8000);
                cancelBtn.disabled = false;
            }
        });
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.modal.hidden) closeModal();
});

applyRole();
loadDocuments();
setInterval(() => { if (el.modal.hidden) loadDocuments(); }, 10000);
