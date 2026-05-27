// ────────────────────────────────────────────────────────────
//   RAYO — Shared UI primitives
// ────────────────────────────────────────────────────────────
// Exponer hooks en window para que los demás scripts text/babel puedan usarlos.
// Top-level `const` queda en script scope (no global), así que sin esto los
// otros .jsx ven `useState is not defined` y React no llega a montar nada.
const { useState, useEffect, useRef, useMemo, useCallback } = React;
window.useState    = useState;
window.useEffect   = useEffect;
window.useRef      = useRef;
window.useMemo     = useMemo;
window.useCallback = useCallback;

// ── Logo / mark ──────────────────────────────────────────────
function RayoMark({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M14.5 2 L5.2 13.4 L11 13.4 L9.5 22 L18.8 10.6 L13 10.6 Z"
            fill="white" stroke="white" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

function Brand({ onClick }) {
  return (
    <div className="brand" onClick={onClick} role="button" tabIndex={0}>
      <div className="brand-mark"><RayoMark /></div>
      <div>
        <div className="brand-word">RAYO<span className="dot">.</span></div>
        <div className="brand-sub">trazabilidad · hyperledger fabric</div>
      </div>
    </div>
  );
}

// ── Topbar ───────────────────────────────────────────────────
function Topbar({ role, onRole, health }) {
  const tabs = ["fabricante", "mayorista", "minorista", "cliente"];
  const ok = health.status === "ok";
  const checking = health.status === "checking";
  return (
    <header className="topbar">
      <Brand onClick={() => onRole(null)} />
      <nav className="role-tabs" aria-label="Rol">
        {tabs.map(r => (
          <button key={r} type="button"
            className={"role-tab" + (role === r ? " active" : "")}
            data-role={r}
            onClick={() => onRole(r)}>
            <span className="role-dot" />
            <span>{ROLE_LABEL[r]}</span>
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        <span className={"live-dot" + (ok ? "" : checking ? " warn" : " err")} />
        <span>
          {checking ? "comprobando red…" :
           ok       ? "red operativa" :
                      "red no disponible"}
        </span>
        {ok && health.orgs && (
          <React.Fragment>
            <span style={{ color: "var(--text-3)" }}>·</span>
            <span>{health.orgs.length} orgs</span>
          </React.Fragment>
        )}
      </div>
    </header>
  );
}

// ── Icons ────────────────────────────────────────────────────
const Icon = {
  plus:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  send:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-8-8 18-2-8-8-2Z"/></svg>,
  check:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5 11-11"/></svg>,
  warn:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/></svg>,
  arrow:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  search:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  truck:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7"/><circle cx="6" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>,
  package: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>,
  shield:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>,
  bolt:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>,
  doc:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>,
  link:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>,
  refresh: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/></svg>,
};

// ── Panel shell ──────────────────────────────────────────────
function Panel({ title, meta, children, right }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {right ? right : (meta && <span className="meta">{meta}</span>)}
      </div>
      {children}
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────
const toastEl = () => document.getElementById("toast");
let _toastTO;
function toast(msg, kind = "ok") {
  const el = toastEl();
  if (!el) return;
  clearTimeout(_toastTO);
  el.classList.toggle("err", kind === "err");
  el.querySelector(".msg").textContent = msg;
  el.classList.add("show");
  _toastTO = setTimeout(() => el.classList.remove("show"), 2800);
}

// ── Drawer ───────────────────────────────────────────────────
function Drawer({ open, onClose, title, sub, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <React.Fragment>
      <div className="drawer-back" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <header className="drawer-head">
          <div>
            <div className="mono dim" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              acción
            </div>
            <h3>{title}</h3>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </React.Fragment>
  );
}

// ── Field ────────────────────────────────────────────────────
function Field({ label, name, defaultValue = "", placeholder, type = "text", as = "input", options, required = true, mono = true }) {
  if (as === "textarea") {
    return (
      <div className="field">
        <label htmlFor={name}>{label}</label>
        <textarea id={name} name={name} rows="3" defaultValue={defaultValue}
                  placeholder={placeholder} required={required} className={mono ? "mono" : ""} />
      </div>
    );
  }
  if (as === "select") {
    return (
      <div className="field">
        <label htmlFor={name}>{label}</label>
        <select id={name} name={name} defaultValue={defaultValue}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue}
             placeholder={placeholder} required={required} className={mono ? "mono" : ""} />
    </div>
  );
}

// ── /api/health hook ─────────────────────────────────────────
// Estado real de la red. Polled cada 10s.
function useHealth() {
  const [h, setH] = useState({ status: "checking", orgs: [] });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await api("GET", "/api/health");
        if (!alive) return;
        setH({ status: "ok", orgs: r.orgs || [] });
      } catch (e) {
        if (!alive) return;
        setH({ status: "err", orgs: [], error: e.message });
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return h;
}

// ── Hook: re-render on session activity change ───────────────
function useSession() {
  const [v, force] = useState(0);
  const bump = useCallback(() => force(x => x + 1), []);
  return [RAYO_SESSION, bump];
}

Object.assign(window, {
  RayoMark, Brand, Topbar, Icon, Panel,
  Drawer, Field, toast,
  useHealth, useSession,
});
