import { useMemo, useRef, useState } from 'react'
import { normalizar } from '../dados/filtros'
import type { Base } from '../tipos'
import { fmtCep } from '../util'

export type Resultado =
  | { tipo: 'cep'; idx: number; titulo: string; sub: string }
  | { tipo: 'rua'; ceps: number[]; titulo: string; sub: string }
  | { tipo: 'bairro'; id: number; titulo: string; sub: string }
  | { tipo: 'atividade'; idx: number; titulo: string; sub: string }

const ROTULO: Record<Resultado['tipo'], string> = { cep: 'CEP', rua: 'Rua', bairro: 'Bairro', atividade: 'Atividade' }

export default function Busca({ base, onEscolher }: { base: Base; onEscolher: (r: Resultado) => void }) {
  const [q, setQ] = useState('')
  const [aberto, setAberto] = useState(false)
  const [sel, setSel] = useState(0)
  const caixa = useRef<HTMLInputElement>(null)

  // índice montado uma vez: ruas agrupadas, bairros e atividades normalizados
  const indice = useMemo(() => {
    const ruas = new Map<string, { nome: string; ceps: number[]; bairros: Set<number> }>()
    base.ceps.forEach((c, i) => {
      if (!c[3]) return
      const k = normalizar(c[3])
      const r = ruas.get(k) ?? { nome: c[3], ceps: [], bairros: new Set<number>() }
      r.ceps.push(i); r.bairros.add(c[4]); ruas.set(k, r)
    })
    return {
      ruas: [...ruas.entries()],
      bairros: base.dic.bairros.map((b, i) => [normalizar(b), i] as const),
      atividades: base.dic.atividades.map((a, i) => [normalizar(a.nome), i, a.cnae] as const),
    }
  }, [base])

  const resultados = useMemo<Resultado[]>(() => {
    const t = normalizar(q.trim())
    if (t.length < 2) return []
    const out: Resultado[] = []
    const dig = t.replace(/\D/g, '')
    if (dig.length >= 5 && dig.length === t.replace(/[-.\s]/g, '').length) {
      base.ceps.forEach((c, i) => { if (c[0].startsWith(dig) && out.length < 6) out.push({ tipo: 'cep', idx: i, titulo: fmtCep(c[0]), sub: `${c[3] || 'Logradouro não identificado'} · ${base.dic.bairros[c[4]]}` }) })
      for (const [, i, cnae] of indice.atividades) if (cnae.startsWith(dig) && out.length < 10) out.push({ tipo: 'atividade', idx: i, titulo: base.dic.atividades[i].nome, sub: `CNAE ${cnae}` })
      return out
    }
    const comeca = (s: string) => s.startsWith(t) || s.includes(' ' + t)
    const bs = indice.bairros.filter(([n]) => n.includes(t)).sort((a, b) => Number(comeca(b[0])) - Number(comeca(a[0]))).slice(0, 4)
    for (const [, i] of bs) out.push({ tipo: 'bairro', id: i, titulo: base.dic.bairros[i], sub: 'Bairro' })
    const as = indice.atividades.filter(([n]) => n.includes(t)).sort((a, b) => Number(comeca(b[0])) - Number(comeca(a[0]))).slice(0, 5)
    for (const [, i, cnae] of as) out.push({ tipo: 'atividade', idx: i, titulo: base.dic.atividades[i].nome, sub: `CNAE ${cnae}` })
    const rs = indice.ruas.filter(([n]) => n.includes(t)).sort((a, b) => Number(comeca(b[0])) - Number(comeca(a[0]))).slice(0, 5)
    for (const [, r] of rs) out.push({ tipo: 'rua', ceps: r.ceps, titulo: r.nome, sub: [...r.bairros].slice(0, 2).map(b => base.dic.bairros[b]).join(', ') })
    return out
  }, [q, indice, base])

  const escolher = (r: Resultado) => { onEscolher(r); setQ(''); setAberto(false); caixa.current?.blur() }

  return (
    <div className="busca" role="combobox" aria-expanded={aberto && resultados.length > 0} aria-haspopup="listbox" aria-owns="busca-lista">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      <input
        ref={caixa} id="busca" type="search" value={q} autoComplete="off" aria-label="Buscar"
        placeholder="Buscar CEP, rua, bairro ou atividade"
        onChange={e => { setQ(e.target.value); setAberto(true); setSel(0) }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, resultados.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
          else if (e.key === 'Enter' && resultados[sel]) escolher(resultados[sel])
          else if (e.key === 'Escape') { setQ(''); setAberto(false) }
        }}
      />
      {aberto && q.trim().length >= 2 && (
        <ul id="busca-lista" role="listbox" className="busca-lista">
          {resultados.length === 0 && <li className="vazio">Nada encontrado para “{q}”.</li>}
          {resultados.map((r, i) => (
            <li key={`${r.tipo}-${i}`} role="option" aria-selected={i === sel}
              onMouseDown={e => { e.preventDefault(); escolher(r) }} onMouseEnter={() => setSel(i)}>
              <span className={`tipo t-${r.tipo}`}>{ROTULO[r.tipo]}</span>
              <span className="txt"><b>{r.titulo}</b><small>{r.sub}</small></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
