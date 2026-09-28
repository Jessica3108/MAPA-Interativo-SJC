import type { Base, EstadoCamadas, Metrica } from '../tipos'
import { corGrande, fmt } from '../util'
import { corDaClasse, rotulosClasses } from '../dados/filtros'

interface Props { base: Base; estado: EstadoCamadas; metrica: Metrica; grandes: number[]; quebrasBairro: number[] }

/** Legenda dinâmica: só mostra as camadas RAIS que estão ligadas. */
export default function Legenda({ base, estado, metrica, grandes, quebrasBairro: q, temDados }: Props & { temDados: boolean }) {
  const ligada = (tipo: string) => base.catalogo.camadas.some(c => c.tipo === tipo && estado[c.id]?.visivel)
  const unidade = metrica === 'n' ? 'estabelecimentos' : 'empregos'
  const blocos = []
  if (ligada('rais-pontos')) blocos.push(
    <div key="p" className="leg-bloco">
      <div className="t">Setor predominante no CEP</div>
      <div className="itens">{grandes.map(g => <span key={g} className="it"><i className="sw" style={{ background: corGrande(g) }} />{base.dic.grandes[g]}</span>)}</div>
      <div className="nota">Tamanho do círculo = {unidade}</div>
    </div>)
  if (ligada('rais-coropletico')) blocos.push(
    <div key="c" className="leg-bloco">
      <div className="t">{metrica === 'n' ? 'Estabelecimentos' : 'Empregos'} por bairro</div>
      <div className="itens">{temDados ? rotulosClasses(q, fmt).map((l, i, arr) =>
        <span key={l} className="it"><i className="sq" style={{ background: `var(--q${corDaClasse(i, arr.length)})` }} />{l}</span>) : <span>Sem registros</span>}</div>
    </div>)
  if (ligada('rais-calor')) blocos.push(
    <div key="h" className="leg-bloco">
      <div className="t">Densidade de {unidade}</div>
      <div className="grad"><i /><span>menor</span><span>maior</span></div>
    </div>)
  if (!blocos.length) return null
  return <div className="legenda">{blocos}</div>
}
