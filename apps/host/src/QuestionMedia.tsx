import { useState } from 'react';

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** "Adivinhe a música": toca o áudio do YouTube com o vídeo e o título escondidos. */
function YouTubeAudioOnly({ id }: { id: string }) {
  const [nonce, setNonce] = useState(0); // >0 = tocando; muda para repetir
  return (
    <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-xl bg-slate-800">
      {nonce > 0 && (
        <iframe
          key={nonce}
          title="áudio"
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1`}
          allow="autoplay; encrypted-media"
        />
      )}
      {/* Capa opaca por cima: esconde o vídeo e o título; o áudio toca por baixo. */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-800 text-white">
        <span className="text-6xl">🎵</span>
        <span className="text-xl font-bold">Adivinhe a música</span>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="rounded-full bg-indigo-600 px-6 py-2 font-bold hover:bg-indigo-500"
        >
          {nonce > 0 ? '⟲ Repetir' : '▶ Tocar'}
        </button>
        {nonce > 0 && <span className="animate-pulse text-sm opacity-70">tocando… 🔊</span>}
      </div>
    </div>
  );
}

/** Renderiza a mídia rica da pergunta na tela do Host: áudio, vídeo e/ou código. */
export function QuestionMedia({
  audioUrl,
  videoUrl,
  audioOnly,
  code,
}: {
  audioUrl?: string;
  videoUrl?: string;
  audioOnly?: boolean;
  code?: string;
}) {
  const ytId = videoUrl ? youtubeId(videoUrl) : null;
  return (
    <div className="flex flex-col items-center gap-3 px-10">
      {audioUrl && /^https?:\/\//i.test(audioUrl) && (
        <audio controls autoPlay src={audioUrl} className="w-full max-w-xl">
          <track kind="captions" />
        </audio>
      )}
      {videoUrl && /^https?:\/\//i.test(videoUrl) && (
        ytId ? (
          audioOnly ? (
            <YouTubeAudioOnly id={ytId} />
          ) : (
            <iframe
              title="vídeo"
              className="aspect-video w-full max-w-2xl rounded-xl"
              src={`https://www.youtube-nocookie.com/embed/${ytId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        ) : (
          <video controls src={videoUrl} className="max-h-[40vh] w-full max-w-2xl rounded-xl" />
        )
      )}
      {code && (
        <pre className="w-full max-w-2xl overflow-x-auto rounded-xl bg-slate-900 p-4 text-left font-mono text-lg text-slate-100">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
