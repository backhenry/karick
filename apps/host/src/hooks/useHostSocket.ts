import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  HostQuestionPayload,
  LeaderboardRow,
  PublicPlayer,
} from '@karick/shared';

// Dev: front (Vite :5173) e server (:3001) são origens diferentes → aponta explícito.
// Prod: front é servido pelo próprio server → mesma origem (window.location.origin).
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

export type HostPhase = 'CONNECTING' | 'LOBBY' | 'QUESTION' | 'REVEAL' | 'OVER' | 'ERROR';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useHostSocket(quizId: string) {
  const socketRef = useRef<ClientSocket | null>(null);
  const [pin, setPin] = useState('');
  const [phase, setPhase] = useState<HostPhase>('CONNECTING');
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [question, setQuestion] = useState<HostQuestionPayload | null>(null);
  const [reveal, setReveal] = useState<{ correctIndex: number; leaderboard: LeaderboardRow[] } | null>(null);
  const [podium, setPodium] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    const socket: ClientSocket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('host:createRoom', { quizId }, (res) => {
        if (res.ok && res.pin) {
          setPin(res.pin);
          setPhase('LOBBY');
        } else {
          setPhase('ERROR');
        }
      });
    });

    socket.on('lobby:updated', ({ players }) => setPlayers(players));
    socket.on('game:question:host', (q) => {
      setQuestion(q);
      setPhase('QUESTION');
    });
    socket.on('game:reveal', (data) => {
      setReveal(data);
      setPhase('REVEAL');
    });
    socket.on('game:over', ({ podium }) => {
      setPodium(podium);
      setPhase('OVER');
    });

    return () => {
      socket.disconnect();
    };
  }, [quizId]);

  return {
    pin,
    phase,
    players,
    question,
    reveal,
    podium,
    start: () => socketRef.current?.emit('host:startGame'),
    next: () => socketRef.current?.emit('host:nextQuestion'),
  };
}
