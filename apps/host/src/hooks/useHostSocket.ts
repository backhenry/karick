import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  HostQuestionPayload,
  LeaderboardRow,
  PublicPlayer,
  QuizDraft,
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
  const [question, setQuestion] = useState<HostQuestionPayload | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [timer, setTimer] = useState<{ durationSec: number; key: string }>({ durationSec: 0, key: 'init' });
  const [reveal, setReveal] = useState<{
    correctIndex: number;
    correctText: string;
    distribution: number[];
    leaderboard: LeaderboardRow[];
  } | null>(null);
  const [podium, setPodium] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    const socket: ClientSocket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('lobby:updated', ({ players }) => setPlayers(players));
    socket.on('game:question:host', (q) => {
      setQuestion(q);
      setAnsweredCount(0);
      setTimer({ durationSec: q.timeLimitSec, key: `q${q.index}` });
      setPhase('QUESTION');
      sfx.questionStart();
    });
    socket.on('game:answerCount', ({ answered }) => setAnsweredCount(answered));
    socket.on('game:timer', ({ remainingSec }) =>
      setTimer({ durationSec: remainingSec, key: `t${Date.now()}` }),
    );
    socket.on('game:reveal', (data) => {
      setReveal(data);
      setPhase('REVEAL');
      sfx.reveal();
    });
    socket.on('game:over', ({ podium }) => {
      setPodium(podium);
      setPhase('OVER');
      sfx.over();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createRoom = (quiz: QuizDraft): Promise<string | null> =>
    new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) return resolve('Sem conexão com o servidor.');
      socket.emit('host:createRoom', { quiz }, (res) => {
        if (res.ok && res.pin) {
          setPin(res.pin);
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
    question,
    answeredCount,
    timer,
    reveal,
    podium,
    createRoom,
    start: () => socketRef.current?.emit('host:startGame'),
    next: () => socketRef.current?.emit('host:nextQuestion'),
    revealNow: () => socketRef.current?.emit('host:revealNow'),
    addTime: () => socketRef.current?.emit('host:addTime'),
    kick: (nickname: string) => socketRef.current?.emit('host:kickPlayer', { nickname }),
  };
}
