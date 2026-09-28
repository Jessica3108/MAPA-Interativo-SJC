import type { Catalogo, EstadoCamadas } from '../tipos'

interface Props {
  catalogo: Catalogo
  estado: EstadoCamadas
  onAlternar: (id: string) => void
  onOpacidade: (id: string, v: number) => void
}

/** Painel montado inteiramente a partir de camadas.json. */
export default function PainelCamadas({ catalogo, estado, onAlternar, onOpacidade }: Props) {
  return (
    <div className="camadas">
      {catalogo.grupos.map(g => (
        <fieldset key={g.id} className="grupo">
          <legend>{g.nome}</legend>
          {catalogo.camadas.filter(c => c.grupo === g.id).map(c => {
            const st = estado[c.id]
            const radio = !!c.exclusivo
            return (
              <div key={c.id} className={`camada${st.visivel ? ' on' : ''}${st.indisponivel ? ' off' : ''}`}>
                <label className="camada-lin" htmlFor={`c-${c.id}`}>
                  <input
                    id={`c-${c.id}`} type={radio ? 'radio' : 'checkbox'} name={radio ? c.exclusivo : undefined}
                    checked={st.visivel} onChange={() => onAlternar(c.id)}
                  />
                  <span className="camada-nome">{c.nome}</span>
                </label>
                {st.indisponivel && <p className="camada-desc aviso">Indisponível neste ambiente (o servidor do mapa base não respondeu).</p>}
                {c.descricao && st.visivel && <p className="camada-desc">{c.descricao}</p>}
                {st.visivel && c.tipo !== 'vazio' && (
                  <label className="opac" htmlFor={`o-${c.id}`}>
                    <span>Opacidade</span>
                    <input id={`o-${c.id}`} type="range" min={0.1} max={1} step={0.05} value={st.opacidade}
                      onChange={e => onOpacidade(c.id, Number(e.target.value))} />
                    <span className="num">{Math.round(st.opacidade * 100)}%</span>
                  </label>
                )}
              </div>
            )
          })}
        </fieldset>
      ))}
    </div>
  )
}
