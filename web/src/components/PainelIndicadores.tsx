import { FAIXAS_PORTE, type Agregado } from '../dados/filtros'
import type { Base, Metrica } from '../tipos'
import { corGrande, fmt } from '../util'
import Barras from './Barras'

interface Props {
  base: Base
  agregado: Agregado
  metrica: Metrica
  onAtividade: (idx: number) => void
  onBairro: (id: number) => void
}

export default function PainelIndicadores({ base, agregado: A, metrica, onAtividade, onBairro }: Props) {
  const { dic } = base
  const val = (s: { n: number; v: number }) => (metrica === 'n' ? s.n : s.v)
  const ceps = A.cepN.reduce((s, x) => s + (x ? 1 : 0), 0)
  const unidade = metrica === 'n' ? 'estabelecimentos' : 'empregos'

  const atividades = [...A.porAtividade.entries()].sort((a, b) => val(b[1]) - val(a[1])).slice(0, 10)
    .map(([i, s]) => ({ chave: i, nome: dic.atividades[i].nome, valor: val(s), cor: corGrande(s.grande) }))
  const bairros = [...A.porBairro.entries()].filter(([b]) => dic.bairros[b] !== 'Não identificado')
    .sort((a, b) => val(b[1]) - val(a[1])).slice(0, 10)
    .map(([b, s]) => ({ chave: b, nome: dic.bairros[b], valor: val(s) }))
  const grandes = A.porGrande.map((s, g) => ({ chave: g, nome: dic.grandes[g], valor: val(s), cor: corGrande(g) }))
    .filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor)
  const portes = A.porPorte.map((s, i) => ({ chave: i, nome: FAIXAS_PORTE[i], valor: val(s) }))

  return (
    <div className="indicadores">
      <div className="kpis">
        <div className="kpi"><b>{fmt(A.total.n)}</b><span>estabelecimentos</span></div>
        <div className="kpi"><b>{fmt(A.total.v)}</b><span>empregos (vínculos ativos)</span></div>
        <div className="kpi"><b>{fmt(ceps)}</b><span>CEPs com registro</span></div>
        <div className="kpi"><b>{A.total.n ? Math.round((100 * A.comEmpregados) / A.total.n) : 0}%</b><span>com empregados</span></div>
      </div>
      <section><h3>Por grande setor <small>{unidade}</small></h3><Barras itens={grandes} vazio="Sem registros." /></section>
      <section><h3>Por porte <small>{unidade}</small></h3><Barras itens={portes} vazio="Sem registros." /></section>
      <section><h3>Principais atividades <small>clique para filtrar</small></h3>
        <Barras itens={atividades} onEscolher={i => onAtividade(Number(i.chave))} vazio="Nenhuma atividade com esses filtros." /></section>
      <section><h3>Principais bairros <small>clique para ver no mapa</small></h3>
        <Barras itens={bairros} onEscolher={i => onBairro(Number(i.chave))} vazio="Nenhum bairro com esses filtros." /></section>
    </div>
  )
}
