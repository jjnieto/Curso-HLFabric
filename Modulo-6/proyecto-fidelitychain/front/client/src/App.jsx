import { useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { Stat, Toast, Modal, Button } from './components/ui';
import HotelPanel from './components/HotelPanel';
import CafeteriaPanel from './components/CafeteriaPanel';

export default function App() {
  const [tab, setTab] = useState('hotel');
  const [token, setToken] = useState(null);
  const [clients, setClients] = useState([]);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(null); // { client, items }

  const notify = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([api.getToken(), api.getClients()]);
      setToken(t);
      setClients(c);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function openHistory(client) {
    try {
      const items = await api.getHistory(client.clientID);
      setHistory({ client, items });
    } catch (err) {
      notify('err', err.message);
    }
  }

  const circulating = token ? token.totalSupply - token.totalRedeemed : 0;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Cabecera */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500
                          flex items-center justify-center font-bold text-lg">FP</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">FidelityChain</h1>
            <p className="text-sm text-slate-300">Programa de fidelización Hotel · Cafetería</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3">
            No se puede contactar con la red: {error}. ¿Está levantada y desplegado el chaincode?
          </div>
        )}

        {/* Estadísticas del token */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Stat label="Total emitido" value={token?.totalSupply ?? '—'} unit="FP" accent="sky" />
          <Stat label="Total canjeado" value={token?.totalRedeemed ?? '—'} unit="FP" accent="rose" />
          <Stat label="En circulación" value={token ? circulating : '—'} unit="FP" accent="emerald" />
        </section>

        {/* Pestañas */}
        <div className="flex gap-2">
          <TabButton active={tab === 'hotel'} onClick={() => setTab('hotel')}>🏨 Hotel</TabButton>
          <TabButton active={tab === 'cafeteria'} onClick={() => setTab('cafeteria')}>☕ Cafetería</TabButton>
        </div>

        {tab === 'hotel'
          ? <HotelPanel onChange={refresh} notify={notify} />
          : <CafeteriaPanel onChange={refresh} notify={notify} />}

        {/* Tabla de clientes */}
        <section className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800">Clientes registrados</h3>
            <Button variant="ghost" onClick={refresh}>↻ Actualizar</Button>
          </div>
          {clients.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-400">Todavía no hay clientes registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50">
                  <th className="px-6 py-3 font-medium">DNI</th>
                  <th className="px-6 py-3 font-medium">Nombre</th>
                  <th className="px-6 py-3 font-medium text-right">Saldo</th>
                  <th className="px-6 py-3 font-medium text-right">Historial</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.clientID} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono text-slate-700">{c.clientID}</td>
                    <td className="px-6 py-3 text-slate-700">{c.name}</td>
                    <td className="px-6 py-3 text-right font-semibold text-slate-800">{c.balance} FP</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => openHistory(c)}
                        className="text-sky-600 hover:text-sky-800 font-medium">Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      {/* Modal de historial */}
      {history && (
        <Modal title={`Historial · ${history.client.name} (${history.client.clientID})`}
               onClose={() => setHistory(null)}>
          {history.items.length === 0 ? (
            <p className="text-slate-400 text-center py-6">El cliente no tiene movimientos.</p>
          ) : (
            <ul className="space-y-2">
              {history.items.map((tx, i) => {
                const isMint = tx.txType === 'mint';
                return (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold mr-2
                        ${isMint ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {isMint ? 'EMISIÓN' : 'CANJE'}
                      </span>
                      <span className="text-slate-700">{tx.description}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{tx.timestamp}</p>
                    </div>
                    <span className={`font-bold ${isMint ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isMint ? '+' : '−'}{tx.amount} FP
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-5 py-2.5 font-medium transition shadow-sm
        ${active ? 'bg-white text-slate-900 shadow-md' : 'bg-white/50 text-slate-500 hover:bg-white/80'}`}
    >
      {children}
    </button>
  );
}
