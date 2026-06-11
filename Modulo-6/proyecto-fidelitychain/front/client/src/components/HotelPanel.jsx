import { useState } from 'react';
import { api } from '../api';
import { Card, Field, Button } from './ui';

export default function HotelPanel({ onChange, notify }) {
  const [reg, setReg] = useState({ clientID: '', name: '' });
  const [mint, setMint] = useState({ clientID: '', amount: '', description: '' });
  const [loading, setLoading] = useState('');

  async function doRegister(e) {
    e.preventDefault();
    setLoading('reg');
    try {
      await api.register(reg.clientID.trim(), reg.name.trim());
      notify('ok', `Cliente ${reg.clientID} registrado`);
      setReg({ clientID: '', name: '' });
      onChange();
    } catch (err) {
      notify('err', err.message);
    } finally {
      setLoading('');
    }
  }

  async function doMint(e) {
    e.preventDefault();
    setLoading('mint');
    try {
      await api.mint(mint.clientID.trim(), Number(mint.amount), mint.description.trim());
      notify('ok', `${mint.amount} puntos emitidos a ${mint.clientID}`);
      setMint({ clientID: '', amount: '', description: '' });
      onChange();
    } catch (err) {
      notify('err', err.message);
    } finally {
      setLoading('');
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title="Registrar cliente" subtitle="Alta de un cliente por DNI" accent="hotel">
        <form onSubmit={doRegister} className="space-y-4">
          <Field label="DNI del cliente" value={reg.clientID} required
            onChange={(e) => setReg({ ...reg, clientID: e.target.value })} placeholder="12345678A" />
          <Field label="Nombre completo" value={reg.name} required
            onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="Javier García" />
          <Button type="submit" loading={loading === 'reg'}>Registrar</Button>
        </form>
      </Card>

      <Card title="Emitir puntos" subtitle="Solo el hotel puede emitir (Mint)" accent="hotel">
        <form onSubmit={doMint} className="space-y-4">
          <Field label="DNI del cliente" value={mint.clientID} required
            onChange={(e) => setMint({ ...mint, clientID: e.target.value })} placeholder="12345678A" />
          <Field label="Puntos a emitir" type="number" min="1" value={mint.amount} required
            onChange={(e) => setMint({ ...mint, amount: e.target.value })} placeholder="100" />
          <Field label="Motivo" value={mint.description}
            onChange={(e) => setMint({ ...mint, description: e.target.value })} placeholder="Estancia 2 noches" />
          <Button type="submit" loading={loading === 'mint'}>Emitir puntos</Button>
        </form>
      </Card>
    </div>
  );
}
