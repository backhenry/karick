function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** Renderiza a mídia rica da pergunta na tela do Host: áudio, vídeo e/ou código. */
export function QuestionMedia({ audioUrl, videoUrl, code }: { audioUrl?: string; videoUrl?: string; code?: string }) {
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
          <iframe
            title="vídeo"
            className="aspect-video w-full max-w-2xl rounded-xl"
            src={`https://www.youtube-nocookie.com/embed/${ytId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
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
