import { describe, it, expect } from 'vitest';
import {
  validateQuiz,
  normalizeAnswer,
  normalizeTeams,
  normalizeTags,
  parseQuizImport,
  parseBrandImport,
  extractImageUrl,
  optionPermutation,
  AVATARS,
  type QuizDraft,
} from '@karick/shared';

const q = (over: Partial<QuizDraft['questions'][number]> = {}) => ({
  text: 'Pergunta?',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 0,
  timeLimitSec: 20,
  points: 1000,
  ...over,
});
const quiz = (over: Partial<QuizDraft> = {}): QuizDraft => ({ title: 'Q', questions: [q()], ...over });

describe('validateQuiz', () => {
  it('aceita um quiz válido', () => expect(validateQuiz(quiz())).toBeNull());
  it('exige título', () => expect(validateQuiz(quiz({ title: '  ' }))).toMatch(/título/i));
  it('exige ao menos 1 pergunta', () => expect(validateQuiz(quiz({ questions: [] }))).toMatch(/pergunta/i));
  it('exige enunciado', () => expect(validateQuiz(quiz({ questions: [q({ text: '' })] }))).toMatch(/enunciado/i));
  it('rejeita poucas opções', () => expect(validateQuiz(quiz({ questions: [q({ options: ['A'] })] }))).toMatch(/opções/i));
  it('rejeita opção em branco', () => expect(validateQuiz(quiz({ questions: [q({ options: ['A', ' '] })] }))).toMatch(/branco/i));
  it('rejeita correctIndex fora do intervalo', () => expect(validateQuiz(quiz({ questions: [q({ correctIndex: 9 })] }))).toMatch(/correta/i));
  it('rejeita tempo fora dos limites', () => expect(validateQuiz(quiz({ questions: [q({ timeLimitSec: 0 })] }))).toMatch(/tempo/i));
  it('rejeita pontuação inválida', () => expect(validateQuiz(quiz({ questions: [q({ points: 0 })] }))).toMatch(/pontua/i));
  it('aceita tipo text com acceptedAnswers', () =>
    expect(validateQuiz(quiz({ questions: [{ text: 'X?', type: 'text', acceptedAnswers: ['sim'], timeLimitSec: 20, points: 500, options: [] }] }))).toBeNull());
  it('rejeita tipo text sem respostas', () =>
    expect(validateQuiz(quiz({ questions: [{ text: 'X?', type: 'text', acceptedAnswers: [], timeLimitSec: 20, points: 500, options: [] }] }))).toMatch(/respostas aceitas/i));
  it('aceita poll sem correctIndex', () =>
    expect(validateQuiz(quiz({ questions: [{ text: 'X?', type: 'poll', options: ['a', 'b'], timeLimitSec: 20, points: 100 }] }))).toBeNull());
  it('rejeita imageUrl inválida', () => expect(validateQuiz(quiz({ questions: [q({ imageUrl: 'nao-url' })] }))).toMatch(/imagem/i));
  it('rejeita mais dicas que o limite', () =>
    expect(validateQuiz(quiz({ questions: [q({ hints: Array(99).fill('x') })] }))).toMatch(/dicas/i));
});

describe('normalizeAnswer', () => {
  it('remove acentos, caixa e espaços', () => {
    expect(normalizeAnswer('  Café   com   LEITE ')).toBe('cafe com leite');
    expect(normalizeAnswer('SÃO Paulo')).toBe('sao paulo');
  });
});

describe('normalizeTeams / normalizeTags', () => {
  it('apara, remove vazios e duplicados (case-insensitive)', () => {
    expect(normalizeTeams([' Time A ', 'time a', '', 'Time B'])).toEqual(['Time A', 'Time B']);
  });
  it('tags aceitam string separada por vírgula', () => {
    expect(normalizeTags('geografia, GEOGRAFIA ,  ,história')).toEqual(['geografia', 'história']);
  });
  it('entradas inválidas viram lista vazia', () => {
    expect(normalizeTeams(null)).toEqual([]);
    expect(normalizeTags(42)).toEqual([]);
  });
});

describe('parseQuizImport', () => {
  it('aceita o formato canônico', () => {
    const r = parseQuizImport(JSON.stringify(quiz()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.draft.questions).toHaveLength(1);
  });
  it('aceita lista de perguntas no topo (sem envelope)', () => {
    const r = parseQuizImport(JSON.stringify([q(), q()]));
    expect(r.ok && r.draft.questions.length).toBe(2);
  });
  it('aceita apelidos pt (pergunta/opcoes) e correctAnswer por texto', () => {
    const raw = JSON.stringify({ titulo: 'T', perguntas: [{ pergunta: 'Capital do BR?', opcoes: ['Brasília', 'Rio'], correctAnswer: 'Brasília' }] });
    const r = parseQuizImport(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.draft.questions[0].correctIndex).toBe(0);
  });
  it('REPARA barra invertida solta de LaTeX (o erro "Unrecognized token")', () => {
    const raw = String.raw`{ "title":"Mat", "questions":[{ "text":"Raiz?", "options":["\sqrt2","2","4"], "correctIndex":0, "latex":"x=\frac{-b}{2a}" }] }`;
    const r = parseQuizImport(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.draft.questions[0].latex).toBe('x=\\frac{-b}{2a}'); // barra preservada
  });
  it('tolera code fence + vírgula sobrando + aspas curvas', () => {
    const raw = '```json\n{ "title":"Q", "questions":[{ "text":"2+2?", "options":["4","3"], "correctIndex":0, },] }\n```';
    expect(parseQuizImport(raw).ok).toBe(true);
  });
  it('rejeita entrada vazia e lixo', () => {
    expect(parseQuizImport('').ok).toBe(false);
    expect(parseQuizImport('isto não é json {{{').ok).toBe(false);
  });
});

describe('parseBrandImport', () => {
  it('aceita JSON de marca válido', () => {
    const r = parseBrandImport(JSON.stringify({ name: 'Vale', bg: '#0f172a', primary: '#009c3b', options: ['#009c3b', '#ffdf00', '#012169', '#e21b3c'] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.brand.options).toHaveLength(4);
  });
  it('repara barra solta / aspas curvas', () => {
    const r = parseBrandImport(String.raw`{ "name":"Vale S\.A\.", "bg":"#0f172a", "primary":"#009c3b", "options":["#009c3b","#ffdf00","#012169","#e21b3c"] }`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.brand.name).toBe('Vale S.A.');
  });
  it('achata objeto aninhado (colors) e normaliza hex de 3 dígitos', () => {
    const r = parseBrandImport(JSON.stringify({ name: 'X', colors: { bg: '#000', primary: '#0a0' } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.brand.bg).toBe('#000000');
  });
  it('rejeita sem nenhum campo reconhecido', () => expect(parseBrandImport('{"foo":1}').ok).toBe(false));
});

describe('helpers de marca', () => {
  it('extractImageUrl pega URL de markdown/texto sujo', () => {
    expect(extractImageUrl('[logo](https://x.com/a.png)')).toBe('https://x.com/a.png');
    expect(extractImageUrl('https://y.com/b.svg')).toBe('https://y.com/b.svg');
  });
});

describe('optionPermutation (anti-cola)', () => {
  it('é determinística por seed', () => {
    expect(optionPermutation('p1-0', 4)).toEqual(optionPermutation('p1-0', 4));
  });
  it('é uma permutação real de 0..n-1', () => {
    const p = optionPermutation('seedX', 4);
    expect([...p].sort()).toEqual([0, 1, 2, 3]);
  });
  it('seeds diferentes tendem a diferir', () => {
    const a = optionPermutation('a', 4).join('');
    const b = optionPermutation('b', 4).join('');
    const c = optionPermutation('c', 4).join('');
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });
});

describe('AVATARS', () => {
  it('inclui a orca e a água-viva novas', () => {
    expect(AVATARS).toContain('orca');
    expect(AVATARS).toContain('🪼');
  });
});
