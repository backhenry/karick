import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerQuestionPayload,
  AnswerResult,
} from '@karick/shared';

// Dev: front (Vite :5174) e server (:3001) são origens diferentes → aponta explícito.
// Prod: front é servido pelo próprio server → mesma origem (window.location.origin).
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

export type PlayerScreen = 'JOIN' | 'LOBBY' | 'QUESTION' | 'ANSWERED' | 'FEEDBACK' | 'OVER';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function usePlayerSocket() {
  const socketRef = useRef<ClientSocket | null>(null);
  const [screen, setScreen] = useState<PlayerScreen>('JOIN');
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<PlayerQuestionPayload | null>(null);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);

  useEffect(() => {
    const socket: ClientSocket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('game:question:player', (q) => {
      setQuestion(q);
      setFeedback(null);
      setScreen('QUESTION');
    });
    socket.on('game:reveal', () => {
      // Vai para FEEDBACK: se o jogador respondeu, o feedback já está setado;
      // se não respondeu (tempo esgotou), a tela mostra "Tempo esgotado".
      setScreen('FEEDBACK');
    });
    socket.on('game:over', () => setScreen('OVER'));
    socket.on('game:hostLeft', () => setError('O apresentador encerrou a sala.'));

    return () => {
      socket.disconnect();
    };
  }, []);

  const join = (pin: string, nickname: string) =>
    new Promise<boolean>((resolve) => {
      setError(null);
      socketRef.current?.emit('player:join', { pin, nickname }, (res) => {
        if (res.ok) setScreen('LOBBY');
        else setError(res.error ?? 'Não foi possível entrar');
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
        });
      }
    });
  };

  return { screen, error, question, feedback, join, answer };
}
