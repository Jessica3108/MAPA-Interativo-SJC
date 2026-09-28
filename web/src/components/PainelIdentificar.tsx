import { useMemo } from 'react'
import { detalhar, FAIXAS_PORTE, type Filtros } from '../dados/filtros'
import type { Alvo, Base, Metrica } from '../tipos'
import { corGrande, fmt, fmtCep } from '../util'
import Barras from './Barras'

interface Props {
  base: Base
  alvo: Alvo
  filtros: Filtros
  metrica: Metrica
  onFechar: () => void
  onFiltrarBairro: (id: number) => void
}

/** Painel "identificar": o que existe no ponto ou área clicada, respeitando os filtros. */
export default function PainelIdentificar({ base, alvo, filtros, metrica, onFechar, onFiltrarBairro }: Props) {
  const d = useMemo(() => detalhar(base, filtros, alvo), [base, filtros, alvo])
  const { dic } = base
  const val = (s: { n: number; v: number }) => (metrica === 'n' ? s.n : s.v)

  let eyebrow = '', titulo = '', meta = '', aviso = '', latlng: [number, number] | null = null, bairroId: number | null = null
  if (alvo.tipo === 'cep') {
    const c = base.ceps[alvo.idx]
    eyebrow = `CEP ${fmtCep(c[0])}`
    titulo = c[3] || 'Logradouro não identificado'
    meta = dic.bairros[c[4]]
    bairroId = c[4]
    latlng = [c[1], c[2]]
    if (c[5]) aviso = 'Posição aproximada: a coordenada deste CEP foi estimada pelo setor postal.'
  } else if (alvo.tipo === 'bairro') {
    eyebrow = 'Bairro'
    titulo = dic.bairros[alvo.id]
    meta = `${fmt(d.ceps)} CEPs com registro`
    bairroId = alvo.id
  } else {
    eyebrow = 'Setor postal'
    titulo = `${alvo.setor}-xxx`
    meta = `${fmt(d.ceps)} CEPs com registro`
  }

  const atividades = [...d.atividades].sort((a, b) => val(b) - val(a) || b.n - a.n).slice(0, alvo.tipo === 'cep' ? 30 : 12)
    .map(a => ({ chave: a.idx, nome: dic.atividades[a.idx].nome, valor: val(a), cor: corGrande(a.grande),
      extra: metrica === 'n' ? ` · ${fmt(a.v)} emp.` : ` · ${a.n} estab.` }))
  const portes = d.porPorte.map((s, i) => ({ chave: i, nome: FAIXAS_PORTE[i], valor: val(s) }))

  return (
    <aside className="identificar" aria-label="Detalhes do local">
      <header>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2>{titulo}</h2>
          <div className="meta">{meta}</div>
        </div>
        <button type="button" className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
      </header>
      {aviso && <p className="aviso">{aviso}</p>}
      <div className="tot">
        <div><b>{fmt(d.total.n)}</b>estabelecimentos</div>
        <div><b>{fmt(d.total.v)}</b>empregos</div>
        <div><b>{fmt(d.maior)}</b>maior estab.</div>
      </div>
      <section><h3>Atividades <small>{metrica === 'n' ? 'estabelecimentos' : 'empregos'}</small></h3>
        <Barras itens={atividades} vazio="Nenhum estabelecimento com os filtros atuais." /></section>
      {alvo.tipo !== 'cep' && <section><h3>Por porte</h3><Barras itens={portes} vazio="—" /></section>}
      <div className="acoes">
        {bairroId !== null && filtros.bairro !== bairroId && (
          <button type="button" className="btn" onClick={() => onFiltrarBairro(bairroId!)}>Filtrar por este bairro</button>
        )}
        {latlng && <a className="link" href={`https://www.google.com/maps/search/?api=1&query=${latlng[0]},${latlng[1]}`} target="_blank" rel="noopener">Ver no Google Maps</a>}
      </div>
    </aside>
  )
}
