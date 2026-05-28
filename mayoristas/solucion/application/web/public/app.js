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

// ══════════════════════════════════════════════════════════════
//   DASHBOARD — kanban + secciones agregadas + drawer de detalle
// ══════════════════════════════════════════════════════════════
function fmtMoney(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}
function pedidoImporte(p) {
    if (!Array.isArray(p.lineas)) return 0;
    return p.lineas.reduce((sum, l) => sum + (l.cantidad || 0) * (l.precio || 0), 0);
}
function pedidoUnidades(p) {
    if (!Array.isArray(p.lineas)) return 0;
    return p.lineas.reduce((sum, l) => sum + (l.cantidad || 0), 0);
}

async function renderDashboard() {
    document.body.dataset.role = 'dashboard';
    document.getElementById('main').innerHTML = `
    <div class="dashboard-hero">
        <div>
            <h1>Tu blockchain en vivo</h1>
            <p>Vista agregada del estado de la red en tiempo real. Haz clic en cualquier tarjeta para ver el detalle.</p>
        </div>
        <button class="dashboard-refresh" id="dashboard-refresh" type="button">
            <span>↻</span> Refrescar
        </button>
    </div>
    <div id="dashboard-body">
        <p style="text-align:center; color:var(--text-muted); padding:60px 0;">Cargando datos del ledger…</p>
    </div>`;

    document.getElementById('dashboard-refresh').addEventListener('click', () => loadDashboard(true));
    await loadDashboard(false);
}

async function loadDashboard(showToast) {
    const body = document.getElementById('dashboard-body');
    const refreshBtn = document.getElementById('dashboard-refresh');
    if (refreshBtn) refreshBtn.disabled = true;
    try {
        const data = await api('GET', '/api/dashboard');
        renderDashboardBody(body, data);
        if (showToast) toast('Datos actualizados');
    } catch (err) {
        body.innerHTML = `<p style="text-align:center; color:var(--c-danger); padding:40px;">
            Error cargando dashboard: ${escapeHtml(err.message)}</p>`;
    } finally {
        if (refreshBtn) refreshBtn.disabled = false;
    }
}

function renderDashboardBody(container, data) {
    const todosLosPedidos = [
        ...data.pedidosMayorista.map(p => ({ ...p, canal: 'mayorista' })),
        ...data.pedidosMinorista.map(p => ({ ...p, canal: 'minorista' })),
    ];
    const reclamacionesAbiertas = data.reclamaciones.filter(r => r.estado === 'ABIERTA').length;

    container.innerHTML = `
    <div class="stats">
        <div class="stat">
            <div class="stat-label">Productos</div>
            <div class="stat-value">${data.productos.length}</div>
            <div class="stat-sub">en el catálogo</div>
        </div>
        <div class="stat">
            <div class="stat-label">Pedidos</div>
            <div class="stat-value">${todosLosPedidos.length}</div>
            <div class="stat-sub">${data.pedidosMayorista.length} mayorista · ${data.pedidosMinorista.length} minorista</div>
        </div>
        <div class="stat">
            <div class="stat-label">Garantías</div>
            <div class="stat-value">${data.garantias.length}</div>
            <div class="stat-sub">activadas</div>
        </div>
        <div class="stat">
            <div class="stat-label">Reclamaciones</div>
            <div class="stat-value">${data.reclamaciones.length}</div>
            <div class="stat-sub">${reclamacionesAbiertas} abierta${reclamacionesAbiertas === 1 ? '' : 's'}</div>
        </div>
    </div>

    <div class="section-header">
        <h2>Pedidos por estado</h2>
        <span class="section-sub">${todosLosPedidos.length} pedidos · clic para ver detalle</span>
    </div>
    ${renderKanban(todosLosPedidos)}

    <div class="section-header">
        <h2>Productos en catálogo</h2>
        <span class="section-sub">${data.productos.length} unidades</span>
    </div>
    ${renderProductosGrid(data.productos)}

    <div class="section-header">
        <h2>Garantías</h2>
        <span class="section-sub">${data.garantias.length} activadas</span>
    </div>
    ${renderGarantiasGrid(data.garantias)}

    ${data.reclamaciones.length > 0 ? `
        <div class="section-header">
            <h2>Reclamaciones</h2>
            <span class="section-sub">${data.reclamaciones.length} en total</span>
        </div>
        ${renderReclamacionesGrid(data.reclamaciones)}
    ` : ''}`;

    // Click en card de pedido
    container.querySelectorAll('.card-pedido').forEach(el => {
        el.addEventListener('click', () => openPedidoDrawer(el.dataset.id));
    });
    // Click en producto
    container.querySelectorAll('.card-producto').forEach(el => {
        el.addEventListener('click', () => openProductoDrawer(el.dataset.serie));
    });
    // Click en garantía → muestra el producto
    container.querySelectorAll('.card-garantia').forEach(el => {
        el.addEventListener('click', () => openProductoDrawer(el.dataset.serie));
    });
    // Click en reclamación → muestra el producto asociado
    container.querySelectorAll('.card-reclamacion').forEach(el => {
        el.addEventListener('click', () => openProductoDrawer(el.dataset.serie));
    });
}

function renderKanban(pedidos) {
    const ESTADOS = ['CREADO', 'ACEPTADO', 'ENVIADO', 'RECIBIDO'];
    const cols = ESTADOS.map(estado => {
        const items = pedidos
            .filter(p => p.estado === estado)
            .sort((a, b) => (b.fechaActualizacion || '').localeCompare(a.fechaActualizacion || ''));
        return `
        <div class="kanban-col" data-state="${estado}">
            <div class="kanban-col-header">
                <span class="kanban-col-title">
                    <span class="pill-state"></span>${estado}
                </span>
                <span class="kanban-col-count">${items.length}</span>
            </div>
            <div class="kanban-cards">
                ${items.length === 0
                    ? '<div class="kanban-empty">—</div>'
                    : items.map(p => renderPedidoCard(p)).join('')}
            </div>
        </div>`;
    }).join('');
    return `<div class="kanban">${cols}</div>`;
}

function renderPedidoCard(p) {
    const flow = p.canal === 'mayorista'
        ? `<strong>Mayorista</strong> → Fabricante`
        : `<strong>Minorista</strong> → Mayorista`;
    return `
    <div class="card-pedido" data-id="${escapeHtml(p.id)}">
        <div class="card-pedido-head">
            <span class="card-pedido-id" title="${escapeHtml(p.id)}">${escapeHtml(p.id)}</span>
            <span class="card-pedido-channel ${p.canal}">${p.canal}</span>
        </div>
        <div class="card-pedido-flow">${flow}</div>
        <div class="card-pedido-meta">
            <span class="lines">${pedidoUnidades(p)} ud · ${p.lineas?.length || 0} línea${p.lineas?.length === 1 ? '' : 's'}</span>
            <span class="total">${fmtMoney(pedidoImporte(p))}</span>
        </div>
    </div>`;
}

function renderProductosGrid(productos) {
    if (productos.length === 0) {
        return '<p style="color:var(--text-muted); padding:16px 0;">Sin productos en el catálogo.</p>';
    }
    return `<div class="cards-grid">${productos
        .sort((a, b) => (b.fechaFabricacion || '').localeCompare(a.fechaFabricacion || ''))
        .map(p => `
            <div class="card-mini card-producto" data-serie="${escapeHtml(p.numeroSerie)}">
                <div class="card-mini-head">
                    <span>${escapeHtml(p.numeroSerie)}</span>
                    <span class="badge badge-${p.estado}">${p.estado.replace('_', ' ')}</span>
                </div>
                <div class="card-mini-title">${escapeHtml(p.modelo)}</div>
                <div class="card-mini-sub">Lote ${escapeHtml(p.lote)} · ${escapeHtml(p.propietarioActual)}</div>
            </div>
        `).join('')}</div>`;
}

function renderGarantiasGrid(garantias) {
    if (garantias.length === 0) {
        return '<p style="color:var(--text-muted); padding:16px 0;">Aún no se han activado garantías.</p>';
    }
    return `<div class="cards-grid">${garantias
        .sort((a, b) => (b.fechaActivacion || '').localeCompare(a.fechaActivacion || ''))
        .map(g => `
            <div class="card-mini card-garantia" data-serie="${escapeHtml(g.numeroSerie)}">
                <div class="card-mini-head">
                    <span>${escapeHtml(g.numeroSerie)}</span>
                    <span class="badge badge-${g.estado}">${g.estado}</span>
                </div>
                <div class="card-mini-title" style="font-size:13px; font-weight:500;">${escapeHtml(g.clienteFinal)}</div>
                <div class="card-mini-sub">Hasta ${formatDate(g.fechaExpiracion)}</div>
            </div>
        `).join('')}</div>`;
}

function renderReclamacionesGrid(reclamaciones) {
    return `<div class="cards-grid">${reclamaciones
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
        .map(r => `
            <div class="card-mini card-reclamacion" data-serie="${escapeHtml(r.numeroSerie)}">
                <div class="card-mini-head">
                    <span>${escapeHtml(r.numeroSerie)}</span>
                    <span class="badge badge-${r.estado}">${r.estado}</span>
                </div>
                <div class="card-mini-title" style="font-size:13px; font-weight:500;">${escapeHtml(r.motivo)}</div>
                <div class="card-mini-sub">${formatDate(r.fecha)}${r.resolucion ? ' · ' + escapeHtml(r.resolucion) : ''}</div>
            </div>
        `).join('')}</div>`;
}

// ══════════════════════════════════════════════════════════════
//   DRAWER — detalle de pedido/producto
// ══════════════════════════════════════════════════════════════
function showDrawer(html) {
    document.getElementById('drawer-content').innerHTML = html;
    document.getElementById('drawer').hidden = false;
    document.getElementById('drawer-overlay').hidden = false;
    requestAnimationFrame(() => {
        document.getElementById('drawer').classList.add('open');
        document.getElementById('drawer-overlay').classList.add('open');
        document.body.classList.add('drawer-open');
    });
}
function closeDrawer() {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.classList.remove('drawer-open');
    setTimeout(() => { drawer.hidden = true; overlay.hidden = true; }, 250);
}

async function openPedidoDrawer(pedidoId) {
    showDrawer(`<p style="text-align:center; color:var(--text-muted); padding:60px 0;">Cargando pedido…</p>`);
    try {
        const p = await api('GET', `/api/pedido/${encodeURIComponent(pedidoId)}`);
        const importe = pedidoImporte(p);
        const flow = p.canal === 'canal-mayorista'
            ? 'Mayorista → Fabricante'
            : 'Minorista → Mayorista';
        showDrawer(`
            <div class="drawer-header">
                <div>
                    <h2>${escapeHtml(p.id)}</h2>
                    <p>${flow} · ${p.canal}</p>
                </div>
                <button class="drawer-close" onclick="closeDrawer()" aria-label="Cerrar">×</button>
            </div>

            <div class="drawer-section">
                <h3>Estado</h3>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="badge badge-${p.estado}" style="font-size:12px; padding:4px 12px;">${p.estado}</span>
                    <span style="color:var(--text-muted); font-size:13px;">${formatDate(p.fechaActualizacion)}</span>
                </div>
            </div>

            <div class="drawer-section">
                <h3>Partes</h3>
                <dl class="kv">
                    <dt>Comprador</dt><dd>${escapeHtml(p.comprador || '—')}</dd>
                    <dt>Vendedor</dt><dd>${escapeHtml(p.vendedor || 'pendiente de aceptar')}</dd>
                    ${p.tracking ? `<dt>Tracking</dt><dd>${escapeHtml(p.tracking)}</dd>` : ''}
                    <dt>Creado</dt><dd>${formatDate(p.fechaCreacion)}</dd>
                </dl>
            </div>

            <div class="drawer-section">
                <h3>Líneas (${p.lineas?.length || 0})</h3>
                <div class="drawer-lines">
                    ${(p.lineas || []).map(l => `
                        <div class="drawer-lines-line">
                            <a href="#" data-serie="${escapeHtml(l.producto)}" class="drawer-product-link">${escapeHtml(l.producto)}</a>
                            <span class="qp">${l.cantidad} × ${fmtMoney(l.precio)}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align:right; margin-top:10px; font-size:14px;">
                    Total: <strong style="font-family:var(--font-mono);">${fmtMoney(importe)}</strong>
                </div>
            </div>

            <div class="drawer-section">
                <h3>Timeline</h3>
                ${renderPedidoTimeline(p)}
            </div>
        `);
        document.querySelectorAll('.drawer-product-link').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                openProductoDrawer(a.dataset.serie);
            });
        });
    } catch (err) {
        showDrawer(`
            <div class="drawer-header">
                <div><h2>Error</h2></div>
                <button class="drawer-close" onclick="closeDrawer()">×</button>
            </div>
            <p style="color:var(--c-danger); padding:16px 0;">${escapeHtml(err.message)}</p>`);
    }
}

function renderPedidoTimeline(p) {
    const ESTADOS = ['CREADO', 'ACEPTADO', 'ENVIADO', 'RECIBIDO'];
    const currentIdx = ESTADOS.indexOf(p.estado);
    return `<div class="timeline"><div class="timeline-list">${
        ESTADOS.map((estado, i) => {
            const done = i <= currentIdx;
            const isCurrent = i === currentIdx;
            const color = done ? 'var(--c-success)' : 'var(--border)';
            return `
                <div class="timeline-item" style="opacity:${done ? 1 : 0.4};">
                    <div class="route" style="font-size:14px;">
                        ${estado}${isCurrent ? '  ← actual' : ''}
                    </div>
                    <div class="time">${i === 0 ? formatDate(p.fechaCreacion) : (done ? formatDate(p.fechaActualizacion) : 'pendiente')}</div>
                </div>`;
        }).join('')}</div></div>`;
}

async function openProductoDrawer(serie) {
    showDrawer(`<p style="text-align:center; color:var(--text-muted); padding:60px 0;">Cargando producto…</p>`);
    try {
        const d = await api('GET', `/api/producto/${encodeURIComponent(serie)}/detalle`);
        const { producto, transferencias, garantia } = d;
        showDrawer(`
            <div class="drawer-header">
                <div>
                    <h2>${escapeHtml(producto.numeroSerie)}</h2>
                    <p>${escapeHtml(producto.modelo)} · lote ${escapeHtml(producto.lote)}</p>
                </div>
                <button class="drawer-close" onclick="closeDrawer()">×</button>
            </div>

            <div class="drawer-section">
                <h3>Estado actual</h3>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    <span class="badge badge-${producto.estado}">${producto.estado.replace('_', ' ')}</span>
                </div>
                <dl class="kv">
                    <dt>Propietario</dt><dd>${escapeHtml(producto.propietarioActual)}</dd>
                    <dt>Fabricado</dt><dd>${formatDate(producto.fechaFabricacion)}</dd>
                </dl>
            </div>

            <div class="drawer-section">
                <h3>Trazabilidad (${transferencias.length} transferencia${transferencias.length === 1 ? '' : 's'})</h3>
                <div class="timeline" style="padding:16px;">
                    <div class="timeline-list">
                        <div class="timeline-item">
                            <div class="route">Fabricación · <strong>FabricanteMSP</strong></div>
                            <div class="time">${formatDate(producto.fechaFabricacion)}</div>
                        </div>
                        ${transferencias.map(t => `
                            <div class="timeline-item">
                                <div class="route">${escapeHtml(t.origen)} <span class="arrow">→</span> <strong>${escapeHtml(t.destino)}</strong></div>
                                <div class="time">${formatDate(t.fecha)}</div>
                                <div class="tx">tx: ${escapeHtml(t.txID || '')}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="drawer-section">
                <h3>Garantía</h3>
                ${garantia ? `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <span class="badge badge-${garantia.estado}">${garantia.estado}</span>
                    </div>
                    <dl class="kv">
                        <dt>Cliente</dt><dd>${escapeHtml(garantia.clienteFinal)}</dd>
                        <dt>Activada</dt><dd>${formatDate(garantia.fechaActivacion)}</dd>
                        <dt>Expira</dt><dd>${formatDate(garantia.fechaExpiracion)}</dd>
                    </dl>
                ` : '<p style="color:var(--text-muted); font-size:13px;">Sin garantía activada todavía.</p>'}
            </div>
        `);
    } catch (err) {
        showDrawer(`
            <div class="drawer-header">
                <div><h2>Error</h2></div>
                <button class="drawer-close" onclick="closeDrawer()">×</button>
            </div>
            <p style="color:var(--c-danger); padding:16px 0;">${escapeHtml(err.message)}</p>`);
    }
}

window.closeDrawer = closeDrawer;

// ──────────────────────────────────────────────────────────────
//   Router
// ──────────────────────────────────────────────────────────────
const RENDERERS = {
    dashboard: renderDashboard,
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
    closeDrawer();
    if (role && RENDERERS[role]) {
        RENDERERS[role]();
    } else {
        renderDashboard();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Bind tabs
document.getElementById('role-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.role-tab');
    if (btn) setRole(btn.dataset.role);
});

// Click on overlay or Escape to close drawer
document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
});

// Expose for inline handlers
window.clearActivity = clearActivity;

// Initial render: dashboard
setRole('dashboard');
