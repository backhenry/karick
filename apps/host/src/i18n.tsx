import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type Lang = 'pt' | 'en' | 'es';
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
];

function detect(): Lang {
  const saved = localStorage.getItem('karick.lang');
  if (saved === 'pt' || saved === 'en' || saved === 'es') return saved;
  const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
  return nav === 'en' ? 'en' : nav === 'es' ? 'es' : 'pt';
}

type Dict = Record<string, string>;

const pt: Dict = {
  // Auth
  loginSubtitle: 'Entre para gerenciar seus quizzes',
  signupSubtitle: 'Crie sua conta',
  email: 'E-mail',
  password: 'Senha',
  passwordSignup: 'Senha (mín. 8 caracteres)',
  login: 'Entrar',
  signup: 'Criar conta',
  toSignup: 'Não tem conta? Cadastre-se',
  toLogin: 'Já tem conta? Entrar',
  // Comum
  loading: 'Carregando…',
  // Lobby
  accessAndPin: 'Acesse e use o PIN',
  orAimCamera: 'ou aponte a câmera',
  mode: 'Modo: {mode}',
  modeTeams: 'Equipes',
  modeBetting: 'Aposta',
  modeSurvival: 'Sobrevivência',
  poll: '🗳️ Enquete',
  start: 'Iniciar ({n})',
  remove: 'Remover',
  removePlayer: 'Remover {name}',
  lobbyMusic: 'Música do lobby',
  fullscreen: 'Tela cheia',
  biggerFont: 'Fonte maior no telão',
  // Pergunta
  questionOf: 'Pergunta {i} de {total}',
  answeredCount: '{a}/{t} responderam',
  addTime: '+20s',
  pause: '⏸ Pausar',
  resume: '▶ Retomar',
  paused: '⏸ Pausado',
  revealNow: 'Revelar agora ⏭',
  answerByTyping: 'Respondam digitando no celular',
  // Reveal
  correctAnswer: 'Resposta certa',
  pollResult: '🗳️ Resultado da enquete',
  teamScore: 'Placar por equipe',
  perMember: '(média por integrante)',
  individual: 'Individual',
  scoreboard: 'Placar',
  next: 'Próxima →',
  seePodium: 'Ver pódio 🏆',
  // Pódio
  podium: '🏆 Pódio',
  individualBelow: 'Ranking individual abaixo',
  perQuestion: 'Desempenho por pergunta',
  avgCorrect: 'Média de acerto: {n}%',
  hardest: ' · Mais difícil: “{text}” ({n}%)',
  hardestTag: 'mais difícil',
  gotItRatio: '{c} de {a} acertaram',
  newGame: 'Novo jogo',
  // Library
  classic: '🎯 Clássico',
  complete: '🚀 Completo',
  classicHint: 'Só perguntas e respostas — começa a partida com um clique.',
  completeHint: 'Todos os recursos: mídia, modos de jogo, tipos de pergunta, banco e galeria.',
  gallery: '🌐 Galeria',
  bank: '🎲 Banco',
  newQuiz: '+ Novo quiz',
  openProfile: 'Abrir perfil',
  dbWarning: '⚠️ Banco de dados não configurado — os quizzes salvos não persistem entre reinícios do servidor. Configure a variável DATABASE_URL para ativar a persistência.',
  myQuizzes: 'Meus quizzes',
  allTag: 'Todos',
  noQuizzesYet: 'Nenhum quiz salvo ainda.',
  createFirst: 'Criar meu primeiro quiz',
  noQuizzesTag: 'Nenhum quiz com a tag #{tag}.',
  public: '🌐 público',
  questionsCount: '{n} pergunta(s)',
  host: 'Hospedar',
  edit: 'Editar',
  duplicate: 'Duplicar',
  del: 'Excluir',
  confirmDelete: 'Excluir este quiz?',
  lastGames: 'Últimas partidas',
  exportCsv: '⬇ Exportar CSV',
  report: '📋 Relatório',
  // Profile
  presenter: 'Apresentador',
  changePhoto: 'Trocar foto de perfil',
  removePhoto: 'remover foto',
  photoError: 'Não consegui usar essa imagem. Tente outra.',
  statQuizzes: 'quizzes',
  statGames: 'partidas',
  statPlayers: 'jogadores',
  myRoom: '📌 Minha sala permanente',
  noFixedPin: 'Você ainda não tem um PIN fixo. Ao criar uma sala, marque 📌 Sala permanente — o mesmo código e link valerão para todas as suas partidas.',
  copyLink: '📋 Copiar link',
  linkCopied: '✓ Link copiado!',
  customizeBrand: '🎨 Personalizar marca',
  logout: 'Sair',
  // GameSetup
  gameMode: 'Modo de jogo',
  modeIndividual: 'Individual',
  modeIndividualDesc: 'Cada um por si (padrão)',
  modeTeamsDesc: 'Placar somado por time',
  modeBettingDesc: 'Aposte pontos antes de responder',
  modeSurvivalDesc: 'Errou, está eliminado',
  teamN: 'Equipe {n}',
  addTeam: '+ equipe',
  antiCheat: 'Anti-cola: embaralhar as opções por jogador (mostra o texto no celular)',
  permanentRoom: '📌 Sala permanente: usar meu PIN fixo (o mesmo código/link em todas as partidas)',
  cancel: 'Cancelar',
  createRoom: 'Criar sala →',
};

const en: Dict = {
  loginSubtitle: 'Sign in to manage your quizzes',
  signupSubtitle: 'Create your account',
  email: 'Email',
  password: 'Password',
  passwordSignup: 'Password (min. 8 characters)',
  login: 'Sign in',
  signup: 'Create account',
  toSignup: "No account? Sign up",
  toLogin: 'Already have an account? Sign in',
  loading: 'Loading…',
  accessAndPin: 'Go to the site and enter the PIN',
  orAimCamera: 'or point your camera',
  mode: 'Mode: {mode}',
  modeTeams: 'Teams',
  modeBetting: 'Betting',
  modeSurvival: 'Survival',
  poll: '🗳️ Poll',
  start: 'Start ({n})',
  remove: 'Remove',
  removePlayer: 'Remove {name}',
  lobbyMusic: 'Lobby music',
  fullscreen: 'Fullscreen',
  biggerFont: 'Bigger font on screen',
  questionOf: 'Question {i} of {total}',
  answeredCount: '{a}/{t} answered',
  addTime: '+20s',
  pause: '⏸ Pause',
  resume: '▶ Resume',
  paused: '⏸ Paused',
  revealNow: 'Reveal now ⏭',
  answerByTyping: 'Type your answer on your phone',
  correctAnswer: 'Correct answer',
  pollResult: '🗳️ Poll result',
  teamScore: 'Team scoreboard',
  perMember: '(average per member)',
  individual: 'Individual',
  scoreboard: 'Scoreboard',
  next: 'Next →',
  seePodium: 'See podium 🏆',
  podium: '🏆 Podium',
  individualBelow: 'Individual ranking below',
  perQuestion: 'Performance by question',
  avgCorrect: 'Average correct: {n}%',
  hardest: ' · Hardest: “{text}” ({n}%)',
  hardestTag: 'hardest',
  gotItRatio: '{c} of {a} got it',
  newGame: 'New game',
  classic: '🎯 Classic',
  complete: '🚀 Full',
  classicHint: 'Just questions and answers — start a game in one click.',
  completeHint: 'All features: media, game modes, question types, bank and gallery.',
  gallery: '🌐 Gallery',
  bank: '🎲 Bank',
  newQuiz: '+ New quiz',
  openProfile: 'Open profile',
  dbWarning: '⚠️ Database not configured — saved quizzes will not persist across server restarts. Set the DATABASE_URL variable to enable persistence.',
  myQuizzes: 'My quizzes',
  allTag: 'All',
  noQuizzesYet: 'No quizzes saved yet.',
  createFirst: 'Create my first quiz',
  noQuizzesTag: 'No quizzes with the tag #{tag}.',
  public: '🌐 public',
  questionsCount: '{n} question(s)',
  host: 'Host',
  edit: 'Edit',
  duplicate: 'Duplicate',
  del: 'Delete',
  confirmDelete: 'Delete this quiz?',
  lastGames: 'Recent games',
  exportCsv: '⬇ Export CSV',
  report: '📋 Report',
  presenter: 'Host',
  changePhoto: 'Change profile photo',
  removePhoto: 'remove photo',
  photoError: "Couldn't use that image. Try another.",
  statQuizzes: 'quizzes',
  statGames: 'games',
  statPlayers: 'players',
  myRoom: '📌 My permanent room',
  noFixedPin: "You don't have a fixed PIN yet. When creating a room, check 📌 Permanent room — the same code and link will work for all your games.",
  copyLink: '📋 Copy link',
  linkCopied: '✓ Link copied!',
  customizeBrand: '🎨 Customize brand',
  logout: 'Sign out',
  gameMode: 'Game mode',
  modeIndividual: 'Individual',
  modeIndividualDesc: 'Everyone for themselves (default)',
  modeTeamsDesc: 'Scores summed per team',
  modeBettingDesc: 'Bet points before answering',
  modeSurvivalDesc: 'Miss it, you are out',
  teamN: 'Team {n}',
  addTeam: '+ team',
  antiCheat: 'Anti-cheat: shuffle options per player (shows the text on the phone)',
  permanentRoom: '📌 Permanent room: use my fixed PIN (same code/link every game)',
  cancel: 'Cancel',
  createRoom: 'Create room →',
};

const es: Dict = {
  loginSubtitle: 'Entra para gestionar tus quizzes',
  signupSubtitle: 'Crea tu cuenta',
  email: 'Correo',
  password: 'Contraseña',
  passwordSignup: 'Contraseña (mín. 8 caracteres)',
  login: 'Entrar',
  signup: 'Crear cuenta',
  toSignup: '¿No tienes cuenta? Regístrate',
  toLogin: '¿Ya tienes cuenta? Entra',
  loading: 'Cargando…',
  accessAndPin: 'Entra al sitio y usa el PIN',
  orAimCamera: 'o apunta la cámara',
  mode: 'Modo: {mode}',
  modeTeams: 'Equipos',
  modeBetting: 'Apuesta',
  modeSurvival: 'Supervivencia',
  poll: '🗳️ Encuesta',
  start: 'Iniciar ({n})',
  remove: 'Quitar',
  removePlayer: 'Quitar {name}',
  lobbyMusic: 'Música del lobby',
  fullscreen: 'Pantalla completa',
  biggerFont: 'Fuente más grande en la pantalla',
  questionOf: 'Pregunta {i} de {total}',
  answeredCount: '{a}/{t} respondieron',
  addTime: '+20s',
  pause: '⏸ Pausar',
  resume: '▶ Reanudar',
  paused: '⏸ Pausado',
  revealNow: 'Revelar ahora ⏭',
  answerByTyping: 'Respondan escribiendo en el celular',
  correctAnswer: 'Respuesta correcta',
  pollResult: '🗳️ Resultado de la encuesta',
  teamScore: 'Marcador por equipo',
  perMember: '(promedio por integrante)',
  individual: 'Individual',
  scoreboard: 'Marcador',
  next: 'Siguiente →',
  seePodium: 'Ver podio 🏆',
  podium: '🏆 Podio',
  individualBelow: 'Ranking individual abajo',
  perQuestion: 'Desempeño por pregunta',
  avgCorrect: 'Promedio de acierto: {n}%',
  hardest: ' · Más difícil: “{text}” ({n}%)',
  hardestTag: 'más difícil',
  gotItRatio: '{c} de {a} acertaron',
  newGame: 'Nuevo juego',
  classic: '🎯 Clásico',
  complete: '🚀 Completo',
  classicHint: 'Solo preguntas y respuestas — empieza una partida con un clic.',
  completeHint: 'Todos los recursos: medios, modos de juego, tipos de pregunta, banco y galería.',
  gallery: '🌐 Galería',
  bank: '🎲 Banco',
  newQuiz: '+ Nuevo quiz',
  openProfile: 'Abrir perfil',
  dbWarning: '⚠️ Base de datos no configurada — los quizzes guardados no persisten entre reinicios del servidor. Configura la variable DATABASE_URL para activar la persistencia.',
  myQuizzes: 'Mis quizzes',
  allTag: 'Todos',
  noQuizzesYet: 'Aún no hay quizzes guardados.',
  createFirst: 'Crear mi primer quiz',
  noQuizzesTag: 'Ningún quiz con la etiqueta #{tag}.',
  public: '🌐 público',
  questionsCount: '{n} pregunta(s)',
  host: 'Presentar',
  edit: 'Editar',
  duplicate: 'Duplicar',
  del: 'Eliminar',
  confirmDelete: '¿Eliminar este quiz?',
  lastGames: 'Últimas partidas',
  exportCsv: '⬇ Exportar CSV',
  report: '📋 Informe',
  presenter: 'Presentador',
  changePhoto: 'Cambiar foto de perfil',
  removePhoto: 'quitar foto',
  photoError: 'No pude usar esa imagen. Prueba con otra.',
  statQuizzes: 'quizzes',
  statGames: 'partidas',
  statPlayers: 'jugadores',
  myRoom: '📌 Mi sala permanente',
  noFixedPin: 'Aún no tienes un PIN fijo. Al crear una sala, marca 📌 Sala permanente — el mismo código y enlace servirán para todas tus partidas.',
  copyLink: '📋 Copiar enlace',
  linkCopied: '✓ ¡Enlace copiado!',
  customizeBrand: '🎨 Personalizar marca',
  logout: 'Salir',
  gameMode: 'Modo de juego',
  modeIndividual: 'Individual',
  modeIndividualDesc: 'Cada uno por su cuenta (predeterminado)',
  modeTeamsDesc: 'Puntajes sumados por equipo',
  modeBettingDesc: 'Apuesta puntos antes de responder',
  modeSurvivalDesc: 'Si fallas, quedas eliminado',
  teamN: 'Equipo {n}',
  addTeam: '+ equipo',
  antiCheat: 'Anti-trampa: mezclar las opciones por jugador (muestra el texto en el celular)',
  permanentRoom: '📌 Sala permanente: usar mi PIN fijo (el mismo código/enlace en todas las partidas)',
  cancel: 'Cancelar',
  createRoom: 'Crear sala →',
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
      if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, String(vars[k]));
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
    <div className={`flex gap-1 text-xs ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-label={`Idioma ${l.label}`}
          className={`rounded px-2 py-1 font-bold ${lang === l.code ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
