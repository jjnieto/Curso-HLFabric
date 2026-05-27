// ────────────────────────────────────────────────────────────
//   RAYO — App entry / router / tweaks
// ────────────────────────────────────────────────────────────

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#FF2D3D",
  "density": "comfortable",
  "showGrid": true
}/*EDITMODE-END*/;

function applyTweaks(t) {
  const root = document.documentElement;
  root.style.setProperty("--rayo", t.accent);
  const hex = t.accent.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  root.style.setProperty("--rayo-soft", `rgba(${r}, ${g}, ${b}, 0.14)`);
  root.style.setProperty("--rayo-glow", `rgba(${r}, ${g}, ${b}, 0.35)`);
  root.style.setProperty("--c-cliente", t.accent);
  document.body.style.fontSize = t.density === "compact" ? "13.5px" : "14px";
  document.body.style.setProperty("--grid-op", t.showGrid ? "0.018" : "0");
}

function RayoApp() {
  const [role, setRole] = useState(null);
  const health = useHealth();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => { applyTweaks(t); }, [t]);

  const onRole = (r) => {
    setRole(r);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <React.Fragment>
      <Topbar role={role} onRole={onRole} health={health} />
      {role === null         && <Home onRole={onRole} health={health} />}
      {role === "fabricante" && <RoleView role="fabricante" />}
      {role === "mayorista"  && <RoleView role="mayorista" />}
      {role === "minorista"  && <RoleView role="minorista" />}
      {role === "cliente"    && <ClienteView />}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Brand">
          <TweakColor
            label="Color de marca"
            value={t.accent}
            options={["#FF2D3D", "#FF8A1F", "#19D38A", "#4D7CFF", "#A855F7"]}
            onChange={(v) => setTweak("accent", v)}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio
            label="Densidad"
            value={t.density}
            options={[{ value: "comfortable", label: "Cómoda" }, { value: "compact", label: "Compacta" }]}
            onChange={(v) => setTweak("density", v)}
          />
          <TweakToggle
            label="Rejilla de fondo"
            value={t.showGrid}
            onChange={(v) => setTweak("showGrid", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<RayoApp />);
