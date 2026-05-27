'use strict';

// ──────────────────────────────────────────────────────────────
//   DistribuTech — Frontend (vanilla JS)
// ──────────────────────────────────────────────────────────────

const ROLE_LABELS = {
    fabricante: 'Fabricante',
    mayorista: 'Mayorista',
    minorista: 'Minorista',
    cliente: 'Cliente final',
};

const MSP_BY_ROLE = {
    fabricante: 'FabricanteMSP',
    mayorista: 'MayoristaMSP',
    minorista: 'MinoristaMSP',
};

const state = {
    role: null,
    activity: JSON.parse(localStorage.getItem('dt-activity') || '[]'),
};

// ──────────────────────────────────────────────────────────────
//   HTTP helper
// ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!res.ok) {
        const err = new Error((json && json.error) || `HTTP ${res.status}`);
        err.status = res.status;
        err.body = json;
        throw err;
    }
    return json;
}

// ──────────────────────────────────────────────────────────────
//   Toast + activity log
// ──────────────────────────────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastTimeout;
function toast(message, type = 'ok') {
    clearTimeout(toastTimeout);
    toastEl.className = `toast show ${type}`;
    toastEl.textContent = message;
    toastTimeout = setTimeout(() => { toastEl.className = 'toast'; }, 3000);
}

function logActivity(message, ok = true) {
    state.activity.unshift({
        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        message,
        ok,
        role: state.role,
    });
    state.activity = state.activity.slice(0, 30);
    localStorage.setItem('dt-activity', JSON.stringify(state.activity));
    renderActivity();
}

function renderActivity() {
    const ul = document.getElementById('activity-list');
    if (!ul) return;
    if (state.activity.length === 0) {
        ul.innerHTML = '<li class="empty">Sin actividad todavía. Ejecuta una acción para verla aquí.</li>';
        return;
    }
    ul.innerHTML = state.activity.map(a =>
        `<li><span class="status ${a.ok ? 'ok' : 'error'}"></span>
              <span class="time">${a.time}</span>
              <span>${escapeHtml(a.message)}</span></li>`
    ).join('');
}

function clearActivity() {
    state.activity = [];
    localStorage.setItem('dt-activity', '[]');
    renderActivity();
    toast('Actividad limpiada');
}

// ──────────────────────────────────────────────────────────────
//   Render helpers
// ──────────────────────────────────────────────────────────────
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function activityPanel() {
    return `
    <section class="activity">
        <div class="activity-header">
            Actividad reciente
            <button class="activity-clear" onclick="clearActivity()" type="button">Limpiar</button>
        </div>
        <ul class="activity-list" id="activity-list"></ul>
    </section>
    <p class="footnote">
        DistribuTech · Trazabilidad sobre Hyperledger Fabric ·
        <a href="API.md" target="_blank">API</a> ·
        <a href="openapi.yaml" target="_blank">OpenAPI</a>
    </p>`;
}

// ──────────────────────────────────────────────────────────────
//   Action card factory
// ──────────────────────────────────────────────────────────────
// Recibe: { title, subtitle, fields, submit:{label, action} }
function actionCard({ title, subtitle, fields, button = 'Ejecutar', handler }) {
    const id = 'form-' + Math.random().toString(36).slice(2, 8);
    setTimeout(() => bindForm(id, handler), 0);
    return `
    <div class="action-card">
        <h3>${title}</h3>
        <div class="action-sub">${subtitle}</div>
        <form id="${id}">
            ${fields.map(f => fieldHtml(f)).join('')}
            <button type="submit">${button}</button>
            <div class="result" hidden></div>
        </form>
    </div>`;
}

function fieldHtml(f) {
    const value = f.default ? ` value="${escapeHtml(f.default)}"` : '';
    const mono = f.mono !== false ? ' class="mono"' : '';
    if (f.type === 'textarea') {
        return `<label>${f.label}
            <textarea name="${f.name}" rows="3"${mono}>${f.default || ''}</textarea>
        </label>`;
    }
    if (f.type === 'select') {
        return `<label>${f.label}
            <select name="${f.name}">
                ${f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
            </select>
        </label>`;
    }
    return `<label>${f.label}
        <input type="${f.type || 'text'}" name="${f.name}"${mono}${value}
               placeholder="${f.placeholder || ''}" ${f.required === false ? '' : 'required'} />
    </label>`;
}

function bindForm(formId, handler) {
    const form = document.getElementById(formId);
    if (!form) return;
    const result = form.querySelector('.result');
    const button = form.querySelector('button[type="submit"]');
    const originalLabel = button.innerHTML;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        button.disabled = true;
        button.innerHTML = `<span class="spinner"></span>Procesando…`;
        result.hidden = true;
        try {
            const data = Object.fromEntries(new FormData(form));
            const res = await handler(data);
            result.hidden = false;
            result.className = 'result ok';
            result.textContent = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
        } catch (err) {
            result.hidden = false;
            result.className = 'result error';
            result.textContent = err.message;
        } finally {
            button.disabled = false;
            button.innerHTML = originalLabel;
        }
    });
}

// ──────────────────────────────────────────────────────────────
//   Welcome view
// ──────────────────────────────────────────────────────────────
function renderWelcome() {
    document.body.dataset.role = 'welcome';
    document.getElementById('main').innerHTML = `
    <div class="hero">
        <h1>Confianza compartida<br>para la distribución de tecnología</h1>
        <p>Fabricantes, mayoristas y minoristas conectados en blockchain. Una sola fuente de verdad para pedidos, custodia y garantías — sin renunciar a la privacidad comercial.</p>

        <div class="supply-chain">
            <div class="supply-node" data-role="fabricante">
                <div class="supply-node-label">Origen</div>
                <div class="supply-node-name">Fabricante</div>
            </div>
            <div class="supply-arrow">→</div>
            <div class="supply-node" data-role="mayorista">
                <div class="supply-node-label">Distribución</div>
                <div class="supply-node-name">Mayorista</div>
            </div>
            <div class="supply-arrow">→</div>
            <div class="supply-node" data-role="minorista">
                <div class="supply-node-label">Venta</div>
                <div class="supply-node-name">Minorista</div>
            </div>
            <div class="supply-arrow">→</div>
            <div class="supply-node" data-role="cliente">
                <div class="supply-node-label">Consumo</div>
                <div class="supply-node-name">Cliente final</div>
            </div>
        </div>

        <div class="feature-grid">
            <div class="feature">
                <div class="feature-icon">🛡️</div>
                <h3>Autenticidad verificable</h3>
                <p>Cada producto tiene un historial inmutable desde su fabricación. El cliente final puede verificarlo en segundos.</p>
            </div>
            <div class="feature">
                <div class="feature-icon">🔒</div>
                <h3>Privacidad comercial</h3>
                <p>Tres canales independientes: cada actor comparte lo necesario sin exponer sus precios o márgenes.</p>
            </div>
            <div class="feature">
                <div class="feature-icon">⚡</div>
                <h3>Sin disputas operativas</h3>
                <p>Pedidos y custodia firmados digitalmente por ambas partes. Cero "yo dije / tú dijiste".</p>
            </div>
            <div class="feature">
                <div class="feature-icon">🧾</div>
                <h3>Garantías a prueba de fraude</h3>
                <p>Cada garantía vive en el ledger, vinculada al cliente y al fabricante. Sin tarjetas, sin papeles.</p>
            </div>
        </div>

        <p class="cta">Selecciona un rol arriba para explorar la demo →</p>
    </div>
    ${activityPanel()}`;
    renderActivity();
}

// ──────────────────────────────────────────────────────────────
//   Role views
// ──────────────────────────────────────────────────────────────
function roleHeader(role, summary) {
    return `
    <div class="role-header" data-role="${role}">
        <div>
            <h2>Eres ${ROLE_LABELS[role]}</h2>
            <p>${summary}</p>
        </div>
        ${MSP_BY_ROLE[role] ? `<span class="role-badge">${MSP_BY_ROLE[role]}</span>` : ''}
    </div>`;
}

function renderFabricante() {
    document.body.dataset.role = 'fabricante';
    document.getElementById('main').innerHTML = `
    ${roleHeader('fabricante', 'Registra productos, gestiona pedidos del mayorista y resuelve reclamaciones de garantía.')}
    <div class="actions">
        ${actionCard({
            title: 'Registrar producto',
            subtitle: 'Crea una nueva unidad en el canal de trazabilidad.',
            fields: [
                { name: 'serie', label: 'Número de serie', placeholder: 'SN-1234' },
                { name: 'modelo', label: 'Modelo', placeholder: 'Laptop X' },
                { name: 'lote', label: 'Lote', placeholder: 'L001' },
            ],
            button: 'Registrar',
            handler: async ({ serie, modelo, lote }) => {
                const r = await api('POST', '/api/fabricante/registrar-producto', { serie, modelo, lote });
                toast(`Producto ${serie} registrado`);
                logActivity(`Producto ${serie} registrado por Fabricante`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Aceptar pedido del mayorista',
            subtitle: 'Confirma un pedido y compromete stock.',
            fields: [{ name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-001' }],
            button: 'Aceptar',
            handler: async ({ pedidoId }) => {
                const r = await api('POST', '/api/fabricante/aceptar-pedido', { pedidoId });
                toast(`Pedido ${pedidoId} aceptado`);
                logActivity(`Pedido ${pedidoId} aceptado por Fabricante`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Registrar envío',
            subtitle: 'Marca el pedido como enviado con su tracking.',
            fields: [
                { name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-001' },
                { name: 'tracking', label: 'Tracking', placeholder: 'TRK-ABC123' },
            ],
            button: 'Registrar envío',
            handler: async ({ pedidoId, tracking }) => {
                const r = await api('POST', '/api/fabricante/registrar-envio', { pedidoId, tracking });
                toast(`Envío ${tracking} registrado`);
                logActivity(`Envío del pedido ${pedidoId} (${tracking})`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Transferir custodia',
            subtitle: 'Transfiere la custodia al mayorista que lo ha recibido.',
            fields: [
                { name: 'serie', label: 'Número de serie', placeholder: 'SN-1234' },
                { name: 'destinoMSP', label: 'Destino', type: 'select', options: [
                    { value: 'MayoristaMSP', label: 'MayoristaMSP' },
                ]},
            ],
            button: 'Transferir',
            handler: async ({ serie, destinoMSP }) => {
                const r = await api('POST', '/api/fabricante/transferir-custodia', { serie, destinoMSP });
                toast(`Custodia de ${serie} transferida`);
                logActivity(`Custodia de ${serie} → ${destinoMSP}`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Resolver reclamación',
            subtitle: 'Acepta o rechaza una reclamación abierta por el minorista.',
            fields: [
                { name: 'reclamacionId', label: 'ID de la reclamación', placeholder: 'REC~SN-1234~abc...' },
                { name: 'resolucion', label: 'Resolución', type: 'textarea', placeholder: 'Sustituido por unidad nueva' },
                { name: 'aceptada', label: 'Decisión', type: 'select', options: [
                    { value: 'true', label: 'Aceptar (cubrir garantía)' },
                    { value: 'false', label: 'Rechazar' },
                ]},
            ],
            button: 'Resolver',
            handler: async ({ reclamacionId, resolucion, aceptada }) => {
                const r = await api('POST', '/api/fabricante/resolver-reclamacion',
                    { reclamacionId, resolucion, aceptada: aceptada === 'true' });
                toast(`Reclamación ${aceptada === 'true' ? 'aceptada' : 'rechazada'}`);
                logActivity(`Reclamación ${reclamacionId} resuelta`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Consultar producto',
            subtitle: 'Estado actual del producto en el ledger.',
            fields: [{ name: 'serie', label: 'Número de serie', placeholder: 'SN-1234' }],
            button: 'Consultar',
            handler: async ({ serie }) => api('GET', `/api/fabricante/producto/${encodeURIComponent(serie)}`),
        })}

        ${actionCard({
            title: 'Consultar pedido',
            subtitle: 'Estado del pedido en canal-mayorista.',
            fields: [{ name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-001' }],
            button: 'Consultar',
            handler: async ({ pedidoId }) => api('GET', `/api/fabricante/pedido/${encodeURIComponent(pedidoId)}`),
        })}
    </div>
    ${activityPanel()}`;
    renderActivity();
}

function renderMayorista() {
    document.body.dataset.role = 'mayorista';
    document.getElementById('main').innerHTML = `
    ${roleHeader('mayorista', 'Compra al fabricante, vende al minorista y gestiona la custodia intermedia.')}
    <div class="actions">
        ${actionCard({
            title: 'Crear pedido al fabricante',
            subtitle: 'Solicita productos al fabricante en canal-mayorista.',
            fields: [
                { name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-MAY-001' },
                { name: 'producto', label: 'Producto (número de serie)', placeholder: 'SN-1234' },
                { name: 'cantidad', label: 'Cantidad', type: 'number', default: '1', mono: false },
                { name: 'precio', label: 'Precio unitario', type: 'number', default: '850', mono: false },
            ],
            button: 'Crear pedido',
            handler: async ({ pedidoId, producto, cantidad, precio }) => {
                const lineas = [{ producto, cantidad: Number(cantidad), precio: Number(precio) }];
                const r = await api('POST', '/api/mayorista/crear-pedido-fabricante', { pedidoId, lineas });
                toast(`Pedido ${pedidoId} enviado al fabricante`);
                logActivity(`Pedido ${pedidoId} creado al fabricante`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Confirmar recepción',
            subtitle: 'Confirma la recepción del envío del fabricante.',
            fields: [{ name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-MAY-001' }],
            button: 'Confirmar',
            handler: async ({ pedidoId }) => {
                const r = await api('POST', '/api/mayorista/confirmar-recepcion-fabricante', { pedidoId });
                toast(`Recepción del pedido ${pedidoId} confirmada`);
                logActivity(`Recepción confirmada del pedido ${pedidoId}`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Aceptar pedido del minorista',
            subtitle: 'Confirma un pedido que ha hecho el minorista.',
            fields: [{ name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-MIN-001' }],
            button: 'Aceptar',
            handler: async ({ pedidoId }) => {
                const r = await api('POST', '/api/mayorista/aceptar-pedido-minorista', { pedidoId });
                toast(`Pedido del minorista ${pedidoId} aceptado`);
                logActivity(`Pedido ${pedidoId} del minorista aceptado`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Registrar envío al minorista',
            subtitle: 'Marca el pedido del minorista como enviado.',
            fields: [
                { name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-MIN-001' },
                { name: 'tracking', label: 'Tracking', placeholder: 'TRK-XYZ' },
            ],
            button: 'Registrar',
            handler: async ({ pedidoId, tracking }) => {
                const r = await api('POST', '/api/mayorista/registrar-envio-minorista', { pedidoId, tracking });
                toast(`Envío al minorista registrado`);
                logActivity(`Envío al minorista del pedido ${pedidoId}`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Transferir custodia al minorista',
            subtitle: 'Transfiere la custodia del producto.',
            fields: [
                { name: 'serie', label: 'Número de serie', placeholder: 'SN-1234' },
                { name: 'destinoMSP', label: 'Destino', type: 'select', options: [
                    { value: 'MinoristaMSP', label: 'MinoristaMSP' },
                ]},
            ],
            button: 'Transferir',
            handler: async ({ serie, destinoMSP }) => {
                const r = await api('POST', '/api/mayorista/transferir-custodia', { serie, destinoMSP });
                toast(`Custodia de ${serie} transferida`);
                logActivity(`Custodia de ${serie} → ${destinoMSP}`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Consultar producto',
            subtitle: 'Estado del producto en canal-trazabilidad.',
            fields: [{ name: 'serie', label: 'Número de serie', placeholder: 'SN-1234' }],
            button: 'Consultar',
            handler: async ({ serie }) => api('GET', `/api/mayorista/producto/${encodeURIComponent(serie)}`),
        })}

        ${actionCard({
            title: 'Consultar pedido (al fabricante)',
            subtitle: 'En canal-mayorista.',
            fields: [{ name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-MAY-001' }],
            button: 'Consultar',
            handler: async ({ pedidoId }) => api('GET', `/api/mayorista/pedido-fabricante/${encodeURIComponent(pedidoId)}`),
        })}

        ${actionCard({
            title: 'Consultar pedido (del minorista)',
            subtitle: 'En canal-minorista.',
            fields: [{ name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-MIN-001' }],
            button: 'Consultar',
            handler: async ({ pedidoId }) => api('GET', `/api/mayorista/pedido-minorista/${encodeURIComponent(pedidoId)}`),
        })}
    </div>
    ${activityPanel()}`;
    renderActivity();
}

function renderMinorista() {
    document.body.dataset.role = 'minorista';
    document.getElementById('main').innerHTML = `
    ${roleHeader('minorista', 'Compra al mayorista, vende al cliente final y gestiona garantías.')}
    <div class="actions">
        ${actionCard({
            title: 'Crear pedido al mayorista',
            subtitle: 'En canal-minorista.',
            fields: [
                { name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-MIN-001' },
                { name: 'producto', label: 'Producto', placeholder: 'SN-1234' },
                { name: 'cantidad', label: 'Cantidad', type: 'number', default: '1', mono: false },
                { name: 'precio', label: 'Precio unitario', type: 'number', default: '1200', mono: false },
            ],
            button: 'Crear pedido',
            handler: async ({ pedidoId, producto, cantidad, precio }) => {
                const lineas = [{ producto, cantidad: Number(cantidad), precio: Number(precio) }];
                const r = await api('POST', '/api/minorista/crear-pedido-mayorista', { pedidoId, lineas });
                toast(`Pedido ${pedidoId} enviado al mayorista`);
                logActivity(`Pedido ${pedidoId} creado al mayorista`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Confirmar recepción',
            subtitle: 'Confirma la recepción del envío del mayorista.',
            fields: [{ name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-MIN-001' }],
            button: 'Confirmar',
            handler: async ({ pedidoId }) => {
                const r = await api('POST', '/api/minorista/confirmar-recepcion-mayorista', { pedidoId });
                toast(`Recepción del pedido ${pedidoId} confirmada`);
                logActivity(`Recepción confirmada del pedido ${pedidoId}`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Activar garantía',
            subtitle: 'Vincula la garantía al cliente final al vender.',
            fields: [
                { name: 'serie', label: 'Número de serie', placeholder: 'SN-1234' },
                { name: 'clienteFinal', label: 'Cliente final', placeholder: 'cliente@email.com' },
                { name: 'meses', label: 'Meses de cobertura', type: 'number', default: '24', mono: false },
            ],
            button: 'Activar',
            handler: async ({ serie, clienteFinal, meses }) => {
                const r = await api('POST', '/api/minorista/activar-garantia',
                    { serie, clienteFinal, meses: Number(meses) });
                toast(`Garantía activada para ${serie}`);
                logActivity(`Garantía activada (${serie} → ${clienteFinal})`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Reclamar garantía',
            subtitle: 'Abre una reclamación contra el fabricante.',
            fields: [
                { name: 'serie', label: 'Número de serie', placeholder: 'SN-1234' },
                { name: 'motivo', label: 'Motivo', type: 'textarea', placeholder: 'Pantalla defectuosa' },
            ],
            button: 'Reclamar',
            handler: async ({ serie, motivo }) => {
                const r = await api('POST', '/api/minorista/reclamar-garantia', { serie, motivo });
                toast(`Reclamación abierta: ${r.reclamacionId}`);
                logActivity(`Reclamación abierta (${serie})`);
                return r;
            },
        })}

        ${actionCard({
            title: 'Consultar producto',
            subtitle: 'Estado del producto.',
            fields: [{ name: 'serie', label: 'Número de serie', placeholder: 'SN-1234' }],
            button: 'Consultar',
            handler: async ({ serie }) => api('GET', `/api/minorista/producto/${encodeURIComponent(serie)}`),
        })}

        ${actionCard({
            title: 'Consultar garantía',
            subtitle: 'Estado de la garantía de un producto.',
            fields: [{ name: 'serie', label: 'Número de serie', placeholder: 'SN-1234' }],
            button: 'Consultar',
            handler: async ({ serie }) => api('GET', `/api/minorista/garantia/${encodeURIComponent(serie)}`),
        })}

        ${actionCard({
            title: 'Consultar pedido',
            subtitle: 'En canal-minorista.',
            fields: [{ name: 'pedidoId', label: 'ID del pedido', placeholder: 'PED-MIN-001' }],
            button: 'Consultar',
            handler: async ({ pedidoId }) => api('GET', `/api/minorista/pedido/${encodeURIComponent(pedidoId)}`),
        })}
    </div>
    ${activityPanel()}`;
    renderActivity();
}

// ──────────────────────────────────────────────────────────────
//   Cliente final (verification)
// ──────────────────────────────────────────────────────────────
function renderCliente() {
    document.body.dataset.role = 'cliente';
    document.getElementById('main').innerHTML = `
    <div class="verify-hero">
        <h2>Verifica tu producto</h2>
        <p>Introduce el número de serie. Te mostraremos su autenticidad, garantía y trayectoria completa hasta tu manos.</p>
        <form class="verify-search" id="verify-form">
            <input type="text" name="serie" class="mono" placeholder="SN-1234" required autofocus />
            <button type="submit">Verificar</button>
        </form>
    </div>
    <div id="verify-output"></div>
    ${activityPanel()}`;
    renderActivity();

    document.getElementById('verify-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const serie = new FormData(e.target).get('serie').trim();
        if (!serie) return;
        const out = document.getElementById('verify-output');
        out.innerHTML = `<div class="verify-card"><p class="meta">Consultando blockchain…</p></div>`;
        await verificarProducto(serie, out);
    });
}

async function verificarProducto(serie, container) {
    const seriEsc = encodeURIComponent(serie);
    // Tres queries en paralelo: producto, garantía, trazabilidad
    const [productoR, garantiaR, trazabilidadR] = await Promise.allSettled([
        api('GET', `/api/public/producto/${seriEsc}`),
        api('GET', `/api/public/garantia/${seriEsc}`),
        api('GET', `/api/public/trazabilidad/${seriEsc}`),
    ]);

    // Caso: producto no existe → posible falsificación
    if (productoR.status === 'rejected' && productoR.reason.status === 404) {
        container.innerHTML = `
        <div class="verify-card error">
            <h3>Resultado</h3>
            <p class="big bad">✗ Producto no encontrado</p>
            <p class="meta">No hay registro del número de serie <code>${escapeHtml(serie)}</code> en blockchain. Este producto podría ser una falsificación. Contacta con el fabricante.</p>
        </div>`;
        logActivity(`Verificación de ${serie}: NO encontrado`, false);
        return;
    }
    if (productoR.status === 'rejected') {
        container.innerHTML = `<div class="verify-card error"><h3>Error</h3><p class="meta">${escapeHtml(productoR.reason.message)}</p></div>`;
        return;
    }

    const producto = productoR.value;
    const garantia = garantiaR.status === 'fulfilled' ? garantiaR.value : null;
    const transferencias = trazabilidadR.status === 'fulfilled'
        ? (trazabilidadR.value.transferencias || []) : [];

    container.innerHTML = `
    <div class="verify-results">
        <div class="verify-card authentic">
            <h3>Autenticidad</h3>
            <p class="big ok">✓ Verificado</p>
            <p class="meta">Producto auténtico, registrado en blockchain por el fabricante.</p>
            <dl>
                <dt>Serie</dt><dd>${escapeHtml(producto.numeroSerie)}</dd>
                <dt>Modelo</dt><dd>${escapeHtml(producto.modelo)}</dd>
                <dt>Lote</dt><dd>${escapeHtml(producto.lote)}</dd>
                <dt>Fabricado</dt><dd>${formatDate(producto.fechaFabricacion)}</dd>
            </dl>
        </div>
        <div class="verify-card warranty">
            <h3>Garantía</h3>
            ${renderGarantia(garantia)}
        </div>
    </div>
    <div class="timeline">
        <h3>Trayectoria del producto (${transferencias.length} transferencias)</h3>
        ${renderTimeline(producto, transferencias)}
    </div>`;
    logActivity(`Verificación de ${serie}: OK`);
}

function renderGarantia(g) {
    if (!g) {
        return `<p class="big" style="color: var(--text-muted)">—</p>
                <p class="meta">No hay garantía activada para este producto.</p>`;
    }
    const fechaExp = new Date(g.fechaExpiracion);
    const ahora = new Date();
    const expirada = fechaExp < ahora;
    return `
        <p class="big ${expirada ? 'bad' : 'ok'}">${expirada ? 'Expirada' : g.estado.charAt(0) + g.estado.slice(1).toLowerCase()}</p>
        <p class="meta">${expirada
            ? 'La garantía ya no está vigente.'
            : 'Cobertura activa hasta ' + formatDate(g.fechaExpiracion) + '.'}</p>
        <dl>
            <dt>Activada</dt><dd>${formatDate(g.fechaActivacion)}</dd>
            <dt>Expira</dt><dd>${formatDate(g.fechaExpiracion)}</dd>
            <dt>Estado</dt><dd>${g.estado}</dd>
        </dl>`;
}

function renderTimeline(producto, transferencias) {
    const items = [];
    items.push(`
        <div class="timeline-item">
            <div class="route">Fabricación · <strong>FabricanteMSP</strong></div>
            <div class="time">${formatDate(producto.fechaFabricacion)}</div>
        </div>`);
    transferencias.forEach(t => {
        items.push(`
        <div class="timeline-item">
            <div class="route">${escapeHtml(t.origen)} <span class="arrow">→</span> <strong>${escapeHtml(t.destino)}</strong></div>
            <div class="time">${formatDate(t.fecha)}</div>
            <div class="tx">tx: ${escapeHtml(t.txID || '')}</div>
        </div>`);
    });
    return `<div class="timeline-list">${items.join('')}</div>`;
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return iso; }
}

// ──────────────────────────────────────────────────────────────
//   Router
// ──────────────────────────────────────────────────────────────
const RENDERERS = {
    fabricante: renderFabricante,
    mayorista: renderMayorista,
    minorista: renderMinorista,
    cliente: renderCliente,
};

function setRole(role) {
    state.role = role;
    document.querySelectorAll('.role-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.role === role);
    });
    if (role && RENDERERS[role]) {
        RENDERERS[role]();
    } else {
        renderWelcome();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Bind tabs
document.getElementById('role-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.role-tab');
    if (btn) setRole(btn.dataset.role);
});

// Expose for inline handlers
window.clearActivity = clearActivity;

// Initial render
renderWelcome();
