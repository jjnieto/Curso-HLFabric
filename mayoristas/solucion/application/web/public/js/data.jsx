// ────────────────────────────────────────────────────────────
//   RAYO — API client + sesión local. CERO datos inventados.
//   Todo lo que se muestra viene de la API o de las acciones
//   reales hechas en esta pestaña.
// ────────────────────────────────────────────────────────────

const ROLE_LABEL = {
  fabricante: "Fabricante",
  mayorista: "Mayorista",
  minorista: "Minorista",
  cliente: "Cliente final",
};

const MSP_BY_ROLE = {
  fabricante: "FabricanteMSP",
  mayorista: "MayoristaMSP",
  minorista: "MinoristaMSP",
};

const ROLE_INTRO = {
  fabricante: "Registra unidades, firma pedidos del mayorista y resuelve garantías.",
  mayorista:  "Compras al fabricante, vendes al minorista, custodia intermedia firmada.",
  minorista:  "Vendes al consumidor final, activas garantías y gestionas reclamaciones.",
  cliente:    "Verifica la autenticidad y trazabilidad de cualquier producto en segundos.",
};

// ── HTTP helper ──────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
  };
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

// ── Helpers ──────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}
function relative(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 5)         return `ahora`;
  if (s < 60)        return `hace ${s}s`;
  if (s < 3600)      return `hace ${Math.round(s / 60)}m`;
  if (s < 86400)     return `hace ${Math.round(s / 3600)}h`;
  return `hace ${Math.round(s / 86400)}d`;
}

// ── Sesión local (NO inventa nada) ───────────────────────────
// Guarda solo las acciones REALES hechas por el usuario en esta tab
// y los productos/pedidos consultados (para no perderlos al cambiar de pantalla).
const STORAGE_KEY = "rayo.session.v1";

const RAYO_SESSION = (() => {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { raw = {}; }
  return {
    activity: Array.isArray(raw.activity) ? raw.activity : [],
    productCache: raw.productCache || {},  // serie → ultimo objeto producto recibido
    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          activity: this.activity.slice(0, 60),
          productCache: this.productCache,
        }));
      } catch { /* quota? noop */ }
    },
    logActivity(item) {
      this.activity.unshift({ ts: Date.now(), ok: true, ...item });
      this.activity = this.activity.slice(0, 60);
      this.save();
    },
    rememberProduct(p) {
      if (!p || !p.numeroSerie) return;
      this.productCache[p.numeroSerie] = { ...p, _seenAt: Date.now() };
      this.save();
    },
    cachedProducts() {
      return Object.values(this.productCache)
        .sort((a, b) => (b._seenAt || 0) - (a._seenAt || 0));
    },
    clear() {
      this.activity = [];
      this.productCache = {};
      this.save();
    },
  };
})();

window.api = api;
window.RAYO_SESSION = RAYO_SESSION;
window.ROLE_LABEL = ROLE_LABEL;
window.MSP_BY_ROLE = MSP_BY_ROLE;
window.ROLE_INTRO = ROLE_INTRO;
window.formatDate = formatDate;
window.relative = relative;
