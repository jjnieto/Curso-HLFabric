import { useEffect, useMemo, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { MULTI_TIMELOCK_ABI, DEFAULT_CONTRACT_ADDRESS } from './abi.js';

function shortAddr(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatRemaining(seconds) {
    if (seconds <= 0) return '00:00:00';
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function formatChain(chainId) {
    const KNOWN = {
        1: 'Ethereum Mainnet',
        11155111: 'Sepolia',
        17000: 'Holesky',
        137: 'Polygon',
        80002: 'Polygon Amoy',
        12345: 'Red local',
    };
    return KNOWN[chainId] || `Chain ${chainId}`;
}

function Icon({ name, size = 20 }) {
    const paths = {
        wallet: 'M21 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7m18 0H3m18 0V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2m12 5h2',
        lock: 'M5 11h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0V7a5 5 0 0 1 10 0v4',
        unlock: 'M5 11h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0V7a5 5 0 0 1 9.9-1',
        clock: 'M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
        check: 'M5 13l4 4L19 7',
        x: 'M6 6l12 12M6 18L18 6',
        info: 'M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
        refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8m0-5v5h-5',
    };
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={paths[name]} />
        </svg>
    );
}

function App() {
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [address, setAddress] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
    const [deposit, setDeposit] = useState(null);
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState(null);

    const [lockAmount, setLockAmount] = useState('0.01');
    const [lockSeconds, setLockSeconds] = useState('60');

    const showToast = useCallback((msg, kind = 'info') => {
        setToast({ msg, kind, id: Date.now() });
        setTimeout(() => setToast((t) => (t && Date.now() - t.id >= 4500 ? null : t)), 5000);
    }, []);

    const refreshDeposit = useCallback(async () => {
        if (!signer || !contractAddress) return;
        try {
            const c = new ethers.Contract(contractAddress, MULTI_TIMELOCK_ABI, signer);
            const me = await signer.getAddress();
            const res = await c.deposits(me);
            setDeposit({
                amount: res[0],
                unlockTime: Number(res[1]),
            });
        } catch (err) {
            console.error('refreshDeposit error:', err);
            showToast(`No pude leer el contrato. ¿Dirección y red correctas?`, 'error');
        }
    }, [signer, contractAddress, showToast]);

    // Reloj que tickea cada segundo (para el countdown)
    useEffect(() => {
        const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(id);
    }, []);

    // Listeners de MetaMask
    useEffect(() => {
        if (!window.ethereum) return;

        const onAccountsChanged = async (accs) => {
            if (accs.length === 0) {
                setSigner(null);
                setAddress(null);
                setDeposit(null);
            } else {
                await connect();
            }
        };
        const onChainChanged = () => window.location.reload();

        window.ethereum.on('accountsChanged', onAccountsChanged);
        window.ethereum.on('chainChanged', onChainChanged);
        return () => {
            window.ethereum.removeListener('accountsChanged', onAccountsChanged);
            window.ethereum.removeListener('chainChanged', onChainChanged);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Releer el deposit cuando cambia signer o contractAddress
    useEffect(() => {
        if (signer) refreshDeposit();
    }, [signer, contractAddress, refreshDeposit]);

    async function connect() {
        if (!window.ethereum) {
            showToast('MetaMask no detectado. Instálalo desde metamask.io', 'error');
            return;
        }
        try {
            const p = new ethers.BrowserProvider(window.ethereum);
            await p.send('eth_requestAccounts', []);
            const s = await p.getSigner();
            const a = await s.getAddress();
            const net = await p.getNetwork();
            setProvider(p);
            setSigner(s);
            setAddress(a);
            setChainId(Number(net.chainId));
            showToast(`Conectado como ${shortAddr(a)}`, 'success');
        } catch (err) {
            showToast(`Error al conectar: ${err.shortMessage || err.message}`, 'error');
        }
    }

    function disconnect() {
        setSigner(null);
        setAddress(null);
        setDeposit(null);
    }

    async function lockFunds() {
        if (!signer) return;
        const amountNum = parseFloat(lockAmount);
        const secondsNum = parseInt(lockSeconds, 10);
        if (!(amountNum > 0)) return showToast('Cantidad inválida', 'error');
        if (!(secondsNum > 0)) return showToast('Tiempo inválido', 'error');

        setBusy(true);
        try {
            const c = new ethers.Contract(contractAddress, MULTI_TIMELOCK_ABI, signer);
            const tx = await c.lock(secondsNum, { value: ethers.parseEther(lockAmount) });
            showToast(`Tx enviada: ${tx.hash.slice(0, 10)}…`, 'info');
            await tx.wait();
            showToast(`Bloqueados ${lockAmount} ETH durante ${secondsNum}s`, 'success');
            await refreshDeposit();
        } catch (err) {
            showToast(`Error: ${err.shortMessage || err.reason || err.message}`, 'error');
        } finally {
            setBusy(false);
        }
    }

    async function withdraw() {
        if (!signer) return;
        setBusy(true);
        try {
            const c = new ethers.Contract(contractAddress, MULTI_TIMELOCK_ABI, signer);
            const tx = await c.withdraw();
            showToast(`Tx enviada: ${tx.hash.slice(0, 10)}…`, 'info');
            await tx.wait();
            showToast('Fondos retirados correctamente', 'success');
            await refreshDeposit();
        } catch (err) {
            showToast(`Error: ${err.shortMessage || err.reason || err.message}`, 'error');
        } finally {
            setBusy(false);
        }
    }

    const hasDeposit = deposit && deposit.amount > 0n;
    const remaining = hasDeposit ? Math.max(0, deposit.unlockTime - now) : 0;
    const isUnlocked = hasDeposit && remaining === 0;

    const amountEth = useMemo(() => {
        if (!hasDeposit) return '0';
        return ethers.formatEther(deposit.amount);
    }, [hasDeposit, deposit]);

    return (
        <div className="app">
            <div className="bg-glow" />

            <main className="container">
                <header className="hero">
                    <h1 className="brand">
                        <span className="brand-icon"><Icon name="lock" size={28} /></span>
                        Vault
                    </h1>
                    <p className="tagline">Bloquea ETH con time-lock on-chain. Solo tú puedes recuperarlo, y solo cuando el tiempo pase.</p>
                </header>

                {!address ? (
                    <section className="card connect-card">
                        <div className="card-icon">
                            <Icon name="wallet" size={32} />
                        </div>
                        <h2>Conecta tu wallet</h2>
                        <p className="muted">Necesitas MetaMask para interactuar con el contrato MultiTimeLock.</p>
                        <button className="btn btn-primary btn-block" onClick={connect}>
                            <Icon name="wallet" size={18} /> Conectar MetaMask
                        </button>
                    </section>
                ) : (
                    <>
                        <section className="card account-card">
                            <div className="account-row">
                                <div>
                                    <span className="label">Cuenta conectada</span>
                                    <div className="account-addr">{shortAddr(address)}</div>
                                </div>
                                <div>
                                    <span className="label">Red</span>
                                    <div className="chip">{formatChain(chainId)}</div>
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={disconnect} title="Desconectar">
                                    <Icon name="x" size={16} />
                                </button>
                            </div>
                            <div className="contract-row">
                                <label htmlFor="contract-input" className="label">Dirección del contrato</label>
                                <div className="input-row">
                                    <input
                                        id="contract-input"
                                        type="text"
                                        value={contractAddress}
                                        onChange={(e) => setContractAddress(e.target.value)}
                                        spellCheck={false}
                                    />
                                    <button className="btn btn-ghost btn-sm" onClick={refreshDeposit} title="Refrescar">
                                        <Icon name="refresh" size={16} />
                                    </button>
                                </div>
                            </div>
                        </section>

                        {hasDeposit ? (
                            <section className={`card deposit-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
                                <div className="status-badge">
                                    {isUnlocked ? (
                                        <><Icon name="unlock" size={16} /> Desbloqueado</>
                                    ) : (
                                        <><Icon name="lock" size={16} /> Bloqueado</>
                                    )}
                                </div>
                                <div className="amount">
                                    <span className="amount-value">{amountEth}</span>
                                    <span className="amount-unit">ETH</span>
                                </div>
                                <div className="countdown-wrap">
                                    <span className="label"><Icon name="clock" size={14} /> Tiempo restante</span>
                                    <div className={`countdown ${isUnlocked ? 'zero' : ''}`}>{formatRemaining(remaining)}</div>
                                </div>
                                <button
                                    className={`btn btn-block ${isUnlocked ? 'btn-success' : 'btn-disabled'}`}
                                    disabled={!isUnlocked || busy}
                                    onClick={withdraw}
                                >
                                    {busy ? 'Procesando…' : isUnlocked ? <><Icon name="unlock" size={18} /> Retirar fondos</> : 'Aún bloqueado'}
                                </button>
                            </section>
                        ) : (
                            <section className="card lock-card">
                                <h2 className="card-title"><Icon name="lock" size={20} /> Bloquear ETH</h2>
                                <p className="muted small">No tienes ningún depósito activo. Cuando bloquees, los fondos quedarán retenidos durante el tiempo que indiques.</p>

                                <label className="label" htmlFor="amount-input">Cantidad (ETH)</label>
                                <input
                                    id="amount-input"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={lockAmount}
                                    onChange={(e) => setLockAmount(e.target.value)}
                                />

                                <label className="label" htmlFor="seconds-input">Duración (segundos)</label>
                                <input
                                    id="seconds-input"
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={lockSeconds}
                                    onChange={(e) => setLockSeconds(e.target.value)}
                                />
                                <div className="duration-shortcuts">
                                    {[
                                        { label: '1 min', s: 60 },
                                        { label: '5 min', s: 300 },
                                        { label: '1 h', s: 3600 },
                                        { label: '1 día', s: 86400 },
                                    ].map((p) => (
                                        <button key={p.s} className="chip-btn" onClick={() => setLockSeconds(String(p.s))}>
                                            {p.label}
                                        </button>
                                    ))}
                                </div>

                                <button className="btn btn-primary btn-block" onClick={lockFunds} disabled={busy}>
                                    {busy ? 'Procesando…' : <><Icon name="lock" size={18} /> Bloquear</>}
                                </button>
                            </section>
                        )}
                    </>
                )}

                <footer className="footer">
                    <p>Contrato <code>vault.sol</code> · <code>MultiTimeLock</code>. Funciona con cualquier despliegue: pega su dirección arriba.</p>
                </footer>
            </main>

            {toast && (
                <div className={`toast toast-${toast.kind}`} key={toast.id}>
                    {toast.kind === 'success' && <Icon name="check" size={16} />}
                    {toast.kind === 'error' && <Icon name="x" size={16} />}
                    {toast.kind === 'info' && <Icon name="info" size={16} />}
                    <span>{toast.msg}</span>
                </div>
            )}
        </div>
    );
}

export default App;
