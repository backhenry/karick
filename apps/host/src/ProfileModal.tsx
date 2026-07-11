import { useEffect, useRef, useState } from 'react';
import type { Brand } from '@karick/shared';
import { QRCodeView } from './QRCode.js';
import { useEscape } from './lib/useEscape.js';
import { useI18n, LangSwitcher } from './i18n.js';
import { fileToSquareDataUrl } from './lib/resizeImage.js';
import { api } from './lib/api.js';

interface Stats {
  quizzes: number;
  games: number;
  players: number;
}

/** Área de perfil: identidade, estatísticas, PIN fixo (com QR e link) e ações da conta. */
export function ProfileModal({
  email,
  brand,
  stats,
  photo,
  onPhotoChange,
  onBranding,
  onLogout,
  onClose,
}: {
  email: string;
  brand?: Brand;
  stats: Stats;
  photo?: string | null;
  onPhotoChange?: (photo: string | null) => void;
  onBranding: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [fixedPin, setFixedPin] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pic, setPic] = useState<string | null>(photo ?? null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEscape(onClose);

  useEffect(() => {
    api
      .profile()
      .then((p) => {
        setFixedPin(p.fixedPin);
        setPic(p.photo);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoErr(null);
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      const res = await api.setPhoto(dataUrl);
      setPic(res.photo);
      onPhotoChange?.(res.photo);
    } catch {
      setPhotoErr(t('photoError'));
    }
  };
  const removePhoto = async () => {
    try {
      await api.setPhoto(null);
      setPic(null);
      onPhotoChange?.(null);
    } catch {
      /* ignora */
    }
  };

  const joinUrl = fixedPin ? `${window.location.origin}/?pin=${fixedPin}` : '';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-800 p-6 text-slate-100">
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            title={t('changePhoto')}
            aria-label={t('changePhoto')}
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full text-2xl font-black text-white"
            style={{ background: brand?.primary ?? '#6366f1' }}
          >
            {pic ? (
              <img src={pic} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">{(email[0] ?? '?').toUpperCase()}</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs opacity-0 transition group-hover:opacity-100">
              📷
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold" title={email}>{email}</p>
            <p className="flex items-center gap-2 text-sm text-white/50">
              {t('presenter')}
              {pic && (
                <button onClick={removePhoto} className="text-white/40 underline hover:text-white/70">{t('removePhoto')}</button>
              )}
            </p>
            {photoErr && <p className="text-xs text-red-300">{photoErr}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">✕</button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          {([
            [stats.quizzes, t('statQuizzes')],
            [stats.games, t('statGames')],
            [stats.players, t('statPlayers')],
          ] as const).map(([n, label]) => (
            <div key={label} className="rounded-xl bg-white/5 p-3">
              <p className="text-2xl font-black" style={{ color: brand?.primary ?? '#a5b4fc' }}>{n}</p>
              <p className="text-xs text-white/50">{label}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 rounded-xl bg-white/5 p-4">
          <p className="mb-2 font-bold">{t('myRoom')}</p>
          {!loaded ? (
            <p className="text-sm text-white/50">{t('loading')}</p>
          ) : fixedPin ? (
            <div className="flex items-center gap-4">
              <div className="shrink-0 rounded-lg bg-white p-1">
                <QRCodeView text={joinUrl} size={96} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-3xl font-black tracking-widest" style={{ color: brand?.primary ?? '#a5b4fc' }}>{fixedPin}</p>
                <p className="mb-2 truncate text-xs text-white/40" title={joinUrl}>{joinUrl}</p>
                <button onClick={copyLink} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">
                  {copied ? t('linkCopied') : t('copyLink')}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/60">{t('noFixedPin')}</p>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-white/50">🌐</span>
          <LangSwitcher />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onBranding}
            className="flex-1 rounded-lg bg-white/10 p-3 font-bold hover:bg-white/20"
          >
            {t('customizeBrand')}
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg bg-red-500/20 px-4 py-3 font-bold text-red-300 hover:bg-red-500/30"
          >
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
