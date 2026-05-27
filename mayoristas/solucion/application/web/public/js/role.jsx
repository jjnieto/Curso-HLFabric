// ────────────────────────────────────────────────────────────
//   RAYO — Role workbench. Todas las acciones llaman a la API real.
//   Sin KPIs inventados, sin inventario inventado, sin feed inventado.
// ────────────────────────────────────────────────────────────

// Action specs map to real endpoints. `submit(values)` returns { method, path, body }.
// `successMsg(values, res)` is the toast string. `feedMsg` is what we log to
// session activity (only on success).
const ROLE_CONFIG = {
  fabricante: {
    nav: [
      { id: "actions", label: "Acciones",          ic: Icon.bolt    },
      { id: "query",   label: "Consultas",         ic: Icon.search  },
      { id: "session", label: "Actividad sesión",  ic: Icon.link    },
    ],
    actions: [
      { id: "registrar", ic: Icon.plus, title: "Registrar producto",
        desc: "POST /api/fabricante/registrar-producto",
        fields: [
          { name: "serie",  label: "Número de serie", placeholder: "SN-1234" },
          { name: "modelo", label: "Modelo",          placeholder: "Laptop X" },
          { name: "lote",   label: "Lote",            placeholder: "L001" },
        ],
        submit: (v) => ({ method: "POST", path: "/api/fabricante/registrar-producto", body: v }),
        successMsg: (v) => `Producto ${v.serie} registrado`,
        feedMsg: (v) => `Registrado ${v.serie}` },

      { id: "aceptar", ic: Icon.check, title: "Aceptar pedido del mayorista",
        desc: "POST /api/fabricante/aceptar-pedido",
        fields: [{ name: "pedidoId", label: "ID del pedido", placeholder: "PED-MAY-001" }],
        submit: (v) => ({ method: "POST", path: "/api/fabricante/aceptar-pedido", body: v }),
        successMsg: (v) => `Pedido ${v.pedidoId} aceptado`,
        feedMsg: (v) => `Aceptado ${v.pedidoId}` },

      { id: "envio", ic: Icon.truck, title: "Registrar envío",
        desc: "POST /api/fabricante/registrar-envio",
        fields: [
          { name: "pedidoId", label: "ID del pedido", placeholder: "PED-MAY-001" },
          { name: "tracking", label: "Tracking",      placeholder: "TRK-ABC123" },
        ],
        submit: (v) => ({ method: "POST", path: "/api/fabricante/registrar-envio", body: v }),
        successMsg: (v) => `Envío ${v.tracking} registrado`,
        feedMsg: (v) => `Enviado ${v.pedidoId} (${v.tracking})` },

      { id: "transfer", ic: Icon.send, title: "Transferir custodia",
        desc: "POST /api/fabricante/transferir-custodia",
        fields: [
          { name: "serie",      label: "Número de serie", placeholder: "SN-1234" },
          { name: "destinoMSP", label: "Destino", as: "select", defaultValue: "MayoristaMSP",
            options: [{ value: "MayoristaMSP", label: "MayoristaMSP" }] },
        ],
        submit: (v) => ({ method: "POST", path: "/api/fabricante/transferir-custodia", body: v }),
        successMsg: (v) => `Custodia de ${v.serie} → ${v.destinoMSP}`,
        feedMsg: (v) => `Custodia ${v.serie} → ${v.destinoMSP}` },

      { id: "resolver", ic: Icon.shield, title: "Resolver reclamación",
        desc: "POST /api/fabricante/resolver-reclamacion",
        fields: [
          { name: "reclamacionId", label: "ID reclamación", placeholder: "REC~SN-1234~..." },
          { name: "resolucion",    label: "Resolución",     as: "textarea", placeholder: "Sustituido por unidad nueva" },
          { name: "aceptada",      label: "Decisión", as: "select", defaultValue: "true",
            options: [
              { value: "true",  label: "Aceptar (cubrir garantía)" },
              { value: "false", label: "Rechazar" },
            ] },
        ],
        submit: (v) => ({ method: "POST", path: "/api/fabricante/resolver-reclamacion",
                          body: { ...v, aceptada: v.aceptada === "true" } }),
        successMsg: (v) => `Reclamación ${v.aceptada === "true" ? "aceptada" : "rechazada"}`,
        feedMsg: (v) => `Resuelta ${v.reclamacionId}` },
    ],
    queries: [
      { id: "producto", label: "Consultar producto",
        param: { name: "serie", placeholder: "SN-1234", label: "Número de serie" },
        path: (v) => `/api/fabricante/producto/${encodeURIComponent(v.serie)}`,
        feedMsg: (v) => `Consulta producto ${v.serie}`,
        cacheAsProduct: true,
      },
      { id: "pedido", label: "Consultar pedido (mayorista)",
        param: { name: "id", placeholder: "PED-MAY-001", label: "ID del pedido" },
        path: (v) => `/api/fabricante/pedido/${encodeURIComponent(v.id)}`,
        feedMsg: (v) => `Consulta pedido ${v.id}`,
      },
    ],
  },

  mayorista: {
    nav: [
      { id: "actions", label: "Acciones",          ic: Icon.bolt    },
      { id: "query",   label: "Consultas",         ic: Icon.search  },
      { id: "session", label: "Actividad sesión",  ic: Icon.link    },
    ],
    actions: [
      { id: "po-fab", ic: Icon.plus, title: "Crear pedido al fabricante",
        desc: "POST /api/mayorista/crear-pedido-fabricante",
        fields: [
          { name: "pedidoId", label: "ID del pedido", placeholder: "PED-MAY-001" },
          { name: "producto", label: "Producto (SN)", placeholder: "SN-1234" },
          { name: "cantidad", label: "Cantidad",       type: "number", defaultValue: "1",   mono: false },
          { name: "precio",   label: "Precio unitario", type: "number", defaultValue: "850", mono: false },
        ],
        submit: (v) => ({
          method: "POST", path: "/api/mayorista/crear-pedido-fabricante",
          body: {
            pedidoId: v.pedidoId,
            lineas: [{ producto: v.producto, cantidad: Number(v.cantidad), precio: Number(v.precio) }],
          },
        }),
        successMsg: (v) => `Pedido ${v.pedidoId} enviado al fabricante`,
        feedMsg: (v) => `Pedido ${v.pedidoId} → fabricante` },

      { id: "recv-fab", ic: Icon.check, title: "Confirmar recepción (fabricante)",
        desc: "POST /api/mayorista/confirmar-recepcion-fabricante",
        fields: [{ name: "pedidoId", label: "ID del pedido", placeholder: "PED-MAY-001" }],
        submit: (v) => ({ method: "POST", path: "/api/mayorista/confirmar-recepcion-fabricante", body: v }),
        successMsg: (v) => `Recepción ${v.pedidoId} confirmada`,
        feedMsg: (v) => `Recepción ${v.pedidoId}` },

      { id: "accept-min", ic: Icon.check, title: "Aceptar pedido del minorista",
        desc: "POST /api/mayorista/aceptar-pedido-minorista",
        fields: [{ name: "pedidoId", label: "ID del pedido", placeholder: "PED-MIN-001" }],
        submit: (v) => ({ method: "POST", path: "/api/mayorista/aceptar-pedido-minorista", body: v }),
        successMsg: (v) => `Pedido ${v.pedidoId} aceptado`,
        feedMsg: (v) => `Aceptado ${v.pedidoId}` },

      { id: "ship-min", ic: Icon.truck, title: "Registrar envío al minorista",
        desc: "POST /api/mayorista/registrar-envio-minorista",
        fields: [
          { name: "pedidoId", label: "ID del pedido", placeholder: "PED-MIN-001" },
          { name: "tracking", label: "Tracking",      placeholder: "TRK-XYZ" },
        ],
        submit: (v) => ({ method: "POST", path: "/api/mayorista/registrar-envio-minorista", body: v }),
        successMsg: (v) => `Envío ${v.tracking} registrado`,
        feedMsg: (v) => `Enviado ${v.pedidoId}` },

      { id: "transfer", ic: Icon.send, title: "Transferir custodia",
        desc: "POST /api/mayorista/transferir-custodia",
        fields: [
          { name: "serie",      label: "Número de serie", placeholder: "SN-1234" },
          { name: "destinoMSP", label: "Destino", as: "select", defaultValue: "MinoristaMSP",
            options: [{ value: "MinoristaMSP", label: "MinoristaMSP" }] },
        ],
        submit: (v) => ({ method: "POST", path: "/api/mayorista/transferir-custodia", body: v }),
        successMsg: (v) => `Custodia de ${v.serie} → ${v.destinoMSP}`,
        feedMsg: (v) => `Custodia ${v.serie} → ${v.destinoMSP}` },
    ],
    queries: [
      { id: "producto", label: "Consultar producto",
        param: { name: "serie", placeholder: "SN-1234", label: "Número de serie" },
        path: (v) => `/api/mayorista/producto/${encodeURIComponent(v.serie)}`,
        feedMsg: (v) => `Consulta producto ${v.serie}`,
        cacheAsProduct: true },
      { id: "ped-fab", label: "Consultar pedido al fabricante",
        param: { name: "id", placeholder: "PED-MAY-001", label: "ID del pedido" },
        path: (v) => `/api/mayorista/pedido-fabricante/${encodeURIComponent(v.id)}`,
        feedMsg: (v) => `Consulta pedido-fab ${v.id}` },
      { id: "ped-min", label: "Consultar pedido del minorista",
        param: { name: "id", placeholder: "PED-MIN-001", label: "ID del pedido" },
        path: (v) => `/api/mayorista/pedido-minorista/${encodeURIComponent(v.id)}`,
        feedMsg: (v) => `Consulta pedido-min ${v.id}` },
    ],
  },

  minorista: {
    nav: [
      { id: "actions", label: "Acciones",          ic: Icon.bolt    },
      { id: "query",   label: "Consultas",         ic: Icon.search  },
      { id: "session", label: "Actividad sesión",  ic: Icon.link    },
    ],
    actions: [
      { id: "po-may", ic: Icon.plus, title: "Crear pedido al mayorista",
        desc: "POST /api/minorista/crear-pedido-mayorista",
        fields: [
          { name: "pedidoId", label: "ID del pedido", placeholder: "PED-MIN-001" },
          { name: "producto", label: "Producto (SN)", placeholder: "SN-1234" },
          { name: "cantidad", label: "Cantidad",      type: "number", defaultValue: "1",    mono: false },
          { name: "precio",   label: "Precio unitario", type: "number", defaultValue: "1200", mono: false },
        ],
        submit: (v) => ({
          method: "POST", path: "/api/minorista/crear-pedido-mayorista",
          body: {
            pedidoId: v.pedidoId,
            lineas: [{ producto: v.producto, cantidad: Number(v.cantidad), precio: Number(v.precio) }],
          },
        }),
        successMsg: (v) => `Pedido ${v.pedidoId} enviado al mayorista`,
        feedMsg: (v) => `Pedido ${v.pedidoId} → mayorista` },

      { id: "recv-may", ic: Icon.check, title: "Confirmar recepción (mayorista)",
        desc: "POST /api/minorista/confirmar-recepcion-mayorista",
        fields: [{ name: "pedidoId", label: "ID del pedido", placeholder: "PED-MIN-001" }],
        submit: (v) => ({ method: "POST", path: "/api/minorista/confirmar-recepcion-mayorista", body: v }),
        successMsg: (v) => `Recepción ${v.pedidoId} confirmada`,
        feedMsg: (v) => `Recepción ${v.pedidoId}` },

      { id: "activar", ic: Icon.shield, title: "Activar garantía",
        desc: "POST /api/minorista/activar-garantia",
        fields: [
          { name: "serie",        label: "Número de serie", placeholder: "SN-1234" },
          { name: "clienteFinal", label: "Cliente final",   placeholder: "cliente@email.com", type: "email", mono: false },
          { name: "meses",        label: "Meses de cobertura", type: "number", defaultValue: "24", mono: false },
        ],
        submit: (v) => ({
          method: "POST", path: "/api/minorista/activar-garantia",
          body: { serie: v.serie, clienteFinal: v.clienteFinal, meses: Number(v.meses) },
        }),
        successMsg: (v) => `Garantía activada para ${v.serie}`,
        feedMsg: (v) => `Garantía ${v.serie} → ${v.clienteFinal}` },

      { id: "reclamar", ic: Icon.warn, title: "Reclamar garantía",
        desc: "POST /api/minorista/reclamar-garantia",
        fields: [
          { name: "serie",  label: "Número de serie", placeholder: "SN-1234" },
          { name: "motivo", label: "Motivo", as: "textarea", placeholder: "Pantalla defectuosa" },
        ],
        submit: (v) => ({ method: "POST", path: "/api/minorista/reclamar-garantia", body: v }),
        successMsg: (v, res) => res && res.reclamacionId ? `Reclamación abierta: ${res.reclamacionId}` : `Reclamación abierta`,
        feedMsg: (v, res) => `Reclamación ${res && res.reclamacionId ? res.reclamacionId : v.serie}` },
    ],
    queries: [
      { id: "producto", label: "Consultar producto",
        param: { name: "serie", placeholder: "SN-1234", label: "Número de serie" },
        path: (v) => `/api/minorista/producto/${encodeURIComponent(v.serie)}`,
        feedMsg: (v) => `Consulta producto ${v.serie}`,
        cacheAsProduct: true },
      { id: "garantia", label: "Consultar garantía",
        param: { name: "serie", placeholder: "SN-1234", label: "Número de serie" },
        path: (v) => `/api/minorista/garantia/${encodeURIComponent(v.serie)}`,
        feedMsg: (v) => `Consulta garantía ${v.serie}` },
      { id: "pedido", label: "Consultar pedido",
        param: { name: "id", placeholder: "PED-MIN-001", label: "ID del pedido" },
        path: (v) => `/api/minorista/pedido/${encodeURIComponent(v.id)}`,
        feedMsg: (v) => `Consulta pedido ${v.id}` },
    ],
  },
};

// ── JSON pretty-printer with mild syntax highlighting ─────────
function PrettyJson({ value }) {
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  // Simple highlight via regex on the stringified form
  const html = str.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
    .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="k">$1</span>$2')   // keys
    .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="s">$1</span>')      // string vals
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="n">$1</span>')            // numbers
    .replace(/:\s*(true|false|null)/g, ': <span class="b">$1</span>');       // bools/null
  return <pre className="query-result" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Query panel ─────────────────────────────────────────────
function QueryPanel({ queries, onActivity }) {
  const [active, setActive] = useState(queries[0].id);
  const q = queries.find(x => x.id === active);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const run = async (e) => {
    e.preventDefault();
    const v = { [q.param.name]: inputRef.current.value.trim() };
    if (!v[q.param.name]) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api("GET", q.path(v));
      setResult(r);
      if (q.cacheAsProduct && r && r.numeroSerie) RAYO_SESSION.rememberProduct(r);
      RAYO_SESSION.logActivity({ pill: "QUERY", msg: q.feedMsg(v), ok: true });
      onActivity && onActivity();
    } catch (err) {
      setError(err);
      RAYO_SESSION.logActivity({ pill: "QUERY", msg: `${q.feedMsg(v)} → ${err.message}`, ok: false });
      onActivity && onActivity();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-body" style={{ padding: 18 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {queries.map(qq => (
          <button key={qq.id} type="button"
            className={"btn ghost" + (qq.id === active ? " active" : "")}
            style={{
              padding: "6px 11px", fontSize: 12,
              borderColor: qq.id === active ? "var(--rayo)" : "var(--line)",
              color: qq.id === active ? "var(--text)" : "var(--text-2)",
            }}
            onClick={() => { setActive(qq.id); setResult(null); setError(null); }}>
            {qq.label}
          </button>
        ))}
      </div>
      <form onSubmit={run} style={{ display: "flex", gap: 8 }}>
        <input ref={inputRef}
               className="mono"
               placeholder={q.param.placeholder}
               aria-label={q.param.label}
               style={{
                 flex: 1, fontFamily: "var(--font-mono)", fontSize: 13.5,
                 background: "var(--surface-2)", border: "1px solid var(--line)",
                 color: "var(--text)", padding: "10px 12px", borderRadius: 8,
               }} />
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon.search />}
          <span>{busy ? "Consultando…" : "Consultar"}</span>
        </button>
      </form>
      {error && (
        <div className="query-result err">
          <strong>{error.status || "ERROR"}</strong> · {error.message}
        </div>
      )}
      {result && <PrettyJson value={result} />}
    </div>
  );
}

// ── Session activity panel ──────────────────────────────────
function SessionActivity({ activity, onClear }) {
  if (!activity.length) {
    return (
      <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Sin actividad en esta sesión todavía.<br/>
        Ejecuta una acción o consulta para verla aquí.
      </div>
    );
  }
  return (
    <React.Fragment>
      <ul className="feed-list">
        {activity.slice(0, 30).map((a, i) => (
          <li key={a.ts + ":" + i} className="feed-item">
            <span className={"st" + (a.ok ? "" : " err")} />
            <span className="t">{relative(new Date(a.ts).toISOString())}</span>
            <span className="m">
              <span className="pill">{a.pill}</span>
              {a.msg}
            </span>
          </li>
        ))}
      </ul>
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--line)", textAlign: "right" }}>
        <button type="button" onClick={onClear}
                style={{ background: "transparent", border: 0, color: "var(--text-3)",
                         fontSize: 11.5, fontFamily: "var(--font-mono)", cursor: "pointer",
                         letterSpacing: "0.08em" }}>
          Limpiar actividad
        </button>
      </div>
    </React.Fragment>
  );
}

// ── Action drawer (real POST) ───────────────────────────────
function ActionDrawer({ action, role, onClose, onDone }) {
  const formRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!action) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const data = Object.fromEntries(new FormData(formRef.current));
    try {
      const req = action.submit(data);
      const res = await api(req.method, req.path, req.body);
      const msg = action.successMsg(data, res);
      RAYO_SESSION.logActivity({
        pill: action.id.toUpperCase(),
        msg: action.feedMsg(data, res),
        ok: true,
      });
      toast(msg);
      onDone();
      onClose();
    } catch (err) {
      setError(err);
      RAYO_SESSION.logActivity({
        pill: action.id.toUpperCase(),
        msg: `${action.feedMsg(data)} → ${err.message}`,
        ok: false,
      });
      toast(err.message, "err");
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={!!action}
      onClose={onClose}
      title={action.title}
      sub={action.desc}
      footer={
        <React.Fragment>
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" disabled={busy}
                  onClick={() => formRef.current.requestSubmit()}>
            {busy ? <span className="spinner" /> : <Icon.bolt />}
            <span>{busy ? "Firmando…" : "Firmar y enviar"}</span>
          </button>
        </React.Fragment>
      }
    >
      <form ref={formRef} onSubmit={submit}>
        {action.fields.map(f => <Field key={f.name} {...f} />)}
      </form>
      {error && (
        <div className="query-result err" style={{ marginTop: 16 }}>
          <strong>{error.status || "ERROR"}</strong> · {error.message}
        </div>
      )}
      <div style={{ marginTop: 18, padding: "12px 14px",
                    background: "var(--surface-2)", borderRadius: 8, fontSize: 12 }}>
        <div className="mono dim" style={{ fontSize: 10.5, letterSpacing: "0.16em",
             textTransform: "uppercase", marginBottom: 6 }}>chaincode</div>
        <div className="mono" style={{ color: "var(--text-2)" }}>
          fabric.submit(<span style={{ color: "var(--rayo)" }}>{action.desc.split(" ")[1]}</span>)
          · confirmación de peers
        </div>
      </div>
    </Drawer>
  );
}

// ── Role view ────────────────────────────────────────────────
function RoleView({ role }) {
  const cfg = ROLE_CONFIG[role];
  const [drawer, setDrawer] = useState(null);
  const [, bump] = useSession();

  if (!cfg) return null;

  const cachedProducts = RAYO_SESSION.cachedProducts();

  return (
    <div className="page" data-screen-label={
      role === "fabricante" ? "02 Fabricante" :
      role === "mayorista"  ? "03 Mayorista"  : "04 Minorista"
    }>
      <div className="role-header" data-role={role}>
        <div className="role-title">
          <div className="role-avatar">{ROLE_LABEL[role][0]}</div>
          <div>
            <h2>{ROLE_LABEL[role]}</h2>
            <p>{ROLE_INTRO[role]}</p>
          </div>
        </div>
        <div className="role-msp"><span className="ic" />{MSP_BY_ROLE[role]}</div>
      </div>

      <div className="workbench">
        <aside className="sidebar">
          <div className="sidebar-section">
            <h5>Operación</h5>
            {cfg.nav.map((n, i) => (
              <div key={n.id} className={"sidebar-item" + (i === 0 ? " active" : "")}>
                <span className="ic"><n.ic /></span>
                <span>{n.label}</span>
              </div>
            ))}
          </div>
          <div className="sidebar-section">
            <h5>Red Fabric</h5>
            <div className="sidebar-item">
              <span className="ic"><Icon.link /></span>
              <span>3 canales activos</span>
            </div>
            <div className="sidebar-item">
              <span className="ic"><Icon.shield /></span>
              <span>{MSP_BY_ROLE[role]}</span>
            </div>
          </div>
          {cachedProducts.length > 0 && (
            <div className="sidebar-section">
              <h5>Consultados ({cachedProducts.length})</h5>
              {cachedProducts.slice(0, 6).map(p => (
                <div key={p.numeroSerie} className="sidebar-item">
                  <span className="ic"><Icon.package /></span>
                  <span className="mono" style={{ fontSize: 12 }}>{p.numeroSerie}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main>
          <div className="dash">
            <Panel title="Acciones" meta="firma en blockchain">
              <div className="action-grid" style={{ padding: 16 }}>
                {cfg.actions.map(a => (
                  <button key={a.id} type="button" className="action"
                          onClick={() => setDrawer({ ...a, role })}>
                    <span className="ic"><a.ic /></span>
                    <h4>{a.title}</h4>
                    <p>{a.desc}</p>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Actividad de esta sesión"
                   meta={`${RAYO_SESSION.activity.length} eventos · solo esta pestaña`}>
              <SessionActivity activity={RAYO_SESSION.activity} onClear={() => { RAYO_SESSION.clear(); bump(); }} />
            </Panel>
          </div>

          <div style={{ marginTop: 14 }}>
            <Panel title="Consultas al ledger"
                   meta="GET en directo">
              <QueryPanel queries={cfg.queries} onActivity={bump} />
            </Panel>
          </div>
        </main>
      </div>

      <ActionDrawer
        action={drawer}
        role={role}
        onClose={() => setDrawer(null)}
        onDone={bump}
      />
    </div>
  );
}

window.RoleView = RoleView;
