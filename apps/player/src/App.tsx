import { useEffect, useRef, useState, type ReactNode } from 'react';
import { OPTION_SHAPES, MAX_NICKNAME_LENGTH, AVATARS, REACTIONS, optColor, applyBrandVars, brandName as toBrandName, type Brand } from '@karick/shared';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

/** PIN inicial: aceita /sala/123456 (link permanente) e ?pin=123456. */
function initialPin(): string {
  const m = window.location.pathname.match(/\/sala\/(\d{4,8})/);
  return m ? m[1] : new URLSearchParams(window.location.search).get('pin') ?? '';
}
import { usePlayerSocket } from './hooks/usePlayerSocket.js';
import { TimerBar } from './TimerBar.js';
import { sfx } from './lib/sound.js';
import { buildResultCard } from './lib/resultCard.js';

const randomAvatar = () => AVATARS[Math.floor(Math.random() * AVATARS.length)];

const NICK_ADJ = ['Veloz', 'Ninja', 'Turbo', 'Astuto', 'Épico', 'Feroz', 'Radiante', 'Cósmico', 'Mestre', 'Bravo'];
const NICK_NOUN = ['Raposa', 'Panda', 'Tigre', 'Falcão', 'Dragão', 'Foguete', 'Golfinho', 'Coruja', 'Lobo', 'Pinguim'];
const randomNickname = () => {
  const n = `${NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)]} ${NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)]}`;
  return n.slice(0, MAX_NICKNAME_LENGTH);
};

function Center({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-xl text-slate-700">
      {children}
    </div>
  );
}

/** Imagem que se revela (espelha o telão): borrada → nítida ao longo do tempo. */
function RevealImg({ src, durationSec, resetKey }: { src: string; durationSec: number; resetKey: number | string }) {
  const [sharp, setSharp] = useState(false);
  useEffect(() => {
    setSharp(false);
    const id = requestAnimationFrame(() => setSharp(true));
    return () => cancelAnimationFrame(id);
  }, [resetKey]);
  return (
    <div className="overflow-hidden rounded-lg">
      <img
        src={src}
        alt=""
        className="max-h-[28vh] object-contain"
        style={{
          filter: sharp ? 'blur(0px)' : 'blur(18px)',
          transform: sharp ? 'scale(1)' : 'scale(1.15)',
          transition: `filter ${durationSec}s linear, transform ${durationSec}s linear`,
        }}
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    </div>
  );
}

function ReconnectBanner() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 py-1 text-center text-sm font-bold text-white">
      Reconectando… ⏳
    </div>
  );
}

function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center gap-1 bg-black/30 p-1 backdrop-blur">
      {REACTIONS.map((e) => (
        <button
          key={e}
          onClick={() => onReact(e)}
          aria-label={`Reagir com ${e}`}
          className="rounded-full px-2 py-1 text-2xl transition active:scale-125"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const { screen, error, reconnecting, question, timer, feedback, reveal, paused, join, answer, react, usePowerup, team, brandName } = usePlayerSocket();
  const [pin, setPin] = useState(initialPin);
  // Marca da sala buscada por PIN (página pública /sala/:pin), antes de entrar.
  const [roomBrand, setRoomBrand] = useState<Brand | null>(null);
  const [roomMissing, setRoomMissing] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  useEffect(() => {
    const p = initialPin();
    if (!p) return;
    fetch(`${SERVER_URL}/api/room/${p}`)
      .then((r) => r.json())
      .then((data: { exists: boolean; brand?: Brand | null }) => {
        if (!data.exists) return setRoomMissing(true);
        if (data.brand) {
          setRoomBrand(data.brand);
          applyBrandVars(data.brand);
        }
      })
      .catch(() => {});
  }, []);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(randomAvatar);
  const [showText, setShowText] = useState(false);
  // Modo acessível (baixa visão): texto grande, alto contraste, texto das alternativas sempre visível.
  const [a11y, setA11y] = useState(() => localStorage.getItem('karick.a11y') === '1');
  const setAccessible = (v: boolean) => {
    setA11y(v);
    localStorage.setItem('karick.a11y', v ? '1' : '0');
  };
  const wantsText = showText || a11y; // modo acessível sempre mostra o texto no celular
  const [expired, setExpired] = useState(false);
  const [teamOptions, setTeamOptions] = useState<string[] | null>(null);
  const [powerups, setPowerups] = useState({ fiftyFifty: true, double: true, freeze: true });
  const [keep, setKeep] = useState<number[] | null>(null); // 50/50: opções a manter
  const [activeScoring, setActiveScoring] = useState<'double' | 'freeze' | null>(null);
  const [wagerPct, setWagerPct] = useState(50); // modo aposta
  const [eliminated, setEliminated] = useState(false); // modo sobrevivência

  // Jornada da partida (para as conquistas do cartão final).
  const [journey, setJourney] = useState({ maxStreak: 0, worstRank: 1, corrects: 0, questions: 0 });
  const journeyQ = useRef(-1); // última pergunta contabilizada

  // Sobrevivência: eliminado ao errar/não responder. Reinicia por partida.
  useEffect(() => {
    if (screen === 'LOBBY') {
      setEliminated(false);
      setJourney({ maxStreak: 0, worstRank: 1, corrects: 0, questions: 0 });
      journeyQ.current = -1;
    }
  }, [screen]);

  // Contabiliza cada pergunta uma única vez, no feedback (enquete fica de fora).
  useEffect(() => {
    if (screen !== 'FEEDBACK' || !question || journeyQ.current === question.index) return;
    journeyQ.current = question.index;
    if (question.type === 'poll') return;
    setJourney((j) => ({
      maxStreak: Math.max(j.maxStreak, feedback?.streak ?? 0),
      worstRank: Math.max(j.worstRank, reveal?.rank ?? j.worstRank),
      corrects: j.corrects + (feedback?.isCorrect ? 1 : 0),
      questions: j.questions + 1,
    }));
  }, [screen, question, feedback, reveal]);
  useEffect(() => {
    if (screen === 'FEEDBACK' && question?.mode === 'survival' && (!feedback || !feedback.isCorrect)) {
      setEliminated(true);
    }
  }, [screen, question, feedback]);

  // Power-ups: disponibilidade reinicia por partida; efeitos reiniciam por pergunta.
  useEffect(() => {
    if (screen === 'LOBBY') setPowerups({ fiftyFifty: true, double: true, freeze: true });
  }, [screen]);
  useEffect(() => {
    setKeep(null);
    setActiveScoring(null);
  }, [question?.index]);

  const doPowerup = async (type: 'fiftyFifty' | 'double' | 'freeze') => {
    const res = await usePowerup(type);
    if (res.ok) {
      setPowerups((p) => ({ ...p, [type]: false }));
      if (type === 'fiftyFifty') setKeep(res.keep ?? null);
      else setActiveScoring(type);
    }
  };

  // Reinicia o "expirado" a cada nova pergunta ou quando o tempo é estendido.
  useEffect(() => {
    if (screen === 'QUESTION') setExpired(false);
  }, [screen, question?.index, timer.key]);

  // Acessibilidade: responder pelo teclado (1–4) em perguntas de alternativas.
  useEffect(() => {
    if (screen !== 'QUESTION' || !question || paused || expired || question.type === 'text') return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      const opts = keep ?? Array.from({ length: question.optionsCount }, (_, i) => i);
      if (n >= 1 && n <= opts.length) handleAnswer(opts[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, question, paused, expired, keep]);

  // Som + vibração de acerto/erro ao receber o feedback.
  useEffect(() => {
    if (screen === 'FEEDBACK' && feedback) {
      feedback.isCorrect ? sfx.correct() : sfx.wrong();
      navigator.vibrate?.(feedback.isCorrect ? 80 : [90, 60, 90]);
    }
  }, [screen, feedback]);

  const bank = question?.bank ?? 0;
  const wager = Math.max(1, Math.round((bank * wagerPct) / 100));
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [question?.index]);
  const handleAnswer = (i: number) => {
    sfx.tap();
    navigator.vibrate?.(15);
    answer({ optionIndex: i }, question?.mode === 'betting' ? wager : undefined);
  };
  const handleTyped = () => {
    if (!typed.trim()) return;
    sfx.tap();
    navigator.vibrate?.(15);
    answer({ text: typed.trim() }, question?.mode === 'betting' ? wager : undefined);
  };

  if (screen === 'JOIN') {
    return (
      <form
        className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await join(pin, nickname, avatar, undefined, wantsText);
          if (res.needTeam) setTeamOptions(res.teams ?? []);
        }}
      >
        {roomBrand ? (
          <div className="mb-4 flex flex-col items-center gap-2 rounded-2xl p-5 text-white" style={{ background: 'var(--k-bg, #0f172a)' }}>
            {roomBrand.logo && /^https?:\/\//i.test(roomBrand.logo) && !logoErr ? (
              <img src={roomBrand.logo} alt="" className="max-h-16 object-contain" onError={() => setLogoErr(true)} />
            ) : (
              <h1 className="text-3xl font-black" style={{ color: 'var(--k-primary, #a5b4fc)' }}>
                {toBrandName(roomBrand) === 'Karick' ? brandName : toBrandName(roomBrand)}
              </h1>
            )}
            <p className="text-sm text-white/70">Entre para jogar</p>
          </div>
        ) : (
          <h1 className="mb-4 text-center text-4xl font-black text-indigo-600">{brandName}</h1>
        )}
        {roomMissing && (
          <p className="mb-1 rounded-lg bg-amber-100 p-2 text-center text-sm text-amber-800">
            Sala não encontrada — confira o PIN com o apresentador.
          </p>
        )}
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="PIN da sala"
          inputMode="numeric"
          className="rounded-lg border p-4 text-center text-xl"
        />
        <div className="flex gap-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Seu apelido"
            maxLength={MAX_NICKNAME_LENGTH}
            className="flex-1 rounded-lg border p-4 text-center text-xl"
          />
          <button
            type="button"
            onClick={() => setNickname(randomNickname())}
            title="Surpreenda-me"
            aria-label="Gerar apelido aleatório"
            className="rounded-lg border px-4 text-2xl"
          >
            🎲
          </button>
        </div>

        <p className="text-center text-sm text-slate-500">Escolha seu avatar</p>
        <div className="grid grid-cols-8 gap-1">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => setAvatar(a)}
              className={`rounded-lg p-1 text-2xl ${a === avatar ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-slate-100'}`}
            >
              {a}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
          Mostrar o texto das perguntas no meu celular
        </label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-100 p-2 text-base font-bold text-slate-700">
          <input type="checkbox" checked={a11y} onChange={(e) => setAccessible(e.target.checked)} className="h-5 w-5" />
          ♿ Modo acessível — texto grande e alto contraste
        </label>

        {teamOptions ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <p className="mb-2 text-center text-sm font-bold text-indigo-700">Escolha sua equipe</p>
            <div className="grid grid-cols-2 gap-2">
              {teamOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => join(pin, nickname, avatar, t, showText)}
                  className="rounded-lg bg-indigo-600 p-3 font-bold text-white active:scale-95"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button className="rounded-lg bg-indigo-600 p-4 text-lg font-bold text-white active:scale-95">
            Entrar como {avatar}
          </button>
        )}
        {error && <p className="text-center text-red-600">{error}</p>}
      </form>
    );
  }

  if (error) return <Center>⚠️ {error}</Center>;

  if (screen === 'LOBBY')
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-xl text-white" style={{ background: 'var(--k-bg, #0f172a)' }}>
        <div>
          <p className="mb-2 text-2xl font-black" style={{ color: 'var(--k-primary, #a5b4fc)' }}>{brandName}</p>
          ✅ Você entrou! Aguarde o apresentador iniciar…
          {team && <p className="mt-3 text-lg font-bold" style={{ color: 'var(--k-primary, #a5b4fc)' }}>Equipe: {team}</p>}
        </div>
      </div>
    );

  if (screen === 'QUESTION' && question) {
    return (
      <div className="flex h-screen flex-col pb-12 text-white" style={{ background: 'var(--k-bg, #0f172a)' }}>
        {reconnecting && <ReconnectBanner />}
        {paused && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <span className="text-6xl">⏸</span>
            <span className="text-2xl font-bold">Pausado</span>
            <span className="text-white/60">Aguarde o apresentador retomar</span>
          </div>
        )}
        <ReactionBar onReact={react} />
        <TimerBar
          durationSec={timer.durationSec || question.timeLimitSec}
          resetKey={timer.key}
          onExpire={() => setExpired(true)}
        />
        {question.text && (
          <h2 className={`px-3 pt-1 text-center font-bold text-white ${a11y ? 'text-2xl' : 'text-lg'}`}>{question.text}</h2>
        )}
        {question.imageUrl && (
          <div className="flex justify-center px-3 pb-1">
            {question.imageReveal ? (
              <RevealImg src={question.imageUrl} durationSec={timer.durationSec || question.timeLimitSec} resetKey={timer.key} />
            ) : (
              <img
                src={question.imageUrl}
                alt=""
                className="max-h-[28vh] rounded-lg object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
          </div>
        )}
        {eliminated && question.mode === 'survival' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-white/60">
            <span className="text-5xl">💀</span>
            <span className="text-2xl">Eliminado — assistindo</span>
          </div>
        ) : expired ? (
          <div className="flex flex-1 items-center justify-center text-2xl text-white/60">
            Tempo esgotado ⏰
          </div>
        ) : (
          <>
            {question.type === 'poll' ? (
              <p className="px-3 pb-1 text-center text-sm text-white/70">🗳️ Enquete — vote na sua opção (sem pontos)</p>
            ) : question.mode === 'betting' ? (
              <div className="px-3 pb-1 text-center">
                <p className="text-sm text-white/70">Banco: <b>{bank}</b> · apostando <b>{wager}</b></p>
                <div className="mt-1 flex justify-center gap-2">
                  {[25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setWagerPct(pct)}
                      className={`rounded-lg px-3 py-1 text-sm font-bold ${wagerPct === pct ? 'text-white' : 'bg-white/15 text-white'}`}
                      style={wagerPct === pct ? { background: 'var(--k-primary, #4f46e5)' } : undefined}
                    >
                      {pct === 100 ? 'Tudo' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex justify-center gap-2 px-3 pb-1">
                {question.type !== 'text' && (
                  <button
                    onClick={() => doPowerup('fiftyFifty')}
                    disabled={!powerups.fiftyFifty || !!keep}
                    className="rounded-lg bg-white/15 px-3 py-1 text-sm font-bold text-white disabled:opacity-40"
                  >
                    50/50
                  </button>
                )}
                <button
                  onClick={() => doPowerup('double')}
                  disabled={!powerups.double || !!activeScoring}
                  className={`rounded-lg px-3 py-1 text-sm font-bold disabled:opacity-40 ${activeScoring === 'double' ? 'bg-green-500 text-white' : 'bg-white/15 text-white'}`}
                >
                  2× pontos
                </button>
                <button
                  onClick={() => doPowerup('freeze')}
                  disabled={!powerups.freeze || !!activeScoring}
                  className={`rounded-lg px-3 py-1 text-sm font-bold disabled:opacity-40 ${activeScoring === 'freeze' ? 'bg-cyan-500 text-white' : 'bg-white/15 text-white'}`}
                >
                  ⏱ congelar
                </button>
              </div>
            )}
            {question.type === 'text' ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
                <p className="text-sm text-white/70">✍️ Digite sua resposta</p>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTyped()}
                  maxLength={200}
                  autoFocus
                  className="w-full max-w-md rounded-xl p-4 text-center text-xl text-slate-800 outline-none"
                  placeholder="Sua resposta…"
                />
                <button
                  onClick={handleTyped}
                  disabled={!typed.trim()}
                  className="w-full max-w-md rounded-xl p-4 text-xl font-bold text-white active:scale-95 disabled:opacity-40"
                  style={{ background: 'var(--k-primary, #4f46e5)' }}
                >
                  Enviar
                </button>
              </div>
            ) : (
              <div className="grid flex-1 grid-cols-2 gap-3 p-3">
                {(keep ?? Array.from({ length: question.optionsCount }, (_, i) => i)).map((i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 text-white transition active:scale-95 ${question.options ? (a11y ? 'text-3xl font-black' : 'text-xl font-bold') : 'text-6xl'}`}
                    style={{ background: optColor(i), textShadow: a11y ? '0 2px 4px rgba(0,0,0,0.85)' : undefined }}
                  >
                    <span className={question.options ? (a11y ? 'text-4xl' : 'text-3xl') : ''}>{OPTION_SHAPES[i]}</span>
                    {question.options && <span>{question.options[i]}</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (screen === 'ANSWERED')
    return (
      <>
        {reconnecting && <ReconnectBanner />}
        <div className="flex min-h-screen items-center justify-center p-6 text-center text-xl text-white" style={{ background: 'var(--k-bg, #0f172a)' }}>
          Resposta enviada! Aguardando os outros… ⏳
        </div>
        <ReactionBar onReact={react} />
      </>
    );

  if (screen === 'FEEDBACK') {
    const isPoll = question?.type === 'poll';
    const answered = !!feedback;
    const correct = feedback?.isCorrect ?? false;
    const bg = isPoll ? '' : !answered ? 'bg-slate-700' : correct ? 'bg-green-600' : 'bg-red-600';
    const gained = reveal?.gained ?? feedback?.pointsAwarded ?? 0;
    const total = reveal?.score ?? feedback?.totalScore;

    // Enquete: sem certo/errado — só confirma o voto.
    if (isPoll) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-white" style={{ background: 'var(--k-bg, #0f172a)' }}>
          <h1 className="text-5xl font-black">🗳️</h1>
          <p className="text-2xl font-bold">{answered ? 'Voto registrado!' : 'Enquete encerrada'}</p>
          <p className="text-lg text-white/70">Veja o resultado no telão</p>
          <ReactionBar onReact={react} />
        </div>
      );
    }

    return (
      <div className={`flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-white ${bg}`}>
        <h1 className="text-5xl font-black">
          {!answered ? 'Tempo esgotado ⏰' : correct ? 'Acertou! 🎉' : 'Errou 😢'}
        </h1>

        {reveal && reveal.correctText && (
          <div className="flex items-center gap-2 rounded-lg bg-black/20 px-4 py-2 text-lg">
            <span className="opacity-80">Resposta certa:</span>
            {reveal.correctIndex >= 0 && (
              <span className="text-2xl" style={{ color: optColor(reveal.correctIndex) }}>
                {OPTION_SHAPES[reveal.correctIndex]}
              </span>
            )}
            <b>{reveal.correctText}</b>
          </div>
        )}

        <p className="text-2xl font-bold">{gained > 0 ? `+${gained} pontos` : 'sem pontos'}</p>
        {feedback && feedback.streak > 1 && (
          <p className="rounded-full bg-black/20 px-4 py-1 text-lg font-bold">
            🔥 {feedback.streak} seguidas!
            {feedback.streakBonus > 0 && <span className="opacity-90"> (+{feedback.streakBonus} bônus)</span>}
          </p>
        )}
        {total !== undefined && (
          <p className="text-lg opacity-90">
            Total: <b>{total} pts</b>
            {reveal?.rank !== undefined && <> · Você está em <b>{reveal.rank}º</b></>}
          </p>
        )}
        {reveal?.explanation && (
          <p className="mt-2 max-w-md rounded-lg bg-black/20 px-4 py-2 text-base">💡 {reveal.explanation}</p>
        )}
        <ReactionBar onReact={react} />
      </div>
    );
  }

  if (screen === 'OVER') {
    // Conquistas da partida — entram no cartão e como selos na tela.
    const finalRank = reveal?.rank;
    const badges: string[] = [];
    if (finalRank === 1) badges.push('🥇 Campeão da sala');
    if (journey.questions >= 3 && journey.corrects === journey.questions) badges.push('💯 Rodada perfeita');
    if (journey.maxStreak >= 3) badges.push(`🔥 ${journey.maxStreak} seguidas`);
    if (finalRank !== undefined && journey.worstRank - finalRank >= 2) badges.push('📈 Remontada');
    const card = buildResultCard({ nickname, avatar, rank: finalRank, score: reveal?.score ?? feedback?.totalScore, badges });
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-white" style={{ background: 'var(--k-bg, #0f172a)' }}>
        <h1 className="text-2xl font-bold">🏁 Fim de jogo!</h1>
        {badges.length > 0 && (
          <div className="flex max-w-sm flex-wrap justify-center gap-2">
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">{b}</span>
            ))}
          </div>
        )}
        {card && <img src={card} alt="Seu resultado" className="w-full max-w-sm rounded-xl shadow-lg" />}
        {card && (
          <a
            href={card}
            download="karick-resultado.png"
            className="rounded-lg px-6 py-3 font-bold text-white"
            style={{ background: 'var(--k-primary, #4f46e5)' }}
          >
            ⬇ Baixar meu resultado
          </a>
        )}
      </div>
    );
  }

  return <Center>Conectando…</Center>;
}
