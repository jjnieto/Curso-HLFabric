// Componentes de interfaz reutilizables, estilados con Tailwind.

export function Card({ title, subtitle, accent = 'slate', children }) {
  const bar = {
    hotel: 'from-sky-500 to-cyan-600',
    cafe: 'from-amber-500 to-orange-600',
    slate: 'from-slate-400 to-slate-600',
  }[accent];
  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${bar}`} />
      <div className="p-6">
        {title && <h3 className="text-lg font-semibold text-slate-800">{title}</h3>}
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        <div className={title ? 'mt-4' : ''}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800
                   shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none
                   transition"
        {...props}
      />
    </label>
  );
}

export function Button({ children, variant = 'primary', loading, ...props }) {
  const styles = {
    primary: 'bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white',
    cafe: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white',
    ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium
                  shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${styles}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      )}
      {children}
    </button>
  );
}

export function Stat({ label, value, unit, accent = 'slate' }) {
  const color = {
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    sky: 'text-sky-600',
    slate: 'text-slate-700',
  }[accent];
  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-base font-medium text-slate-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export function Toast({ toast, onClose }) {
  if (!toast) return null;
  const ok = toast.type === 'ok';
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-[fadeIn_0.2s_ease-out]">
      <div
        className={`rounded-xl px-4 py-3 shadow-xl text-white flex items-start gap-3
          ${ok ? 'bg-emerald-600' : 'bg-rose-600'}`}
      >
        <span className="text-lg leading-none">{ok ? '✓' : '✕'}</span>
        <div className="flex-1 text-sm">{toast.message}</div>
        <button onClick={onClose} className="text-white/70 hover:text-white">✕</button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
