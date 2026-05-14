import { useEffect, useMemo, useState, useCallback } from "react";
import { BrowserProvider, Contract, formatUnits } from "ethers";
import {
  VOTING_ABI,
  ERC20_ABI,
  DEFAULT_VOTING_ADDRESS,
  DEFAULT_TOKEN_ADDRESS,
  SEPOLIA_CHAIN_ID,
} from "./abi.js";

// ============================================================
// Helpers
// ============================================================

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function loadFromStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function useCountdown(deadline) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  if (!deadline) return null;
  const diff = deadline - now;
  if (diff <= 0) return "Tiempo agotado";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// ============================================================
// Toasts
// ============================================================

function Toast({ toast }) {
  const icon = toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ";
  return (
    <div className={`toast ${toast.type}`}>
      <span className="toast-icon">{icon}</span>
      <span className="toast-content">{toast.msg}</span>
    </div>
  );
}

// ============================================================
// App
// ============================================================

export default function App() {
  // ---- Config ----
  const [votingAddr, setVotingAddr] = useState(() =>
    loadFromStorage("votingAddr", DEFAULT_VOTING_ADDRESS)
  );
  const [tokenAddr, setTokenAddr] = useState(() =>
    loadFromStorage("tokenAddr", DEFAULT_TOKEN_ADDRESS)
  );

  // ---- Wallet ----
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);

  // ---- Contracts state ----
  const [ownerAddr, setOwnerAddr] = useState(null);
  const [tokenSymbol, setTokenSymbol] = useState("MTK");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [balance, setBalance] = useState(0n);

  const [proposal, setProposal] = useState(null);
  // proposal = { description, deadline (number), yes (bigint), no (bigint), active (bool) }

  const [history, setHistory] = useState([]);

  // ---- UI state ----
  const [newDesc, setNewDesc] = useState("");
  const [newDuration, setNewDuration] = useState("10");
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]);

  const isOwner =
    account && ownerAddr && account.toLowerCase() === ownerAddr.toLowerCase();
  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID;
  const isConfigured = votingAddr && tokenAddr;
  const hasVotingPower = balance > 0n;

  // ============================================================
  // Toast system
  // ============================================================

  const pushToast = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // ============================================================
  // Wallet
  // ============================================================

  async function connectWallet() {
    if (!window.ethereum) {
      pushToast("error", "MetaMask no detectado. Instálalo desde metamask.io");
      return;
    }
    try {
      const prov = new BrowserProvider(window.ethereum);
      const accounts = await prov.send("eth_requestAccounts", []);
      const net = await prov.getNetwork();
      setProvider(prov);
      setAccount(accounts[0]);
      setChainId(net.chainId);
      pushToast("success", `Conectado: ${shortAddr(accounts[0])}`);
    } catch (e) {
      pushToast("error", e.message || "Error al conectar");
    }
  }

  // Reaccionar a cambios de cuenta/red en MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accs) => {
      setAccount(accs[0] || null);
    };
    const handleChainChanged = (cidHex) => {
      setChainId(BigInt(cidHex));
    };
    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  // ============================================================
  // Contracts (read)
  // ============================================================

  const votingContract = useMemo(() => {
    if (!provider || !votingAddr) return null;
    try {
      return new Contract(votingAddr, VOTING_ABI, provider);
    } catch {
      return null;
    }
  }, [provider, votingAddr]);

  const tokenContract = useMemo(() => {
    if (!provider || !tokenAddr) return null;
    try {
      return new Contract(tokenAddr, ERC20_ABI, provider);
    } catch {
      return null;
    }
  }, [provider, tokenAddr]);

  // Autodetectar la dirección del token desde el contrato de voting
  useEffect(() => {
    if (!votingContract || tokenAddr) return;
    (async () => {
      try {
        const t = await votingContract.governanceToken();
        if (t && t !== "0x0000000000000000000000000000000000000000") {
          setTokenAddr(t);
          saveToStorage("tokenAddr", t);
        }
      } catch (e) {
        console.error("autodetect token", e);
      }
    })();
  }, [votingContract, tokenAddr]);

  const refreshAll = useCallback(async () => {
    if (!votingContract || !tokenContract || !account) return;
    try {
      const [own, sym, dec, bal, prop] = await Promise.all([
        votingContract.owner(),
        tokenContract.symbol().catch(() => "MTK"),
        tokenContract.decimals().catch(() => 18),
        tokenContract.balanceOf(account),
        votingContract.getCurrentProposal(),
      ]);
      setOwnerAddr(own);
      setTokenSymbol(sym);
      setTokenDecimals(Number(dec));
      setBalance(bal);
      const [description, deadline, yes, no, active] = prop;
      setProposal({
        description,
        deadline: Number(deadline),
        yes,
        no,
        active,
      });
    } catch (e) {
      console.error(e);
    }
  }, [votingContract, tokenContract, account]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Refrescar periódicamente cuando hay propuesta activa
  useEffect(() => {
    if (!proposal?.active) return;
    const id = setInterval(refreshAll, 8000);
    return () => clearInterval(id);
  }, [proposal?.active, refreshAll]);

  // ============================================================
  // History (lectura de eventos)
  // ============================================================

  const loadHistory = useCallback(async () => {
    if (!votingContract || !provider) return;
    try {
      const block = await provider.getBlockNumber();
      const fromBlock = Math.max(0, block - 50000);
      const createdFilter = votingContract.filters.ProposalCreated();
      const closedFilter = votingContract.filters.ProposalClosed();
      const [created, closed] = await Promise.all([
        votingContract.queryFilter(createdFilter, fromBlock, block),
        votingContract.queryFilter(closedFilter, fromBlock, block),
      ]);
      // Empareja cada created con el closed inmediatamente posterior
      const items = [];
      for (let i = 0; i < created.length; i++) {
        const c = created[i];
        const desc = c.args.description;
        const matchClosed = closed.find((cl) => cl.blockNumber >= c.blockNumber);
        if (matchClosed) {
          items.push({
            desc,
            result: matchClosed.args.result,
            yes: matchClosed.args.yesVotes,
            no: matchClosed.args.noVotes,
            block: matchClosed.blockNumber,
          });
        }
      }
      setHistory(items.reverse().slice(0, 10));
    } catch (e) {
      console.error("history", e);
    }
  }, [votingContract, provider]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ============================================================
  // Actions (write)
  // ============================================================

  async function withSigner(fn) {
    if (!provider) return;
    setBusy(true);
    try {
      const signer = await provider.getSigner();
      await fn(signer);
      await refreshAll();
      await loadHistory();
    } catch (e) {
      console.error(e);
      const msg = e.shortMessage || e.reason || e.message || "Error";
      pushToast("error", msg);
    } finally {
      setBusy(false);
    }
  }

  async function castVote(choice) {
    await withSigner(async (signer) => {
      const c = new Contract(votingAddr, VOTING_ABI, signer);
      const tx = await c.vote(choice);
      pushToast("info", "Voto enviado, esperando confirmación…");
      await tx.wait();
      pushToast("success", choice === 1 ? "¡Has votado SÍ!" : "¡Has votado NO!");
    });
  }

  async function createProposal() {
    if (!newDesc.trim()) {
      pushToast("error", "Escribe una descripción");
      return;
    }
    const dur = parseInt(newDuration, 10);
    if (!dur || dur <= 0) {
      pushToast("error", "Duración inválida");
      return;
    }
    await withSigner(async (signer) => {
      const c = new Contract(votingAddr, VOTING_ABI, signer);
      const tx = await c.createProposal(newDesc.trim(), dur);
      pushToast("info", "Propuesta enviada…");
      await tx.wait();
      pushToast("success", "Propuesta creada");
      setNewDesc("");
    });
  }

  async function closeProposal() {
    await withSigner(async (signer) => {
      const c = new Contract(votingAddr, VOTING_ABI, signer);
      const tx = await c.closeProposal();
      pushToast("info", "Cerrando propuesta…");
      await tx.wait();
      pushToast("success", "Propuesta cerrada");
    });
  }

  // ============================================================
  // Computed
  // ============================================================

  const countdown = useCountdown(proposal?.deadline);
  const deadlineReached =
    proposal?.deadline && proposal.deadline <= Math.floor(Date.now() / 1000);

  const totalVotes = proposal ? proposal.yes + proposal.no : 0n;
  const yesPct =
    totalVotes > 0n ? Number((proposal.yes * 10000n) / totalVotes) / 100 : 0;
  const noPct =
    totalVotes > 0n ? Number((proposal.no * 10000n) / totalVotes) / 100 : 0;

  const fmt = (v) => {
    try {
      return Number(formatUnits(v, tokenDecimals)).toLocaleString("es-ES", {
        maximumFractionDigits: 2,
      });
    } catch {
      return v.toString();
    }
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="app">
      {/* TOASTS */}
      <div className="toast-container">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} />
        ))}
      </div>

      {/* HEADER */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon">🗳</div>
          <div>
            <div className="brand-title">Token Governance</div>
            <div className="brand-sub">Votación ponderada por tokens</div>
          </div>
        </div>

        <div className="wallet-info">
          {account ? (
            <>
              <span className={`network-badge ${isCorrectNetwork ? "" : "wrong"}`}>
                {isCorrectNetwork ? "Sepolia" : "Red incorrecta"}
              </span>
              {isOwner && <span className="owner-pill">Owner</span>}
              {tokenAddr && (
                <span className="balance-pill" title="Tu saldo de tokens de voto">
                  <span className="balance-pill-icon">💎</span>
                  {fmt(balance)}
                  <span className="balance-pill-symbol">{tokenSymbol}</span>
                </span>
              )}
              <span className="address-pill">{shortAddr(account)}</span>
            </>
          ) : (
            <button className="btn" onClick={connectWallet}>
              Conectar MetaMask
            </button>
          )}
        </div>
      </header>

      {/* SETUP / WELCOME */}
      {!account && (
        <div className="card setup">
          <h1>Vota con tus tokens</h1>
          <p>
            Conecta MetaMask para ver propuestas activas y votar usando tu saldo
            de {tokenSymbol || "MTK"}. Tu peso en cada votación es igual a tu
            balance del token de gobernanza en el momento de votar.
          </p>
          <button className="btn" onClick={connectWallet}>
            Conectar MetaMask
          </button>
        </div>
      )}

      {/* CONFIG (si faltan direcciones) */}
      {account && !isConfigured && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Configuración</span>
          </div>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            Introduce las direcciones del contrato de votación y del token de
            gobernanza. Se guardan en tu navegador.
          </p>
          <div className="config-grid">
            <div className="field">
              <label className="field-label">Dirección del contrato Voting</label>
              <input
                type="text"
                className="input input-mono"
                placeholder="0x..."
                value={votingAddr}
                onChange={(e) => {
                  setVotingAddr(e.target.value);
                  saveToStorage("votingAddr", e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label className="field-label">Dirección del token (ERC-20)</label>
              <input
                type="text"
                className="input input-mono"
                placeholder="0x..."
                value={tokenAddr}
                onChange={(e) => {
                  setTokenAddr(e.target.value);
                  saveToStorage("tokenAddr", e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* CURRENT PROPOSAL */}
      {account && isConfigured && proposal && (
        <div className="card">
          <div className="proposal-hero">
            <span
              className={`proposal-status ${proposal.active ? "active" : ""}`}
            >
              {proposal.active
                ? deadlineReached
                  ? "Esperando cierre"
                  : "Votación activa"
                : "Sin propuesta activa"}
            </span>
            {proposal.description && proposal.active ? (
              <h2 className="proposal-description">{proposal.description}</h2>
            ) : (
              <>
                <h2 className="proposal-description" style={{ color: "var(--text-muted)" }}>
                  No hay propuesta para votar
                </h2>
                <p style={{ color: "var(--text-dim)", fontSize: 15, marginBottom: 20 }}>
                  {isOwner
                    ? "Crea una nueva propuesta desde el panel de owner."
                    : "Espera a que el owner cree una propuesta."}
                </p>
                <div className="proposal-meta">
                  <span>
                    Tu saldo: <b>{fmt(balance)} {tokenSymbol}</b>
                  </span>
                  {hasVotingPower ? (
                    <span style={{ color: "var(--accent)" }}>
                      ✓ Listo para votar cuando haya propuesta
                    </span>
                  ) : (
                    <span style={{ color: "var(--warn)" }}>
                      ⚠ No tienes tokens para votar
                    </span>
                  )}
                </div>
              </>
            )}
            {proposal.active && proposal.description && (
              <div className="proposal-meta">
                {!deadlineReached && countdown && (
                  <span>
                    Tiempo restante: <span className="countdown">{countdown}</span>
                  </span>
                )}
                <span>
                  Tu peso: <b>{fmt(balance)} {tokenSymbol}</b>
                </span>
              </div>
            )}
          </div>

          {/* RESULTS */}
          {proposal.description && (
            <div className="results">
              <div className="result-row">
                <span className="result-label yes">Sí</span>
                <div className="result-bar">
                  <div
                    className="result-fill yes"
                    style={{ width: `${yesPct}%` }}
                  />
                </div>
                <span className="result-value">
                  <b>{fmt(proposal.yes)}</b>
                  {yesPct.toFixed(1)}%
                </span>
              </div>
              <div className="result-row">
                <span className="result-label no">No</span>
                <div className="result-bar">
                  <div
                    className="result-fill no"
                    style={{ width: `${noPct}%` }}
                  />
                </div>
                <span className="result-value">
                  <b>{fmt(proposal.no)}</b>
                  {noPct.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* VOTE BUTTONS */}
          {proposal.active && !deadlineReached && (
            <>
              <div className="vote-buttons">
                <button
                  className="vote-btn yes"
                  onClick={() => castVote(1)}
                  disabled={busy || !hasVotingPower}
                >
                  ✓ Votar Sí
                </button>
                <button
                  className="vote-btn no"
                  onClick={() => castVote(0)}
                  disabled={busy || !hasVotingPower}
                >
                  ✕ Votar No
                </button>
              </div>
              {!hasVotingPower && (
                <p className="vote-info">
                  No tienes tokens <b>{tokenSymbol}</b> para votar.
                </p>
              )}
              {hasVotingPower && (
                <p className="vote-info">
                  Votarás con <b>{fmt(balance)} {tokenSymbol}</b>
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* OWNER PANEL */}
      {account && isConfigured && isOwner && (
        <div className="card">
          <div className="card-header">
            <span className="card-title owner">Panel del Owner</span>
          </div>

          {(!proposal?.active || deadlineReached) && (
            <>
              <div className="field">
                <label className="field-label">Descripción de la propuesta</label>
                <textarea
                  className="textarea"
                  placeholder="¿Pausa a las 10:30 o a las 11:00?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div className="row" style={{ marginBottom: 16 }}>
                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="field-label">Duración (minutos)</label>
                  <input
                    type="number"
                    className="input"
                    min="1"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="btn"
                onClick={createProposal}
                disabled={busy || (proposal?.active && !deadlineReached)}
              >
                Crear propuesta
              </button>
            </>
          )}

          {proposal?.active && deadlineReached && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-danger" onClick={closeProposal} disabled={busy}>
                Cerrar propuesta y publicar resultado
              </button>
            </div>
          )}

          {proposal?.active && !deadlineReached && (
            <p style={{ color: "var(--text-muted)" }}>
              Hay una propuesta activa. Espera a que termine para crear otra o ciérrala cuando llegue el deadline.
            </p>
          )}
        </div>
      )}

      {/* HISTORY */}
      {account && isConfigured && history.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Historial</span>
          </div>
          <div className="history-list">
            {history.map((h, i) => (
              <div key={i} className="history-item">
                <span className="history-desc">{h.desc}</span>
                <span className="row" style={{ gap: 12 }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {fmt(h.yes)} sí · {fmt(h.no)} no
                  </span>
                  <span
                    className={`history-result ${
                      h.result.includes("PASSED")
                        ? "passed"
                        : h.result.includes("REJECTED")
                        ? "rejected"
                        : "tie"
                    }`}
                  >
                    {h.result.replace("Proposal ", "")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONFIG FOOTER */}
      {account && isConfigured && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Contratos en uso</span>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setVotingAddr("");
                setTokenAddr("");
                saveToStorage("votingAddr", "");
                saveToStorage("tokenAddr", "");
              }}
            >
              Cambiar
            </button>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Voting</div>
              <div className="stat-value">{shortAddr(votingAddr)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Token</div>
              <div className="stat-value">{shortAddr(tokenAddr)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Symbol</div>
              <div className="stat-value accent">{tokenSymbol}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Tu saldo</div>
              <div className="stat-value">{fmt(balance)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
