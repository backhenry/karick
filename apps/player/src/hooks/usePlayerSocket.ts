import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerQuestionPayload,
  AnswerResult,
} from '@karick/shared';
import { MAX_NICKNAME_LENGTH } from '@karick/shared';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

export type PlayerScreen = 'JOIN' | 'LOBBY' | 'QUESTION' | 'ANSWERED' | 'FEEDBACK' | 'OVER';

export interface RevealInfo {
  correctIndex: number;
  correctText: string;
  rank?: number;
  gained?: number;
  score?: number;
}

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function usePlayerSocket() {
  const socketRef = useRef<ClientSocket | null>(null);
  const nicknameRef = useRef('');
  const [screen, setScreen] = useState<PlayerScreen>('JOIN');
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<PlayerQuestionPayload | null>(null);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [reveal, setReveal] = useState<RevealInfo | null>(null);

  useEffect(() => {
    const socket: ClientSocket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('game:question:player', (q) => {
      setQuestion(q);
      setFeedback(null);
      setReveal(null);
      setScreen('QUESTION');
    });
    socket.on('game:reveal', ({ correctIndex, correctText, leaderboard }) => {
      const mine = leaderboard.find((r) => r.nickname === nicknameRef.current);
      setReveal({ correctIndex, correctText, rank: mine?.rank, gained: mine?.gained, score: mine?.score });
      setScreen('FEEDBACK');
    });
    socket.on('game:over', () => setScreen('OVER'));
    socket.on('game:hostLeft', () => setError('O apresentador encerrou a sala.'));

    return () => {
      socket.disconnect();
    };
  }, []);

  const join = (pin: string, nickname: string, avatar: string) =>
    new Promise<boolean>((resolve) => {
      setError(null);
      socketRef.current?.emit('player:join', { pin, nickname, avatar }, (res) => {
        if (res.ok) {
          nicknameRef.current = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
          setScreen('LOBBY');
        } else {
          setError(res.error ?? 'Não foi possível entrar');
        }
        resolve(res.ok);
      });
    });

  const answer = (optionIndex: number) => {
    setScreen('ANSWERED');
    socketRef.current?.emit('player:submitAnswer', { optionIndex }, (res) => {
      if (res.ok && res.totalScore !== undefined) {
        setFeedback({
          isCorrect: !!res.isCorrect,
          pointsAwarded: res.pointsAwarded ?? 0,
          totalScore: res.totalScore,
          streak: res.streak ?? 0,
          streakBonus: res.streakBonus ?? 0,
        });
      }
    });
  };

  return { screen, error, question, feedback, reveal, join, answer };
}
