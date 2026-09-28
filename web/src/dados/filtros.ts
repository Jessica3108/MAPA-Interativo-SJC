// Filtros e agregações. Tudo roda no navegador: 47 mil linhas levam poucos milissegundos.
import type { Alvo, Base, Estab, Metrica } from '../tipos'

export interface Filtros {
  texto: string              // busca livre na descrição da atividade
  atividade: number | null   // atividade exata (escolhida na busca ou no ranking)
  grandes: number[]          // grandes setores ativos
  subsetor: number | null
  porte: number | null       // faixa de porte (ver FAIXAS_PORTE)
  bairro: number | null
  soComEmpregados: boolean
}

export const FILTROS_INICIAIS: Filtros = {
  texto: '', atividade: null, grandes: [0, 1, 2, 3, 4, 5], subsetor: null, porte: null, bairro: null, soComEmpregados: false,
}

export const FAIXAS_PORTE = ['Sem vínculos', '1 a 9', '10 a 49', '50 a 249', '250 ou mais']
/** código "Tamanho Estabelecimento" da RAIS -> faixa */
export const faixaPorte = (p: number) => (p <= 1 ? 0 : p <= 3 ? 1 : p <= 5 ? 2 : p <= 7 ? 3 : 4)

export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

let cacheNorm: string[] | null = null
function atividadesNorm(base: Base) {
  if (!cacheNorm) cacheNorm = base.dic.atividades.map(a => normalizar(a.nome))
  return cacheNorm
}

export function contarFiltros(f: Filtros) {
  return (f.texto ? 1 : 0) + (f.atividade !== null ? 1 : 0) + (f.grandes.length < 6 ? 1 : 0) +
    (f.subsetor !== null ? 1 : 0) + (f.porte !== null ? 1 : 0) + (f.bairro !== null ? 1 : 0) + (f.soComEmpregados ? 1 : 0)
}

/** Devolve uma função que diz se um estabelecimento passa nos filtros. */
export function criarPredicado(base: Base, f: Filtros): (e: Estab) => boolean {
  const q = normalizar(f.texto.trim())
  const nomes = atividadesNorm(base)
  const okAtiv = q ? nomes.map(n => n.includes(q)) : null
  const grandes = new Set(f.grandes)
  const { grandeDe, ceps } = base
  return e => {
    if (f.atividade !== null && e[1] !== f.atividade) return false
    if (okAtiv && !okAtiv[e[1]]) return false
    if (!grandes.has(grandeDe[e[2]] ?? 3)) return false
    if (f.subsetor !== null && e[2] !== f.subsetor) return false
    if (f.porte !== null && faixaPorte(e[3]) !== f.porte) return false
    if (f.soComEmpregados && e[4] === 0) return false
    if (f.bairro !== null && ceps[e[0]][4] !== f.bairro) return false
    return true
  }
}

export interface Soma { n: number; v: number }
export interface Agregado {
  total: Soma
  comEmpregados: number
  cepN: Uint32Array
  cepV: Uint32Array
  /** grande setor predominante em cada CEP (pela métrica escolhida) */
  cepDom: Uint8Array
  porAtividade: Map<number, Soma & { grande: number }>
  porBairro: Map<number, Soma>
  porSetor: Map<string, Soma>
  porGrande: Soma[]
  porPorte: Soma[]
}

export function agregar(base: Base, f: Filtros, metrica: Metrica): Agregado {
  const pred = criarPredicado(base, f)
  const nC = base.ceps.length
  const cepN = new Uint32Array(nC), cepV = new Uint32Array(nC)
  const peso = new Float64Array(nC * 6)
  const porAtividade = new Map<number, Soma & { grande: number }>()
  const porBairro = new Map<number, Soma>()
  const porSetor = new Map<string, Soma>()
  const porGrande = Array.from({ length: 6 }, () => ({ n: 0, v: 0 }))
  const porPorte = Array.from({ length: 5 }, () => ({ n: 0, v: 0 }))
  let n = 0, v = 0, comEmpregados = 0

  const somar = <K,>(m: Map<K, Soma>, k: K, vv: number) => {
    const s = m.get(k)
    if (s) { s.n++; s.v += vv } else m.set(k, { n: 1, v: vv })
  }

  for (const e of base.estab) {
    if (!pred(e)) continue
    const [ci, ai, sub, porte, vinc] = e
    const g = base.grandeDe[sub] ?? 3
    const cep = base.ceps[ci]
    n++; v += vinc; if (vinc > 0) comEmpregados++
    cepN[ci]++; cepV[ci] += vinc
    peso[ci * 6 + g] += metrica === 'n' ? 1 : vinc + 0.001
    const a = porAtividade.get(ai)
    if (a) { a.n++; a.v += vinc } else porAtividade.set(ai, { n: 1, v: vinc, grande: g })
    somar(porBairro, cep[4], vinc)
    somar(porSetor, cep[0].slice(0, 5), vinc)
    porGrande[g].n++; porGrande[g].v += vinc
    const fp = faixaPorte(porte); porPorte[fp].n++; porPorte[fp].v += vinc
  }

  const cepDom = new Uint8Array(nC)
  for (let i = 0; i < nC; i++) {
    if (!cepN[i]) continue
    let m = 0
    for (let g = 1; g < 6; g++) if (peso[i * 6 + g] > peso[i * 6 + m]) m = g
    cepDom[i] = m
  }
  return { total: { n, v }, comEmpregados, cepN, cepV, cepDom, porAtividade, porBairro, porSetor, porGrande, porPorte }
}

/** Quebras por quantis (5 classes) para mapas coropléticos. */
export function quebras(valores: number[]): number[] {
  const pos = valores.filter(x => x > 0).sort((a, b) => a - b)
  if (!pos.length) return []
  // limites superiores das classes; valores repetidos são descartados (poucos dados = menos classes)
  const q = [...new Set([0.2, 0.4, 0.6, 0.8].map(p => pos[Math.floor(p * (pos.length - 1))]))]
  if (q[q.length - 1] === pos[pos.length - 1]) q.pop()
  return q
}
/** Classe 1..(q.length+1), espalhada na rampa de 5 cores; 0 = sem valor. */
export function classe(v: number, q: number[]) {
  if (v <= 0) return 0
  let k = q.findIndex(x => v <= x)
  if (k < 0) k = q.length
  return corDaClasse(k, q.length + 1)
}
export const corDaClasse = (k: number, n: number) => (n <= 1 ? 5 : 1 + Math.round((k * 4) / (n - 1)))
/** Rótulos das classes, na mesma ordem de `classe`. */
export function rotulosClasses(q: number[], fmt: (n: number) => string): string[] {
  if (!q.length) return ['qualquer valor']
  const r = [`até ${fmt(q[0])}`]
  for (let i = 1; i < q.length; i++) r.push(q[i] === q[i - 1] + 1 ? fmt(q[i]) : `${fmt(q[i - 1] + 1)}–${fmt(q[i])}`)
  r.push(`acima de ${fmt(q[q.length - 1])}`)
  return r
}

export interface Detalhe {
  total: Soma
  maior: number
  ceps: number
  atividades: { idx: number; n: number; v: number; grande: number }[]
  porPorte: Soma[]
}

/** Estabelecimentos filtrados dentro de um alvo (CEP, bairro ou setor postal). */
export function detalhar(base: Base, f: Filtros, alvo: Alvo): Detalhe {
  const pred = criarPredicado(base, f)
  const dentro = (e: Estab) => {
    const c = base.ceps[e[0]]
    if (alvo.tipo === 'cep') return e[0] === alvo.idx
    if (alvo.tipo === 'bairro') return c[4] === alvo.id
    return c[0].startsWith(alvo.setor)
  }
  const at = new Map<number, { idx: number; n: number; v: number; grande: number }>()
  const porPorte = Array.from({ length: 5 }, () => ({ n: 0, v: 0 }))
  const ceps = new Set<number>()
  let n = 0, v = 0, maior = 0
  for (const e of base.estab) {
    if (!dentro(e) || !pred(e)) continue
    n++; v += e[4]; maior = Math.max(maior, e[4]); ceps.add(e[0])
    const a = at.get(e[1])
    if (a) { a.n++; a.v += e[4] } else at.set(e[1], { idx: e[1], n: 1, v: e[4], grande: base.grandeDe[e[2]] ?? 3 })
    const fp = faixaPorte(e[3]); porPorte[fp].n++; porPorte[fp].v += e[4]
  }
  return { total: { n, v }, maior, ceps: ceps.size, atividades: [...at.values()], porPorte }
}
