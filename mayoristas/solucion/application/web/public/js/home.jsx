// ────────────────────────────────────────────────────────────
//   RAYO — Home / hero. Sin datos inventados.
// ────────────────────────────────────────────────────────────

function SupplyChain({ onRole }) {
  const nodes = [
    { role: "fabricante", idx: "01 · origen",       name: "Fabricante", hint: "FabricanteMSP · canal-trazabilidad" },
    { role: "mayorista",  idx: "02 · distribución", name: "Mayorista",  hint: "MayoristaMSP · canal-mayorista" },
    { role: "minorista",  idx: "03 · venta",        name: "Minorista",  hint: "MinoristaMSP · canal-minorista" },
    { role: "cliente",    idx: "04 · consumo",      name: "Cliente",    hint: "sin identidad · API pública" },
  ];
  const cells = [];
  nodes.forEach((n, i) => {
    cells.push(
      <div key={"n" + i} className="supply-node" data-role={n.role}
           onClick={() => onRole(n.role)}>
        <div className="role-stripe" />
        <div>
          <div className="idx">{n.idx}</div>
          <div className="name">{n.name}</div>
        </div>
        <div className="mono dim" style={{ fontSize: 11, marginTop: 18, letterSpacing: "0.04em" }}>
          {n.hint}
        </div>
      </div>
    );
    if (i < nodes.length - 1) {
      cells.push(
        <div key={"a" + i} className="supply-arrow">
          <div className="line"><span className="particle" /></div>
        </div>
      );
    }
  });

  return (
    <section className="supply" aria-label="Cadena de suministro">
      <div className="supply-head">
        <h3>Flujo de la cadena</h3>
        <span className="live">
          <span className="live-dot" />
          <span>3 organizaciones · 3 canales · 1 ledger</span>
        </span>
      </div>
      <div className="supply-grid">{cells}</div>
    </section>
  );
}

function Home({ onRole, health }) {
  const offline = health.status === "err";

  return (
    <div className="page" data-screen-label="01 Home">
      <section className="hero">
        <div className="hero-sash" aria-hidden="true" />
        <div className="hero-eyebrow">
          <span className="sash" />
          <span>v.0.4 · hyperledger fabric · 3 canales</span>
        </div>
        <h1>
          La verdad,<br />
          en <span className="accent">cadena</span>
        </h1>
        <p className="hero-sub">
          Cada producto firma su propia historia. Fabricantes, mayoristas y minoristas comparten una sola fuente
          de verdad sobre Hyperledger Fabric — y el consumidor la verifica en milisegundos.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn primary" onClick={() => onRole("cliente")}>
            Verificar un producto <Icon.arrow />
          </button>
          <button type="button" className="btn ghost" onClick={() => onRole("fabricante")}>
            Entrar como fabricante
          </button>
        </div>

        {offline && (
          <div className="offline-banner">
            <span>⚠</span>
            <span>BACKEND NO DISPONIBLE — /api/health falla. Arranca la red Fabric y el servidor antes de operar.</span>
          </div>
        )}
      </section>

      <SupplyChain onRole={onRole} />

      <div className="features">
        <div className="feature">
          <div className="num">01 / autenticidad</div>
          <h4>Cada serie, una historia firmada</h4>
          <p>
            Desde el primer registro del fabricante hasta la venta final, cada transferencia
            queda firmada en el ledger. Sin papeles, sin disputas.
          </p>
        </div>
        <div className="feature">
          <div className="num">02 / privacidad comercial</div>
          <h4>Tres canales, márgenes invisibles</h4>
          <p>
            Cada organización ve sólo lo que necesita ver. Precios y condiciones quedan
            fuera de los canales compartidos.
          </p>
        </div>
        <div className="feature">
          <div className="num">03 / garantías</div>
          <h4>A prueba de fraude, sin tarjetas</h4>
          <p>
            La garantía vive en el ledger, vinculada al cliente y al fabricante. El minorista
            la activa; cualquiera la verifica.
          </p>
        </div>
      </div>
    </div>
  );
}

window.Home = Home;
