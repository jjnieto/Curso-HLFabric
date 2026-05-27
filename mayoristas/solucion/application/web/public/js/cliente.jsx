// ────────────────────────────────────────────────────────────
//   RAYO — Cliente final. 3 fetch reales:
//   GET /api/public/producto/:serie
//   GET /api/public/garantia/:serie
//   GET /api/public/trazabilidad/:serie
// ────────────────────────────────────────────────────────────

function ClienteView() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const verify = async (serieRaw) => {
    const serie = (serieRaw != null ? serieRaw : query).trim().toUpperCase();
    if (!serie) return;
    setQuery(serie);
    setBusy(true);
    setResult(null);

    const seriEnc = encodeURIComponent(serie);
    // Tres queries en paralelo. Todas reales.
    const [productoR, garantiaR, trazaR] = await Promise.allSettled([
      api("GET", `/api/public/producto/${seriEnc}`),
      api("GET", `/api/public/garantia/${seriEnc}`),
      api("GET", `/api/public/trazabilidad/${seriEnc}`),
    ]);

    // Producto no existe → potencial falsificación
    if (productoR.status === "rejected" && productoR.reason.status === 404) {
      setResult({ notFound: true, serie });
      RAYO_SESSION.logActivity({ pill: "VERIFY", msg: `${serie} → NO ENCONTRADO`, ok: false });
      setBusy(false);
      return;
    }
    // Otro error → mostrar el error real
    if (productoR.status === "rejected") {
      setResult({ error: true, message: productoR.reason.message, serie });
      RAYO_SESSION.logActivity({ pill: "VERIFY", msg: `${serie} → ${productoR.reason.message}`, ok: false });
      setBusy(false);
      return;
    }

    const producto = productoR.value;
    // Garantía puede no existir (404) — eso es OK
    const garantia = garantiaR.status === "fulfilled" ? garantiaR.value : null;
    // Trazabilidad: puede fallar; lo mostramos vacío si así
    const transferencias = trazaR.status === "fulfilled"
      ? (trazaR.value.transferencias || [])
      : [];

    // Recordamos el producto para que aparezca en el sidebar del rol
    RAYO_SESSION.rememberProduct(producto);
    RAYO_SESSION.logActivity({ pill: "VERIFY", msg: `${serie} → OK`, ok: true });

    setResult({ producto, garantia, transferencias });
    setBusy(false);
  };

  const onSubmit = (e) => { e.preventDefault(); verify(); };

  return (
    <div className="page" data-screen-label="05 Cliente">
      <section className="verify-stage">
        <div className="verify-eyebrow">— pública · sin sesión · firmada en blockchain —</div>
        <h2>Verifica tu producto<br/>en <span className="accent">segundos.</span></h2>
        <p className="lede">
          Introduce o escanea el número de serie. Te devolvemos autenticidad, garantía y
          la trayectoria completa hasta tus manos — todo leído del ledger en directo.
        </p>

        <form className="scanner" onSubmit={onSubmit}>
          <input ref={inputRef} type="text"
                 placeholder="SN-1234"
                 value={query}
                 onChange={(e) => setQuery(e.target.value.toUpperCase())}
                 spellCheck="false"
                 autoCapitalize="characters" />
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon.bolt />}
            <span>{busy ? "Consultando ledger…" : "Verificar"}</span>
          </button>
        </form>

        <div className="verify-tries">
          <span className="mono dim" style={{ alignSelf: "center", fontSize: 11, letterSpacing: "0.14em" }}>
            TIP:
          </span>
          <span className="mono dim" style={{ alignSelf: "center", fontSize: 11.5 }}>
            usa una serie que hayas registrado en /api/fabricante/registrar-producto
          </span>
        </div>
      </section>

      {result && <VerifyResult result={result} />}
    </div>
  );
}

function VerifyResult({ result }) {
  if (result.notFound) {
    return (
      <div className="passport" style={{ gridTemplateColumns: "1fr" }}>
        <div className="pass-card">
          <div className="pass-h">
            <span>resultado</span>
            <span className="stamp" style={{ background: "var(--rayo-soft)", color: "var(--rayo)" }}>
              ⨯ no encontrado
            </span>
          </div>
          <div className="big err">
            <span className="ic">⨯</span>
            <span>Sin registro en cadena</span>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            La serie <span className="mono" style={{ color: "var(--text)" }}>{result.serie}</span> no aparece
            en el ledger. Podría tratarse de una falsificación.
            Contacta con el fabricante autorizado antes de aceptar el producto.
          </p>
        </div>
      </div>
    );
  }
  if (result.error) {
    return (
      <div className="passport" style={{ gridTemplateColumns: "1fr" }}>
        <div className="pass-card">
          <div className="pass-h">
            <span>resultado</span>
            <span className="stamp" style={{ background: "var(--rayo-soft)", color: "var(--rayo)" }}>
              error
            </span>
          </div>
          <div className="big err">
            <span className="ic">⨯</span>
            <span>Error consultando el ledger</span>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            <span className="mono" style={{ color: "var(--rayo)" }}>{result.message}</span>
          </p>
        </div>
      </div>
    );
  }
  return <Passport producto={result.producto} garantia={result.garantia} transferencias={result.transferencias} />;
}

function Passport({ producto: p, garantia, transferencias }) {
  const expired = garantia && garantia.fechaExpiracion && new Date(garantia.fechaExpiracion) < new Date();

  const events = [
    { kind: "MINT",
      route: <span>Fabricación · <strong>FabricanteMSP</strong></span>,
      when: p.fechaFabricacion,
      tx: null },
    ...transferencias.map(t => ({
      kind: "TRANSFER",
      route: (
        <span>
          {t.origen} <span className="arrow"><Icon.arrow /></span>
          <strong>{t.destino}</strong>
        </span>
      ),
      when: t.fecha,
      tx: t.txID,
    })),
  ];

  return (
    <div>
      <div className="passport">
        {/* Authenticity */}
        <div className="pass-card hero-card">
          <div className="pass-h">
            <span>autenticidad</span>
            <span className="stamp">verificado</span>
          </div>
          <div className="big">
            <span className="ic"><Icon.check /></span>
            <span>Producto auténtico</span>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            Sellado por el fabricante en blockchain. Cada transferencia hasta ti está firmada y
            es inmutable.
          </p>
          <dl>
            <dt>Serie</dt><dd>{p.numeroSerie}</dd>
            <dt>Modelo</dt><dd>{p.modelo}</dd>
            <dt>Lote</dt><dd>{p.lote}</dd>
            {p.estado && (<React.Fragment><dt>Estado</dt><dd>{p.estado}</dd></React.Fragment>)}
            <dt>Fabricado</dt><dd>{formatDate(p.fechaFabricacion)}</dd>
          </dl>
        </div>

        {/* Warranty */}
        <div className="pass-card">
          <div className="pass-h">
            <span>garantía</span>
            {garantia ? (
              expired
                ? <span className="stamp" style={{ background: "rgba(245,165,36,0.08)", color: "var(--c-warn)" }}>expirada</span>
                : <span className="stamp">{(garantia.estado || "activa").toLowerCase()}</span>
            ) : <span className="stamp" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>—</span>}
          </div>
          {garantia ? (
            <React.Fragment>
              <div className={"big" + (expired ? " warn" : "")}>
                <span className="ic">{expired ? <Icon.warn /> : <Icon.shield />}</span>
                <span>{expired ? "Garantía expirada" : "Cobertura activa"}</span>
              </div>
              <p className="muted" style={{ marginTop: 6 }}>
                {expired
                  ? "La cobertura del fabricante ya no está vigente."
                  : `Cobertura activa hasta ${formatDate(garantia.fechaExpiracion)}.`}
              </p>
              <dl>
                {garantia.clienteFinal && (<React.Fragment>
                  <dt>Cliente</dt><dd style={{ fontFamily: "var(--font-display)" }}>{garantia.clienteFinal}</dd>
                </React.Fragment>)}
                {garantia.fechaActivacion && (<React.Fragment>
                  <dt>Activada</dt><dd>{formatDate(garantia.fechaActivacion)}</dd>
                </React.Fragment>)}
                {garantia.fechaExpiracion && (<React.Fragment>
                  <dt>Expira</dt><dd>{formatDate(garantia.fechaExpiracion)}</dd>
                </React.Fragment>)}
                {garantia.estado && (<React.Fragment>
                  <dt>Estado</dt><dd>{garantia.estado}</dd>
                </React.Fragment>)}
              </dl>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="big" style={{ color: "var(--text-3)" }}>
                <span className="ic" style={{ color: "var(--text-3)", background: "var(--surface-2)" }}>—</span>
                <span>Sin garantía activada</span>
              </div>
              <p className="muted" style={{ marginTop: 6 }}>
                Este producto aún no ha sido vendido al consumidor final, o el minorista
                no ha activado la garantía todavía.
              </p>
            </React.Fragment>
          )}
        </div>
      </div>

      <div className="tl">
        <h3>
          <span>Trayectoria del producto · {events.length} firma{events.length === 1 ? "" : "s"}</span>
          <span style={{ color: "var(--rayo)" }}>verificable</span>
        </h3>
        <div className="tl-list">
          {events.map((e, i) => (
            <div key={i} className="tl-item">
              <div className="route">{e.route}</div>
              <div className="when">{formatDate(e.when)}</div>
              {e.tx && <div className="tx">tx: {e.tx}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.ClienteView = ClienteView;
