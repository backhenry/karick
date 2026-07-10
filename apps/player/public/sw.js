/**
 * Service worker mínimo para instalabilidade do PWA.
 * De propósito NÃO faz cache: o jogo é 100% em tempo real (Socket.IO) e
 * um cache desatualizado causaria mais problemas do que resolve.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* passthrough — deixa a rede cuidar de tudo */
});
