import { useState } from 'react';
import type { Branding } from './lib/branding.js';

/** Configura logo + cor de destaque do host (aplicados nas telas de projeção). */
export function BrandingModal({ initial, onSave, onClose }: { initial: Branding; onSave: (b: Branding) => void; onClose: () => void }) {
  const [logo, setLogo] = useState(initial.logo);
  const [color, setColor] = useState(initial.color);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 text-slate-100">
        <h2 className="mb-4 text-2xl font-bold">Personalização (branding)</h2>

        <label className="mb-1 block text-sm text-white/70">URL do logo (opcional)</label>
        <input
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          placeholder="https://…/logo.png"
          className="mb-3 w-full rounded-lg bg-white/10 p-2 outline-none placeholder:text-white/40"
        />
        {logo && /^https?:\/\//i.test(logo) && (
          <img src={logo} alt="prévia do logo" className="mb-3 max-h-20 rounded bg-white/10 p-1" onError={(e) => (e.currentTarget.style.display = 'none')} />
        )}

        <label className="mb-1 block text-sm text-white/70">Cor de destaque</label>
        <div className="mb-4 flex items-center gap-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 rounded bg-transparent" />
          <span className="text-sm text-white/60">{color}</span>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg bg-white/10 p-3 hover:bg-white/20">
            Cancelar
          </button>
          <button
            onClick={() => onSave({ logo: logo.trim(), color })}
            className="flex-1 rounded-lg bg-green-500 p-3 font-bold text-white hover:bg-green-400"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
