import { useState } from 'react';
import { api } from '../api';
import { Card, Field, Button } from './ui';

// Mismo catálogo que la app de consola de la cafetería.
const CATALOGO = [
  { nombre: 'Café solo', puntos: 10 },
  { nombre: 'Café con leche', puntos: 15 },
  { nombre: 'Tostada', puntos: 15 },
  { nombre: 'Desayuno completo', puntos: 30 },
  { nombre: 'Menú almuerzo', puntos: 50 },
];

export default function CafeteriaPanel({ onChange, notify }) {
  const [clientID, setClientID] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  async function doRedeem(e) {
    e.preventDefault();
    if (selected === null) {
      notify('err', 'Selecciona un producto del catálogo');
      return;
    }
    const prod = CATALOGO[selected];
    setLoading(true);
    try {
      await api.redeem(clientID.trim(), prod.puntos, prod.nombre);
      notify('ok', `Canjeado: ${prod.nombre} (${prod.puntos} pts) a ${clientID}`);
      setSelected(null);
      onChange();
    } catch (err) {
      notify('err', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Canjear puntos" subtitle="Solo la cafetería puede canjear (Redeem)" accent="cafe">
      <form onSubmit={doRedeem} className="space-y-5">
        <Field label="DNI del cliente" value={clientID} required
          onChange={(e) => setClientID(e.target.value)} placeholder="12345678A" />

        <div>
          <span className="text-sm font-medium text-slate-600">Catálogo</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CATALOGO.map((p, i) => (
              <button
                type="button"
                key={p.nombre}
                onClick={() => setSelected(i)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition
                  ${selected === i
                    ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
                    : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/40'}`}
              >
                <span className="font-medium text-slate-700">{p.nombre}</span>
                <span className="text-sm font-semibold text-orange-600">{p.puntos} pts</span>
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" variant="cafe" loading={loading}>Canjear producto</Button>
      </form>
    </Card>
  );
}
