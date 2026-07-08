import { useState, type ReactNode } from 'react';
import { OPTION_COLORS, OPTION_SHAPES, MAX_NICKNAME_LENGTH } from '@karick/shared';
import { usePlayerSocket } from './hooks/usePlayerSocket.js';

function Center({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-xl text-slate-700">
      {children}
    </div>
  );
}

export function App() {
  const { screen, error, question, feedback, join, answer } = usePlayerSocket();
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');

  if (screen === 'JOIN') {
    return (
      <form
        className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          join(pin, nickname);
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
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Seu apelido"
          maxLength={MAX_NICKNAME_LENGTH}
          className="rounded-lg border p-4 text-center text-xl"
        />
        <button className="rounded-lg bg-indigo-600 p-4 text-lg font-bold text-white active:scale-95">
          Entrar
        </button>
        {error && <p className="text-center text-red-600">{error}</p>}
      </form>
    );
  }

  if (error) return <Center>⚠️ {error}</Center>;

  if (screen === 'LOBBY') return <Center>✅ Você entrou! Aguarde o apresentador iniciar…</Center>;

  if (screen === 'QUESTION' && question) {
    return (
      <div className="grid h-screen grid-cols-2 gap-3 p-3">
        {Array.from({ length: question.optionsCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => answer(i)}
            className="flex items-center justify-center rounded-xl text-6xl text-white transition active:scale-95"
            style={{ background: OPTION_COLORS[i] }}
          >
            {OPTION_SHAPES[i]}
          </button>
        ))}
      </div>
    );
  }

  if (screen === 'ANSWERED') return <Center>Resposta enviada! Aguardando os outros… ⏳</Center>;

  if (screen === 'FEEDBACK') {
    if (!feedback) return <Center>Tempo esgotado ⏰</Center>;
    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center p-6 text-center text-white ${
          feedback.isCorrect ? 'bg-green-600' : 'bg-red-600'
        }`}
      >
        <h1 className="text-5xl font-black">{feedback.isCorrect ? 'Acertou! 🎉' : 'Errou 😢'}</h1>
        {feedback.pointsAwarded > 0 && (
          <p className="mt-2 text-2xl">+{feedback.pointsAwarded} pontos</p>
        )}
        <p className="mt-6 text-3xl font-bold">{feedback.totalScore} pts</p>
      </div>
    );
  }

  if (screen === 'OVER') return <Center>🏁 Fim de jogo! Veja o pódio na tela principal.</Center>;

  return <Center>Conectando…</Center>;
}
