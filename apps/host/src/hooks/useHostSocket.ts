import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  HostQuestionPayload,
  LeaderboardRow,
  PublicPlayer,
  QuizDraft,
  QuestionStat,
  TeamRow,
  GameMode,
  Brand,
} from '@karick/shared';
import { sfx } from '../lib/sound.js';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

export type HostPhase = 'PREGAME' | 'LOBBY' | 'QUESTION' | 'REVEAL' | 'OVER';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useHostSocket() {
  const socketRef = useRef<ClientSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [pin, setPin] = useState('');
  const [phase, setPhase] = useState<HostPhase>('PREGAME');
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [mode, setMode] = useState<GameMode>('individual');
  const [question, setQuestion] = useState<HostQuestionPayload | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [answeredWho, setAnsweredWho] = useState<{ nickname: string; avatar?: string }[]>([]);
  const [timer, setTimer] = useState<{ durationSec: number; key: string }>({ durationSec: 0, key: 'init' });
  const [reveal, setReveal] = useState<{
    correctIndex: number;
    correctText: string;
    distribution: number[];
    leaderboard: LeaderboardRow[];
    teamLeaderboard?: TeamRow[];
    explanation?: string;
  } | null>(null);
  const [podium, setPodium] = useState<LeaderboardRow[]>([]);
  const [teamPodium, setTeamPodium] = useState<TeamRow[]>([]);
  const [stats, setStats] = useState<QuestionStat[]>([]);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);

  useEffect(() => {
    const socket: ClientSocket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('lobby:updated', ({ players, teams }) => {
      setPlayers(players);
      setTeams(teams);
    });
    socket.on('game:question:host', (q) => {
      setQuestion(q);
      setAnsweredCount(0);
      setAnsweredWho([]);
      setTimer({ durationSec: q.timeLimitSec, key: `q${q.index}` });
      setPhase('QUESTION');
      sfx.questionStart();
    });
    socket.on('game:answerCount', ({ answered, nickname, avatar }) => {
      setAnsweredCount(answered);
      if (nickname) {
        setAnsweredWho((ws) => (ws.some((w) => w.nickname === nickname) ? ws : [...ws, { nickname, avatar }]));
      }
    });
    socket.on('game:reaction', ({ emoji }) => {
      const id = Date.now() + Math.random();
      setReactions((rs) => [...rs, { id, emoji, x: 5 + Math.random() * 85 }]);
      setTimeout(() => setReactions((rs) => rs.filter((r) => r.id !== id)), 2700);
    });
    socket.on('game:timer', ({ remainingSec }) =>
      setTimer({ durationSec: remainingSec, key: `t${Date.now()}` }),
    );
    socket.on('game:reveal', (data) => {
      setReveal(data);
      setPhase('REVEAL');
      sfx.reveal();
    });
    socket.on('game:over', ({ podium, stats, teamPodium }) => {
      setPodium(podium);
      setStats(stats);
      setTeamPodium(teamPodium ?? []);
      setPhase('OVER');
      sfx.over();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createRoom = (quiz: QuizDraft, teams?: string[], gameMode: GameMode = 'individual', shuffle = false, brand?: Brand): Promise<string | null> =>
    new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) return resolve('Sem conexão com o servidor.');
      socket.emit('host:createRoom', { quiz, teams, mode: gameMode, shuffle, brand }, (res) => {
        if (res.ok && res.pin) {
          setPin(res.pin);
          setMode(gameMode);
          setPhase('LOBBY');
          resolve(null);
        } else {
          resolve(res.error ?? 'Não foi possível criar a sala.');
        }
      });
    });

  return {
    connected,
    pin,
    phase,
    players,
    teams,
    mode,
    question,
    answeredCount,
    answeredWho,
    timer,
    reveal,
    podium,
    teamPodium,
    stats,
    reactions,
    createRoom,
    start: () => socketRef.current?.emit('host:startGame'),
    next: () => socketRef.current?.emit('host:nextQuestion'),
    revealNow: () => socketRef.current?.emit('host:revealNow'),
    addTime: () => socketRef.current?.emit('host:addTime'),
    kick: (nickname: string) => socketRef.current?.emit('host:kickPlayer', { nickname }),
  };
}
