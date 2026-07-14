import { useEffect, useState, type ReactNode } from 'react';
import { OPTION_COLORS, OPTION_SHAPES, applyBrandVars, type QuizDraft, type QuestionStat } from '@karick/shared';
import { BrandMark } from './BrandMark.js';
import { useHostSocket } from './hooks/useHostSocket.js';
import { QuizEditor } from './QuizEditor.js';
import { Library } from './Library.js';
import { Auth } from './Auth.js';
import { ResetPassword } from './ResetPassword.js';
import { Avatar } from './Avatar.js';
import { GameSetup } from './GameSetup.js';
import { api, type AuthUser } from './lib/api.js';
import { TimerBar } from './TimerBar.js';
import { Leaderboard } from './Leaderboard.js';
import { QRCodeView } from './QRCode.js';
import { Podium } from './Podium.js';
import { FloatingReactions } from './FloatingReactions.js';
import { QuestionMedia } from './QuestionMedia.js';
import { BrandingModal } from './BrandingModal.js';
import { BankModal } from './BankModal.js';
import { GalleryModal } from './GalleryModal.js';
import { loadBranding, saveBranding } from './lib/branding.js';
import { scheduleTension, startLobbyMusic } from './lib/sound.js';
import { reducedMotion } from './lib/motion.js';
import { Confetti } from './Confetti.js';
import { RevealImage, Hints } from './QuestionFx.js';
import { emptyDraft } from './lib/quizStorage.js';
import { useI18n } from './i18n.js';

const pct = (s: QuestionStat) => (s.answered > 0 ? Math.round((s.correctCount / s.answered) * 100) : 0);

type PreGameView =
  | { screen: 'LIBRARY' }
  | { screen: 'EDITOR'; draft: QuizDraft; quizId: string | null };

export function App() {
  const { t } = useI18n();
  const g = useHostSocket();
  const [view, setView] = useState<PreGameView>({ screen: 'LIBRARY' });
  const [authUser, setAuthUser] = useState<AuthUser | null | 'loading'>('loading');
  const [setupDraft, setSetupDraft] = useState<QuizDraft | null>(null);
  const [branding, setBranding] = useState(loadBranding);
  const [showBranding, setShowBranding] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [libKey, setLibKey] = useState(0); // força recarregar a biblioteca (ex.: após clonar)
  // Token de redefinição de senha vindo do link do e-mail (/host/?reset=TOKEN).
  const [resetToken, setResetToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get('reset'));
  // Modo clássico: editor enxuto e host direto (individual), sem opções avançadas.
  const [simple, setSimple] = useState(() => localStorage.getItem('karick.simpleMode') === '1');
  const toggleSimple = (v: boolean) => {
    setSimple(v);
    localStorage.setItem('karick.simpleMode', v ? '1' : '0');
  };
  // Quantos jogadores exibir no ranking do telão (0 = todos). Preferência salva,
  // usada tanto no modo clássico quanto como padrão do modo completo.
  const [leaderboardLimit, setLeaderboardLimit] = useState(() => Number(localStorage.getItem('karick.leaderboardLimit')) || 0);
  const changeLeaderboardLimit = (v: number) => {
    setLeaderboardLimit(v);
    localStorage.setItem('karick.leaderboardLimit', String(v));
  };

  // Cor de uma alternativa segundo a paleta da marca (fallback ao padrão).
  const oc = (i: number) => branding.options?.[i] ?? OPTION_COLORS[i];

  useEffect(() => {
    api.me().then(setAuthUser).catch(() => setAuthUser(null));
  }, []);

  // Marca persistida no servidor vence a cópia local (vale em qualquer máquina).
  useEffect(() => {
    if (authUser === 'loading' || authUser === null) return;
    api
      .getBrand()
      .then((b) => {
        if (b) {
          const merged = { ...loadBranding(), ...b };
          setBranding(merged);
          saveBranding(merged);
        }
      })
      .catch(() => {});
  }, [authUser]);

  // Aplica a paleta da marca como variáveis CSS do documento.
  useEffect(() => {
    applyBrandVars(branding);
  }, [branding]);

  // Tensão sonora nos últimos segundos de cada pergunta (telão).
  useEffect(() => {
    if (g.phase !== 'QUESTION') return;
    return scheduleTension(g.timer.durationSec);
  }, [g.phase, g.timer.key, g.timer.durationSec]);

  // Fonte ampliada no telão (acessibilidade / projetores distantes).
  const [bigText, setBigText] = useState(() => localStorage.getItem('karick.bigText') === '1');
  const toggleBigText = () => setBigText((v) => {
    localStorage.setItem('karick.bigText', v ? '0' : '1');
    return !v;
  });

  // Música ambiente enquanto os jogadores entram (com botão de mudo).
  const [musicOn, setMusicOn] = useState(true);
  useEffect(() => {
    if (g.phase !== 'LOBBY' || !musicOn) return;
    return startLobbyMusic();
  }, [g.phase, musicOn]);

  const logout = async () => {
    await api.logout().catch(() => {});
    setAuthUser(null);
    setView({ screen: 'LIBRARY' });
    g.reauth(); // handshake sem o cookie antigo
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  // ─── PRÉ-JOGO: exige login, depois biblioteca ou editor ───
  if (g.phase === 'PREGAME') {
    // Link de redefinição de senha tem prioridade sobre o login.
    if (resetToken)
      return (
        <ResetPassword
          token={resetToken}
          brand={branding}
          onDone={(u) => {
            // Limpa o ?reset= da URL e entra logado.
            window.history.replaceState(null, '', '/host/');
            setResetToken(null);
            setAuthUser(u);
            g.reauth();
          }}
        />
      );
    if (authUser === 'loading')
      return <Screen dark>{t('loading')}</Screen>;
    if (authUser === null)
      return (
        <Auth
          onAuthed={(u) => {
            setAuthUser(u);
            g.reauth(); // o cookie de sessão só entra num handshake novo
          }}
          brand={branding}
        />
      );
    // Modo clássico hospeda direto (individual); modo avançado abre o GameSetup.
    const hostDraft = async (draft: QuizDraft) => {
      if (simple) {
        const err = await g.createRoom(draft, [], 'individual', false, branding, false, leaderboardLimit);
        if (err) alert(err);
      } else {
        setSetupDraft(draft);
      }
    };

    const setup = setupDraft && (
      <GameSetup
        initialLimit={leaderboardLimit}
        onCancel={() => setSetupDraft(null)}
        onConfirm={async (mode, teams, shuffle, fixedPin, limit) => {
          const draft = setupDraft;
          setSetupDraft(null);
          changeLeaderboardLimit(limit); // lembra a escolha para a próxima vez
          const err = await g.createRoom(draft, teams, mode, shuffle, branding, fixedPin, limit);
          if (err) alert(err);
        }}
      />
    );

    if (view.screen === 'EDITOR')
      return (
        <div className="min-h-screen" style={{ background: branding.bg }}>
          <QuizEditor
            connected={g.connected}
            initialDraft={view.draft}
            quizId={view.quizId}
            simple={simple}
            onStart={async (draft) => {
              await hostDraft(draft);
              return null;
            }}
            onBack={() => setView({ screen: 'LIBRARY' })}
            onSavedId={(id) => setView((v) => (v.screen === 'EDITOR' ? { ...v, quizId: id } : v))}
          />
          {setup}
        </div>
      );
    return (
      <div className="min-h-screen" style={{ background: branding.bg }}>
        <Library
          key={libKey}
          brand={branding}
          userEmail={authUser.email}
          simple={simple}
          onToggleSimple={toggleSimple}
          leaderboardLimit={leaderboardLimit}
          onLeaderboardLimit={changeLeaderboardLimit}
          onLogout={logout}
          onBranding={() => setShowBranding(true)}
          onBank={() => setShowBank(true)}
          onGallery={() => setShowGallery(true)}
          onNew={() => setView({ screen: 'EDITOR', draft: emptyDraft(), quizId: null })}
          onEdit={(quizId, draft) => setView({ screen: 'EDITOR', draft, quizId })}
          onHost={hostDraft}
        />
        {setup}
        {showBranding && (
          <BrandingModal
            initial={branding}
            onClose={() => setShowBranding(false)}
            onSave={(b) => {
              saveBranding(b);
              setBranding(b);
              setShowBranding(false);
              api.setBrand(b).catch(() => {}); // persiste no servidor (melhor esforço)
            }}
          />
        )}
        {showBank && (
          <BankModal
            onClose={() => setShowBank(false)}
            onDraw={(draft) => {
              setShowBank(false);
              setView({ screen: 'EDITOR', draft, quizId: null });
            }}
          />
        )}
        {showGallery && (
          <GalleryModal
            onClose={() => setShowGallery(false)}
            onCloned={() => setLibKey((k) => k + 1)}
          />
        )}
      </div>
    );
  }

  // ─── LOBBY: PIN + QR code + jogadores entrando ───
  if (g.phase === 'LOBBY') {
    const joinUrl = `${window.location.origin}/?pin=${g.pin}`;
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-white" style={{ background: branding.bg }}>
        <div className="absolute right-4 top-4 flex gap-2">
          <button onClick={toggleBigText} title={t('biggerFont')} aria-label={t('biggerFont')} className={`rounded-lg px-3 py-2 font-bold hover:bg-white/20 ${bigText ? 'bg-white/25' : 'bg-white/10'}`}>
            A+
          </button>
          <button onClick={() => setMusicOn((m) => !m)} title={t('lobbyMusic')} aria-label={t('lobbyMusic')} className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">
            {musicOn ? '🔊' : '🔇'}
          </button>
          <button onClick={toggleFullscreen} title={t('fullscreen')} aria-label={t('fullscreen')} className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">
            ⛶
          </button>
        </div>
        <BrandMark brand={branding} imgClass="max-h-20" nameClass="text-4xl font-black tracking-wide" />
        {g.mode !== 'individual' && (
          <span className="rounded-full px-4 py-1 text-sm font-bold" style={{ background: `${branding.primary}33`, color: branding.primary }}>
            {t('mode', { mode: g.mode === 'teams' ? t('modeTeams') : g.mode === 'betting' ? t('modeBetting') : t('modeSurvival') })}
          </span>
        )}
        <div className="flex flex-wrap items-center justify-center gap-10">
          <div className="text-center">
            <p className="mb-2 text-xl opacity-70">{t('accessAndPin')}</p>
            <p className="text-lg opacity-50">{window.location.host}</p>
            <h1 className="text-7xl font-black tracking-[0.15em]" style={{ color: branding.primary }}>{g.pin || '…'}</h1>
          </div>
          <div className="text-center">
            {g.pin && <QRCodeView text={joinUrl} size={200} />}
            <p className="mt-2 text-sm opacity-60">{t('orAimCamera')}</p>
          </div>
        </div>

        {g.teams.length > 0 ? (
          <div className="flex max-w-5xl flex-wrap justify-center gap-6">
            {g.teams.map((tname) => (
              <div key={tname} className="min-w-[10rem] rounded-xl bg-white/5 p-3">
                <p className="mb-2 text-center font-bold" style={{ color: branding.primary }}>
                  {tname} ({g.players.filter((p) => p.team === tname).length})
                </p>
                <div className="flex flex-col gap-1">
                  {g.players.filter((p) => p.team === tname).map((p) => (
                    <span key={p.nickname} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                      <Avatar value={p.avatar} className="text-lg" />
                      {p.nickname}
                      <button onClick={() => g.kick(p.nickname)} title={t('remove')} aria-label={t('removePlayer', { name: p.nickname })} className="ml-auto text-white/30 hover:text-red-400">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex max-w-4xl flex-wrap justify-center gap-2">
            {g.players.map((p) => (
              <span key={p.nickname} className="group flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-lg">
                <Avatar value={p.avatar} className="text-xl" />
                {p.nickname}
                <button
                  onClick={() => g.kick(p.nickname)}
                  title={t('remove')}
                  aria-label={t('removePlayer', { name: p.nickname })}
                  className="ml-1 text-white/30 hover:text-red-400"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <button
          onClick={g.start}
          disabled={g.players.length === 0}
          className="rounded-xl bg-green-500 px-10 py-4 text-2xl font-bold disabled:opacity-40"
        >
          {t('start', { n: g.players.length })}
        </button>
      </div>
    );
  }

  // ─── QUESTION: pergunta + opções + tempo + progresso ───
  if (g.phase === 'QUESTION' && g.question)
    return (
      <div className="flex min-h-screen flex-col" style={{ background: branding.bg }}>
        <FloatingReactions items={g.reactions} />
        <div className="flex items-center justify-between p-6 text-white/60">
          <span className="flex items-center gap-3 text-xl">
            {t('questionOf', { i: g.question.index + 1, total: g.question.total })}
            {g.question.type === 'poll' && (
              <span className="rounded-full px-3 py-0.5 text-sm font-bold" style={{ background: `${branding.primary}33`, color: branding.primary }}>
                {t('poll')}
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/10 px-4 py-1 text-xl font-bold text-white">
              {t('answeredCount', { a: g.answeredCount, t: g.players.length })}
            </span>
            <button onClick={g.addTime} className="rounded-lg bg-white/10 px-3 py-1 font-bold text-white hover:bg-white/20">
              {t('addTime')}
            </button>
            <button onClick={g.togglePause} className="rounded-lg bg-white/10 px-3 py-1 font-bold text-white hover:bg-white/20">
              {g.paused ? t('resume') : t('pause')}
            </button>
            <button onClick={g.revealNow} className="rounded-lg px-3 py-1 font-bold text-white" style={{ background: branding.primary }}>
              {t('revealNow')}
            </button>
          </div>
        </div>

        <div className="relative px-10">
          <TimerBar durationSec={g.timer.durationSec} resetKey={g.timer.key} paused={g.paused} />
          {g.paused && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/70 px-4 py-1 text-sm font-bold text-white">{t('paused')}</span>
            </div>
          )}
        </div>

        {/* Feed ao vivo: avatares de quem já respondeu (altura fixa para não pular o layout). */}
        <div className="flex min-h-[3rem] flex-wrap items-center justify-center gap-2 px-10 pt-2">
          {g.answeredWho.map((w) => (
            <PopAvatar key={w.nickname} avatar={w.avatar} nickname={w.nickname} />
          ))}
        </div>

        <h2 className={`px-10 pt-4 text-center font-bold text-white ${bigText ? 'text-7xl' : 'text-5xl'}`}>{g.question.text}</h2>

        {g.question.imageUrl && (
          <div className="flex justify-center px-10 py-4">
            {g.question.imageReveal ? (
              <RevealImage src={g.question.imageUrl} durationSec={g.timer.durationSec} resetKey={g.timer.key} />
            ) : (
              <img
                src={g.question.imageUrl}
                alt=""
                className="max-h-[32vh] rounded-xl object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
          </div>
        )}

        {g.question.hints && g.question.hints.length > 0 && (
          <Hints hints={g.question.hints} durationSec={g.timer.durationSec} resetKey={g.timer.key} />
        )}

        {(g.question.audioUrl || g.question.videoUrl || g.question.code || g.question.latex) && (
          <div className="py-3">
            <QuestionMedia audioUrl={g.question.audioUrl} videoUrl={g.question.videoUrl} audioOnly={g.question.audioOnly} code={g.question.code} latex={g.question.latex} />
          </div>
        )}

        {g.question.type === 'text' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-white/80">
            <span className="text-7xl">✍️</span>
            <span className="text-3xl font-bold">{t('answerByTyping')}</span>
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-2 gap-4 p-6">
            {g.question.options.map((opt, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 rounded-xl p-6 font-bold text-white ${bigText ? 'text-5xl' : 'text-3xl'}`}
                style={{ background: oc(i) }}
              >
                <span className={bigText ? 'text-7xl' : 'text-5xl'}>{OPTION_SHAPES[i]}</span> {opt}
              </div>
            ))}
          </div>
        )}
      </div>
    );

  // ─── REVEAL: resposta certa + placar com ganhos e variação ───
  if (g.phase === 'REVEAL' && g.reveal) {
    const isLast = g.question ? g.question.index >= g.question.total - 1 : false;
    const qType = g.question?.type ?? 'choice';
    return (
      <div className="min-h-screen p-10 text-white" style={{ background: branding.bg }}>
        <FloatingReactions items={g.reactions} />
        <div className="mx-auto mb-6 max-w-2xl text-center">
          <p className="mb-2 text-lg text-white/50">{qType === 'poll' ? t('pollResult') : t('correctAnswer')}</p>
          {qType !== 'poll' && (
            <div
              className="inline-flex items-center gap-3 rounded-xl px-8 py-4 text-3xl font-bold"
              style={{ background: g.reveal.correctIndex >= 0 ? oc(g.reveal.correctIndex) : branding.primary }}
            >
              {g.reveal.correctIndex >= 0 && <span className="text-4xl">{OPTION_SHAPES[g.reveal.correctIndex]}</span>}
              {g.reveal.correctText}
            </div>
          )}
          {g.reveal.explanation && (
            <p className="mx-auto mt-3 max-w-xl rounded-lg bg-white/10 px-4 py-2 text-lg text-white/80">
              💡 {g.reveal.explanation}
            </p>
          )}
        </div>

        {g.question && qType !== 'text' && (
          <div className="mx-auto mb-8 flex max-w-2xl items-end justify-center gap-4" style={{ height: 140 }}>
            {g.question.options.map((opt, i) => {
              const count = g.reveal!.distribution[i] ?? 0;
              const max = Math.max(1, ...g.reveal!.distribution);
              const isCorrect = i === g.reveal!.correctIndex;
              return (
                <div key={i} className="flex flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-sm font-bold">{count}</span>
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${(count / max) * 100}%`,
                      minHeight: 4,
                      background: oc(i),
                      opacity: qType === 'poll' || isCorrect ? 1 : 0.45,
                      transition: 'height 700ms ease-out',
                    }}
                  />
                  <span className="mt-1 text-2xl" style={{ color: oc(i) }}>
                    {OPTION_SHAPES[i]}
                    {isCorrect && ' ✓'}
                  </span>
                  {qType === 'poll' && <span className="max-w-full truncate text-sm text-white/70">{opt}</span>}
                </div>
              );
            })}
          </div>
        )}

        {g.reveal.teamLeaderboard && g.reveal.teamLeaderboard.length > 0 && (
          <div className="mx-auto mb-6 max-w-2xl">
            <h2 className="mb-3 text-center text-3xl font-bold">{t('teamScore')} <span className="text-lg font-normal text-white/50">{t('perMember')}</span></h2>
            <ol className="space-y-2">
              {g.reveal.teamLeaderboard.map((tr) => (
                <li key={tr.name} className="flex justify-between rounded-lg px-6 py-3 text-2xl" style={{ background: `${branding.primary}2b` }}>
                  <span>{tr.rank}. {tr.name} <span className="text-base text-white/50">({tr.players})</span></span>
                  <span className="font-bold">{tr.score}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <h2 className="mb-4 text-center text-3xl font-bold">
          {g.reveal.teamLeaderboard ? t('individual') : g.leaderboardLimit ? t('scoreboardTop', { n: g.leaderboardLimit }) : t('scoreboard')}
        </h2>
        <Leaderboard rows={g.leaderboardLimit ? g.reveal.leaderboard.slice(0, g.leaderboardLimit) : g.reveal.leaderboard} />

        <button
          onClick={g.next}
          className="mx-auto mt-10 block rounded-xl px-10 py-4 text-2xl font-bold text-white"
          style={{ background: branding.primary }}
        >
          {isLast ? t('seePodium') : t('next')}
        </button>
      </div>
    );
  }

  // ─── OVER: pódio animado + estatísticas ───
  if (g.phase === 'OVER') {
    const hardest = g.stats.length
      ? g.stats.reduce((worst, s) =>
          pct(s) < pct(worst) ? s : worst,
        )
      : null;
    return (
      <div className="flex min-h-screen flex-col items-center gap-8 py-10 text-white" style={{ background: branding.bg }}>
        <Confetti colors={[branding.primary ?? '#6366f1', ...(branding.options ?? OPTION_COLORS), '#ffffff']} />
        <BrandMark brand={branding} imgClass="max-h-16" nameClass="text-3xl font-black" />
        <h1 className="text-5xl font-black">{t('podium')}</h1>
        {g.teamPodium.length > 0 && (
          <div className="w-full max-w-md">
            <ol className="space-y-2">
              {g.teamPodium.map((tr) => (
                <li key={tr.name} className="flex justify-between rounded-lg px-6 py-3 text-2xl" style={{ background: `${branding.primary}2b` }}>
                  <span>{['🥇', '🥈', '🥉'][tr.rank - 1] ?? `${tr.rank}.`} {tr.name}</span>
                  <span className="font-bold">{tr.score}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-center text-sm text-white/50">{t('individualBelow')}</p>
          </div>
        )}
        <Podium top={g.podium} />

        {g.stats.length > 0 && (
          <div className="w-full max-w-2xl px-6">
            <h2 className="mb-2 text-center text-2xl font-bold text-white/80">{t('perQuestion')}</h2>
            <p className="mb-3 text-center text-white/60">
              {t('avgCorrect', { n: Math.round(g.stats.reduce((a, s) => a + pct(s), 0) / g.stats.length) })}
              {hardest && t('hardest', { text: hardest.text, n: pct(hardest) })}
            </p>
            <ul className="space-y-2">
              {g.stats.map((s, i) => {
                const p = pct(s);
                return (
                  <li key={i} className="rounded-lg bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate">
                        {i + 1}. {s.text}
                        {s === hardest && <span className="ml-2 rounded bg-red-500/30 px-2 py-0.5 text-xs text-red-200">{t('hardestTag')}</span>}
                      </span>
                      <span className="shrink-0 font-bold">{p}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-green-500" style={{ width: `${p}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-white/40">{t('gotItRatio', { c: s.correctCount, a: s.answered })}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <button
          onClick={() => location.reload()}
          className="rounded-xl bg-white/10 px-8 py-3 text-xl hover:bg-white/20"
        >
          {t('newGame')}
        </button>
      </div>
    );
  }

  return <Screen dark>{t('loading')}</Screen>;
}

/** Avatar que "pipoca" no telão quando o jogador responde (sem revelar a opção). */
function PopAvatar({ avatar, nickname }: { avatar?: string; nickname: string }) {
  const [shown, setShown] = useState(reducedMotion());
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span
      title={nickname}
      className="rounded-full bg-white/10 px-2 py-1 text-2xl"
      style={{
        transform: shown ? 'scale(1)' : 'scale(0.2)',
        opacity: shown ? 1 : 0,
        transition: reducedMotion() ? 'none' : 'transform 350ms cubic-bezier(.34,1.56,.64,1), opacity 250ms',
      }}
    >
      <Avatar value={avatar} />
    </span>
  );
}

function Screen({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={`flex min-h-screen items-center justify-center p-6 text-center text-2xl ${
        dark ? 'bg-slate-900 text-white' : 'text-slate-700'
      }`}
    >
      {children}
    </div>
  );
}
