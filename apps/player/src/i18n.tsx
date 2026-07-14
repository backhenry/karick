import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type Lang = 'pt' | 'en' | 'es';
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
];

/** Idioma inicial: escolha salva > idioma do navegador > português. */
function detect(): Lang {
  const saved = localStorage.getItem('karick.lang');
  if (saved === 'pt' || saved === 'en' || saved === 'es') return saved;
  const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
  return nav === 'en' ? 'en' : nav === 'es' ? 'es' : 'pt';
}

type Dict = Record<string, string>;

const pt: Dict = {
  enterToPlay: 'Entre para jogar',
  roomNotFound: 'Sala não encontrada — confira o PIN com o apresentador.',
  pinPlaceholder: 'PIN da sala',
  nickPlaceholder: 'Seu apelido',
  randomNick: 'Gerar apelido aleatório',
  chooseAvatar: 'Escolha seu avatar',
  showText: 'Mostrar o texto das perguntas no meu celular',
  a11yMode: '♿ Modo acessível — texto grande e alto contraste',
  hintN: 'Dica {n}:',
  nextHint: 'próxima dica em instantes… ({shown}/{total})',
  chooseTeam: 'Escolha sua equipe',
  enterAs: 'Entrar como {avatar}',
  joinedWait: '✅ Você entrou! Aguarde o apresentador iniciar…',
  team: 'Equipe: {name}',
  paused: 'Pausado',
  pausedWait: 'Aguarde o apresentador retomar',
  pollVote: '🗳️ Enquete — vote na sua opção (sem pontos)',
  bankBetting: 'Banco: {bank} · apostando {wager}',
  all: 'Tudo',
  double: '2× pontos',
  freeze: '⏱ congelar',
  eliminated: 'Eliminado — assistindo',
  timeUp: 'Tempo esgotado ⏰',
  typeAnswer: '✍️ Digite sua resposta',
  answerPlaceholder: 'Sua resposta…',
  send: 'Enviar',
  answerSent: 'Resposta enviada! Aguardando os outros… ⏳',
  voteRegistered: 'Voto registrado!',
  pollClosed: 'Enquete encerrada',
  seeScreen: 'Veja o resultado no telão',
  correct: 'Acertou! 🎉',
  wrong: 'Errou 😢',
  correctAnswer: 'Resposta certa:',
  pointsGained: '+{n} pontos',
  noPoints: 'sem pontos',
  streak: '🔥 {n} seguidas!',
  streakBonus: ' (+{n} bônus)',
  total: 'Total: {n} pts',
  yourRank: ' · Você está em {n}º',
  gameOver: '🏁 Fim de jogo!',
  downloadResult: '⬇ Baixar meu resultado',
  reconnecting: 'Reconectando… ⏳',
  connecting: 'Conectando…',
  badgeChampion: '🥇 Campeão da sala',
  badgePerfect: '💯 Rodada perfeita',
  badgeStreak: '🔥 {n} seguidas',
  badgeComeback: '📈 Remontada',
  // Erros (código vindo do servidor)
  errGeneric: 'Não foi possível entrar',
  errRateLimit: 'Muitas tentativas, aguarde um instante.',
  errNoId: 'Identificador ausente',
  errRoomNotFound: 'Sala não encontrada',
  errInProgress: 'Jogo já iniciado',
  errBadNick: 'Apelido inválido',
  errOffensive: 'Apelido não permitido',
  errNickTaken: 'Apelido já em uso',
  errNeedTeam: 'Escolha uma equipe',
  errInactive: 'Fora de uma pergunta ativa',
  errNoPlayer: 'Você não está na sala',
  errEliminated: 'Você foi eliminado',
  errAlreadyAnswered: 'Você já respondeu',
  errBadAnswer: 'Resposta inválida',
  errKicked: 'Você foi removido pelo apresentador.',
  errHostLeft: 'O apresentador encerrou a sala.',
};

const en: Dict = {
  enterToPlay: 'Join to play',
  roomNotFound: 'Room not found — check the PIN with the host.',
  pinPlaceholder: 'Room PIN',
  nickPlaceholder: 'Your nickname',
  randomNick: 'Generate random nickname',
  chooseAvatar: 'Choose your avatar',
  showText: 'Show question text on my phone',
  a11yMode: '♿ Accessible mode — large text, high contrast',
  hintN: 'Hint {n}:',
  nextHint: 'next hint shortly… ({shown}/{total})',
  chooseTeam: 'Choose your team',
  enterAs: 'Join as {avatar}',
  joinedWait: "✅ You're in! Wait for the host to start…",
  team: 'Team: {name}',
  paused: 'Paused',
  pausedWait: 'Wait for the host to resume',
  pollVote: '🗳️ Poll — vote for your option (no points)',
  bankBetting: 'Bank: {bank} · betting {wager}',
  all: 'All in',
  double: '2× points',
  freeze: '⏱ freeze',
  eliminated: 'Eliminated — spectating',
  timeUp: "Time's up ⏰",
  typeAnswer: '✍️ Type your answer',
  answerPlaceholder: 'Your answer…',
  send: 'Send',
  answerSent: 'Answer sent! Waiting for the others… ⏳',
  voteRegistered: 'Vote recorded!',
  pollClosed: 'Poll closed',
  seeScreen: 'See the result on the big screen',
  correct: 'Correct! 🎉',
  wrong: 'Wrong 😢',
  correctAnswer: 'Correct answer:',
  pointsGained: '+{n} points',
  noPoints: 'no points',
  streak: '🔥 {n} in a row!',
  streakBonus: ' (+{n} bonus)',
  total: 'Total: {n} pts',
  yourRank: ' · You are {n}th',
  gameOver: '🏁 Game over!',
  downloadResult: '⬇ Download my result',
  reconnecting: 'Reconnecting… ⏳',
  connecting: 'Connecting…',
  badgeChampion: '🥇 Room champion',
  badgePerfect: '💯 Perfect round',
  badgeStreak: '🔥 {n} in a row',
  badgeComeback: '📈 Comeback',
  errGeneric: "Couldn't join",
  errRateLimit: 'Too many attempts, wait a moment.',
  errNoId: 'Missing identifier',
  errRoomNotFound: 'Room not found',
  errInProgress: 'Game already started',
  errBadNick: 'Invalid nickname',
  errOffensive: 'Nickname not allowed',
  errNickTaken: 'Nickname already taken',
  errNeedTeam: 'Choose a team',
  errInactive: 'Not in an active question',
  errNoPlayer: 'You are not in the room',
  errEliminated: 'You were eliminated',
  errAlreadyAnswered: 'You already answered',
  errBadAnswer: 'Invalid answer',
  errKicked: 'You were removed by the host.',
  errHostLeft: 'The host closed the room.',
};

const es: Dict = {
  enterToPlay: 'Entra para jugar',
  roomNotFound: 'Sala no encontrada — confirma el PIN con el presentador.',
  pinPlaceholder: 'PIN de la sala',
  nickPlaceholder: 'Tu apodo',
  randomNick: 'Generar apodo aleatorio',
  chooseAvatar: 'Elige tu avatar',
  showText: 'Mostrar el texto de las preguntas en mi celular',
  a11yMode: '♿ Modo accesible — texto grande y alto contraste',
  hintN: 'Pista {n}:',
  nextHint: 'próxima pista en un momento… ({shown}/{total})',
  chooseTeam: 'Elige tu equipo',
  enterAs: 'Entrar como {avatar}',
  joinedWait: '✅ ¡Entraste! Espera a que el presentador empiece…',
  team: 'Equipo: {name}',
  paused: 'Pausado',
  pausedWait: 'Espera a que el presentador reanude',
  pollVote: '🗳️ Encuesta — vota por tu opción (sin puntos)',
  bankBetting: 'Banca: {bank} · apostando {wager}',
  all: 'Todo',
  double: '2× puntos',
  freeze: '⏱ congelar',
  eliminated: 'Eliminado — mirando',
  timeUp: 'Tiempo agotado ⏰',
  typeAnswer: '✍️ Escribe tu respuesta',
  answerPlaceholder: 'Tu respuesta…',
  send: 'Enviar',
  answerSent: '¡Respuesta enviada! Esperando a los demás… ⏳',
  voteRegistered: '¡Voto registrado!',
  pollClosed: 'Encuesta cerrada',
  seeScreen: 'Mira el resultado en la pantalla',
  correct: '¡Correcto! 🎉',
  wrong: 'Incorrecto 😢',
  correctAnswer: 'Respuesta correcta:',
  pointsGained: '+{n} puntos',
  noPoints: 'sin puntos',
  streak: '🔥 ¡{n} seguidas!',
  streakBonus: ' (+{n} bono)',
  total: 'Total: {n} pts',
  yourRank: ' · Estás en {n}º',
  gameOver: '🏁 ¡Fin del juego!',
  downloadResult: '⬇ Descargar mi resultado',
  reconnecting: 'Reconectando… ⏳',
  connecting: 'Conectando…',
  badgeChampion: '🥇 Campeón de la sala',
  badgePerfect: '💯 Ronda perfecta',
  badgeStreak: '🔥 {n} seguidas',
  badgeComeback: '📈 Remontada',
  errGeneric: 'No se pudo entrar',
  errRateLimit: 'Demasiados intentos, espera un momento.',
  errNoId: 'Identificador ausente',
  errRoomNotFound: 'Sala no encontrada',
  errInProgress: 'El juego ya empezó',
  errBadNick: 'Apodo inválido',
  errOffensive: 'Apodo no permitido',
  errNickTaken: 'Apodo ya en uso',
  errNeedTeam: 'Elige un equipo',
  errInactive: 'Fuera de una pregunta activa',
  errNoPlayer: 'No estás en la sala',
  errEliminated: 'Fuiste eliminado',
  errAlreadyAnswered: 'Ya respondiste',
  errBadAnswer: 'Respuesta inválida',
  errKicked: 'El presentador te quitó de la sala.',
  errHostLeft: 'El presentador cerró la sala.',
};

const DICTS: Record<Lang, Dict> = { pt, en, es };

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof pt, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem('karick.lang', l);
    setLangState(l);
  }, []);
  const t = useCallback<I18n['t']>(
    (key, vars) => {
      let s = DICTS[lang][key] ?? pt[key] ?? String(key);
      if (vars) for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
      return s;
    },
    [lang],
  );
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n fora do I18nProvider');
  return ctx;
}

/** Seletor compacto de idioma (PT/EN/ES). */
export function LangSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`flex justify-center gap-1 text-sm ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-label={`Idioma ${l.label}`}
          className={`rounded px-2 py-1 font-bold ${lang === l.code ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
