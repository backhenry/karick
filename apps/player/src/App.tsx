import { useEffect, useState, type ReactNode } from 'react';
import { OPTION_COLORS, OPTION_SHAPES, MAX_NICKNAME_LENGTH, AVATARS, REACTIONS } from '@karick/shared';
import { usePlayerSocket } from './hooks/usePlayerSocket.js';
import { TimerBar } from './TimerBar.js';
import { sfx } from './lib/sound.js';

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
          className="rounded-full px-2 py-1 text-2xl transition active:scale-125"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const { screen, error, reconnecting, question, timer, feedback, reveal, join, answer, react, usePowerup, team } = usePlayerSocket();
  const [pin, setPin] = useState(() => new URLSearchParams(window.location.search).get('pin') ?? '');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(randomAvatar);
  const [expired, setExpired] = useState(false);
  const [teamOptions, setTeamOptions] = useState<string[] | null>(null);
  const [powerups, setPowerups] = useState({ fiftyFifty: true, double: true, freeze: true });
  const [keep, setKeep] = useState<number[] | null>(null); // 50/50: opções a manter
  const [activeScoring, setActiveScoring] = useState<'double' | 'freeze' | null>(null);
  const [wagerPct, setWagerPct] = useState(50); // modo aposta
  const [eliminated, setEliminated] = useState(false); // modo sobrevivência

  // Sobrevivência: eliminado ao errar/não responder. Reinicia por partida.
  useEffect(() => {
    if (screen === 'LOBBY') setEliminated(false);
  }, [screen]);
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

  // Som de acerto/erro ao receber o feedback.
  useEffect(() => {
    if (screen === 'FEEDBACK' && feedback) {
      feedback.isCorrect ? sfx.correct() : sfx.wrong();
    }
  }, [screen, feedback]);

  const bank = question?.bank ?? 0;
  const wager = Math.max(1, Math.round((bank * wagerPct) / 100));
  const handleAnswer = (i: number) => {
    sfx.tap();
    answer(i, question?.mode === 'betting' ? wager : undefined);
  };

  if (screen === 'JOIN') {
    return (
      <form
        className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await join(pin, nickname, avatar);
          if (res.needTeam) setTeamOptions(res.teams ?? []);
        }}
      >
        <h1 className="mb-4 text-center text-4xl font-black text-indigo-600">Karick</h1>
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

        {teamOptions ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <p className="mb-2 text-center text-sm font-bold text-indigo-700">Escolha sua equipe</p>
            <div className="grid grid-cols-2 gap-2">
              {teamOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => join(pin, nickname, avatar, t)}
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
      <Center>
        <div>
          ✅ Você entrou! Aguarde o apresentador iniciar…
          {team && <p className="mt-3 text-lg font-bold text-indigo-600">Equipe: {team}</p>}
        </div>
      </Center>
    );

  if (screen === 'QUESTION' && question) {
    return (
      <div className="flex h-screen flex-col pb-12">
        {reconnecting && <ReconnectBanner />}
        <ReactionBar onReact={react} />
        <TimerBar
          durationSec={timer.durationSec || question.timeLimitSec}
          resetKey={timer.key}
          onExpire={() => setExpired(true)}
        />
        {question.imageUrl && (
          <div className="flex justify-center px-3 pb-1">
            <img
              src={question.imageUrl}
              alt=""
              className="max-h-[28vh] rounded-lg object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
        {eliminated && question.mode === 'survival' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500">
            <span className="text-5xl">💀</span>
            <span className="text-2xl">Eliminado — assistindo</span>
          </div>
        ) : expired ? (
          <div className="flex flex-1 items-center justify-center text-2xl text-slate-500">
            Tempo esgotado ⏰
          </div>
        ) : (
          <>
            {question.mode === 'betting' ? (
              <div className="px-3 pb-1 text-center">
                <p className="text-sm text-slate-500">Banco: <b>{bank}</b> · apostando <b>{wager}</b></p>
                <div className="mt-1 flex justify-center gap-2">
                  {[25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setWagerPct(pct)}
                      className={`rounded-lg px-3 py-1 text-sm font-bold ${wagerPct === pct ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                    >
                      {pct === 100 ? 'Tudo' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex justify-center gap-2 px-3 pb-1">
                <button
                  onClick={() => doPowerup('fiftyFifty')}
                  disabled={!powerups.fiftyFifty || !!keep}
                  className="rounded-lg bg-slate-200 px-3 py-1 text-sm font-bold text-slate-700 disabled:opacity-40"
                >
                  50/50
                </button>
                <button
                  onClick={() => doPowerup('double')}
                  disabled={!powerups.double || !!activeScoring}
                  className={`rounded-lg px-3 py-1 text-sm font-bold disabled:opacity-40 ${activeScoring === 'double' ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-700'}`}
                >
                  2× pontos
                </button>
                <button
                  onClick={() => doPowerup('freeze')}
                  disabled={!powerups.freeze || !!activeScoring}
                  className={`rounded-lg px-3 py-1 text-sm font-bold disabled:opacity-40 ${activeScoring === 'freeze' ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-700'}`}
                >
                  ⏱ congelar
                </button>
              </div>
            )}
            <div className="grid flex-1 grid-cols-2 gap-3 p-3">
              {(keep ?? Array.from({ length: question.optionsCount }, (_, i) => i)).map((i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className="flex items-center justify-center rounded-xl text-6xl text-white transition active:scale-95"
                  style={{ background: OPTION_COLORS[i] }}
                >
                  {OPTION_SHAPES[i]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (screen === 'ANSWERED')
    return (
      <>
        {reconnecting && <ReconnectBanner />}
        <Center>Resposta enviada! Aguardando os outros… ⏳</Center>
        <ReactionBar onReact={react} />
      </>
    );

  if (screen === 'FEEDBACK') {
    const answered = !!feedback;
    const correct = feedback?.isCorrect ?? false;
    const bg = !answered ? 'bg-slate-700' : correct ? 'bg-green-600' : 'bg-red-600';
    const gained = reveal?.gained ?? feedback?.pointsAwarded ?? 0;
    const total = reveal?.score ?? feedback?.totalScore;
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-white ${bg}`}>
        <h1 className="text-5xl font-black">
          {!answered ? 'Tempo esgotado ⏰' : correct ? 'Acertou! 🎉' : 'Errou 😢'}
        </h1>

        {reveal && (
          <div className="flex items-center gap-2 rounded-lg bg-black/20 px-4 py-2 text-lg">
            <span className="opacity-80">Resposta certa:</span>
            <span className="text-2xl" style={{ color: OPTION_COLORS[reveal.correctIndex] }}>
              {OPTION_SHAPES[reveal.correctIndex]}
            </span>
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

  if (screen === 'OVER') return <Center>🏁 Fim de jogo! Veja o pódio na tela principal.</Center>;

  return <Center>Conectando…</Center>;
}
