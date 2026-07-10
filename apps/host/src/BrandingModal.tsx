import { useState } from 'react';
import { type Brand, DEFAULT_BRAND, BRAND_PRESETS, OPTION_SHAPES } from '@karick/shared';

/** Configura marca do host: nome, logo e paleta de cores (aplicados no jogo todo). */
export function BrandingModal({ initial, onSave, onClose }: { initial: Brand; onSave: (b: Brand) => void; onClose: () => void }) {
  const [name, setName] = useState(initial.name ?? '');
  const [logo, setLogo] = useState(initial.logo ?? '');
  const [bg, setBg] = useState(initial.bg ?? DEFAULT_BRAND.bg!);
  const [primary, setPrimary] = useState(initial.primary ?? DEFAULT_BRAND.primary!);
  const [options, setOptions] = useState<string[]>(initial.options && initial.options.length === 4 ? [...initial.options] : [...DEFAULT_BRAND.options!]);

  const setOpt = (i: number, v: string) => setOptions((o) => o.map((c, idx) => (idx === i ? v : c)));

  const applyPreset = (p: (typeof BRAND_PRESETS)[number]) => {
    setBg(p.bg);
    setPrimary(p.primary);
    setOptions([...p.options]);
  };

  const resetAll = () => {
    setBg(DEFAULT_BRAND.bg!);
    setPrimary(DEFAULT_BRAND.primary!);
    setOptions([...DEFAULT_BRAND.options!]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-800 p-6 text-slate-100">
        <h2 className="mb-4 text-2xl font-bold">Personalização (marca)</h2>

        <label className="mb-1 block text-sm text-white/70">Nome (substitui “Karick”)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Ex.: Quiz da Empresa X"
          className="mb-3 w-full rounded-lg bg-white/10 p-2 outline-none placeholder:text-white/40"
        />

        <label className="mb-1 block text-sm text-white/70">URL do logo (opcional)</label>
        <input
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          placeholder="https://…/logo.png"
          className="mb-2 w-full rounded-lg bg-white/10 p-2 outline-none placeholder:text-white/40"
        />
        {logo && /^https?:\/\//i.test(logo) && (
          <img src={logo} alt="prévia do logo" className="mb-3 max-h-20 rounded bg-white/10 p-1" onError={(e) => (e.currentTarget.style.display = 'none')} />
        )}

        <label className="mb-1 mt-2 block text-sm text-white/70">Paletas prontas</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {BRAND_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
              title={p.name}
            >
              <span className="h-4 w-4 rounded" style={{ background: p.bg }} />
              {p.options.map((c, i) => (
                <span key={i} className="h-4 w-4 rounded" style={{ background: c }} />
              ))}
              <span className="ml-1">{p.name}</span>
            </button>
          ))}
        </div>

        <label className="mb-1 block text-sm text-white/70">Cores</label>
        <div className="mb-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
          <span className="text-sm">Fundo das telas</span>
          <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-8 w-14 rounded bg-transparent" />
        </div>
        <div className="mb-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
          <span className="text-sm">Destaque (PIN, botões, títulos)</span>
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-8 w-14 rounded bg-transparent" />
        </div>
        <div className="mb-4 rounded-lg bg-white/5 px-3 py-2">
          <span className="text-sm">Cores das alternativas</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {options.map((c, i) => (
              <label key={i} className="flex items-center gap-2 rounded px-2 py-1" style={{ background: c }}>
                <span className="text-lg font-bold text-white">{OPTION_SHAPES[i]}</span>
                <input type="color" value={c} onChange={(e) => setOpt(i, e.target.value)} className="ml-auto h-7 w-12 rounded bg-transparent" />
              </label>
            ))}
          </div>
        </div>

        {/* Prévia rápida do fundo + destaque */}
        <div className="mb-4 flex items-center justify-center gap-3 rounded-lg p-4" style={{ background: bg }}>
          <span className="text-2xl font-black" style={{ color: primary }}>{name.trim() || 'Karick'}</span>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-lg bg-white/10 px-4 py-3 hover:bg-white/20">
            Cancelar
          </button>
          <button onClick={resetAll} className="rounded-lg bg-white/10 px-4 py-3 hover:bg-white/20" title="Voltar ao padrão">
            Padrão
          </button>
          <button
            onClick={() => onSave({ name: name.trim() || undefined, logo: logo.trim() || undefined, bg, primary, options })}
            className="flex-1 rounded-lg bg-green-500 p-3 font-bold text-white hover:bg-green-400"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
