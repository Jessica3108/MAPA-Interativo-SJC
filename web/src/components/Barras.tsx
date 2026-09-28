import { fmt } from '../util'

export interface ItemBarra { chave: string | number; nome: string; valor: number; cor?: string; extra?: string }

/** Lista ranqueada com barra proporcional. Itens clicáveis quando `onEscolher` existe. */
export default function Barras({ itens, onEscolher, vazio }: { itens: ItemBarra[]; onEscolher?: (i: ItemBarra) => void; vazio: string }) {
  if (!itens.length) return <p className="vazio">{vazio}</p>
  const max = Math.max(...itens.map(i => i.valor), 1)
  return (
    <ul className="barras">
      {itens.map(i => {
        const conteudo = (
          <>
            <span className="nm">{i.nome}</span>
            <span className="vl">{fmt(i.valor)}{i.extra && <small>{i.extra}</small>}</span>
            <span className="bar"><i style={{ width: `${(100 * i.valor) / max}%`, background: i.cor }} /></span>
          </>
        )
        return (
          <li key={i.chave}>
            {onEscolher ? <button type="button" onClick={() => onEscolher(i)}>{conteudo}</button> : <div>{conteudo}</div>}
          </li>
        )
      })}
    </ul>
  )
}
