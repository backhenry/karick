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

/** Identidade persistente do jogador — sobrevive a reload/queda de conexão. */
function getPlayerId(): string {
  const KEY = 'karick.playerId';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

type JoinParams = { pin: string; nickname: string; avatar: string };
const JOIN_KEY = 'karick.join';
const getSavedJoin = (): JoinParams | null => {
  try {
    const raw = localStorage.getItem(JOIN_KEY);
    return raw ? (JSON.parse(raw) as JoinParams) : null;
  } catch {
    return null;
  }
};
const setSavedJoin = (jp: JoinParams | null) => {
  try {
    if (jp) localStorage.setItem(JOIN_KEY, JSON.stringify(jp));
    else localStorage.removeItem(JOIN_KEY);
  } catch {
    /* ignora */
  }
};

export type PlayerScreen = 'JOIN' | 'LOBBY' | 'QUESTION' | 'ANSWERED' | 'FEEDBACK' | 'OVER';

export interface RevealInfo {
  correctIndex: number;
  correctText: string;
  rank?: number;
  gained?: number;
  score?: number;
  explanation?: string;
}

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function usePlayerSocket() {
  const socketRef = useRef<ClientSocket | null>(null);
  const nicknameRef = useRef('');
  const playerIdRef = useRef(getPlayerId());
  const joinParamsRef = useRef<JoinParams | null>(getSavedJoin());
  const [screen, setScreen] = useState<PlayerScreen>(joinParamsRef.current ? 'LOBBY' : 'JOIN');
  const [reconnecting, setReconnecting] = useState(!!joinParamsRef.current);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<PlayerQuestionPayload | null>(null);
  const [timer, setTimer] = useState<{ durationSec: number; key: string }>({ durationSec: 0, key: 'init' });
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [reveal, setReveal] = useState<RevealInfo | null>(null);

  useEffect(() => {
    const socket: ClientSocket = io(SERVER_URL);
    socketRef.current = socket;

    // (Re)conexão: se já havíamos entrado (inclusive após reload), re-entra com o mesmo playerId.
    socket.on('connect', () => {
      const jp = joinParamsRef.current;
      if (!jp) return setReconnecting(false);
      socket.emit('player:join', { ...jp, playerId: playerIdRef.current }, (res) => {
        setReconnecting(false);
        if (res.ok) {
          nicknameRef.current = jp.nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
        } else {
          // Sala não existe mais (ou jogo encerrado): volta para a tela inicial.
          joinParamsRef.current = null;
          setSavedJoin(null);
          setScreen('JOIN');
        }
      });
    });
    socket.on('disconnect', () => {
      if (joinParamsRef.current) setReconnecting(true);
    });

    socket.on('game:question:player', (q) => {
      setQuestion(q);
      setTimer({ durationSec: q.timeLimitSec, key: `q${q.index}` });
      setFeedback(null);
      setReveal(null);
      setScreen('QUESTION');
    });
    socket.on('game:timer', ({ remainingSec }) =>
      setTimer({ durationSec: remainingSec, key: `t${Date.now()}` }),
    );
    socket.on('player:kicked', () => {
      joinParamsRef.current = null;
      setSavedJoin(null);
      setError('Você foi removido pelo apresentador.');
    });
    socket.on('game:reveal', ({ correctIndex, correctText, leaderboard, explanation }) => {
      const mine = leaderboard.find((r) => r.nickname === nicknameRef.current);
      setReveal({ correctIndex, correctText, rank: mine?.rank, gained: mine?.gained, score: mine?.score, explanation });
      setScreen('FEEDBACK');
    });
    socket.on('game:over', () => {
      joinParamsRef.current = null;
      setSavedJoin(null);
      setScreen('OVER');
    });
    socket.on('game:hostLeft', () => {
      joinParamsRef.current = null;
      setSavedJoin(null);
      setError('O apresentador encerrou a sala.');
    });

    // Re-sincronização após reconectar no meio do jogo.
    socket.on('game:sync', (s) => {
      setError(null);
      if (s.question) {
        setQuestion(s.question);
        setTimer({ durationSec: s.remainingSec ?? s.question.timeLimitSec, key: `sync${Date.now()}` });
      }
      if (s.reveal) {
        setReveal(s.reveal);
        setFeedback(
          s.answered
            ? { isCorrect: s.answered.isCorrect, pointsAwarded: s.reveal.gained ?? 0, totalScore: s.reveal.score ?? 0, streak: 0, streakBonus: 0 }
            : null,
        );
      }
      setScreen(s.screen);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const join = (pin: string, nickname: string, avatar: string) =>
    new Promise<boolean>((resolve) => {
      setError(null);
      const cleanNick = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
      socketRef.current?.emit('player:join', { pin, nickname, avatar, playerId: playerIdRef.current }, (res) => {
        if (res.ok) {
          nicknameRef.current = cleanNick;
          joinParamsRef.current = { pin, nickname, avatar };
          setSavedJoin({ pin, nickname, avatar });
          setScreen('LOBBY');
        } else {
          setError(res.error ?? 'Não foi possível entrar');
        }
        resolve(res.ok);
      });
    });

  const react = (emoji: string) => socketRef.current?.emit('player:react', { emoji });

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

  return { screen, error, reconnecting, question, timer, feedback, reveal, join, answer, react };
}
