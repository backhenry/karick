/**
 * Filtro básico de apelidos ofensivos (PT/EN). Lista modesta e propositalmente
 * simples — cobre os casos óbvios; não pretende ser exaustiva.
 */
const BANNED = [
  'merda', 'porra', 'caralho', 'buceta', 'cu', 'viado', 'puta', 'foda', 'fdp', 'arrombado', 'corno',
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'dick', 'nigger', 'faggot', 'retard',
];

export function isOffensive(nickname: string): boolean {
  const norm = nickname
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, ''); // só letras/números (pega "c u", "p.u.t.a")
  return BANNED.some((word) => norm.includes(word));
}
