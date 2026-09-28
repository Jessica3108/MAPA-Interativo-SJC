import { FAIXAS_PORTE, FILTROS_INICIAIS, type Filtros } from '../dados/filtros'
import type { Base } from '../tipos'
import { corGrande } from '../util'

interface Props {
  base: Base
  filtros: Filtros
  onMudar: (f: Partial<Filtros>) => void
}

export default function PainelFiltros({ base, filtros: f, onMudar }: Props) {
  const { dic } = base
  const subsetores = Object.entries(dic.subsetores)
    .filter(([, s]) => f.grandes.includes(s.grande))
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR'))

  const alternarGrande = (g: number) => {
    let gs = f.grandes.includes(g) ? f.grandes.filter(x => x !== g) : [...f.grandes, g]
    if (!gs.length) gs = FILTROS_INICIAIS.grandes
    const sub = f.subsetor !== null && gs.includes(dic.subsetores[f.subsetor]?.grande) ? f.subsetor : null
    onMudar({ grandes: gs, subsetor: sub })
  }

  return (
    <div className="filtros">
      <div className="fld-head">
        <span>{dic.atividades.length} atividades · {dic.bairros.length} bairros</span>
        <button type="button" className="link" onClick={() => onMudar(FILTROS_INICIAIS)}>Limpar filtros</button>
      </div>

      {f.atividade !== null && (
        <div className="tag">
          <span><small>Atividade</small>{dic.atividades[f.atividade].nome}</span>
          <button type="button" aria-label="Remover filtro de atividade" onClick={() => onMudar({ atividade: null })}>×</button>
        </div>
      )}

      <label className="fld" htmlFor="f-texto">Atividade contém
        <input id="f-texto" className="inp" type="search" value={f.texto} placeholder="ex.: usinagem, software, padaria"
          onChange={e => onMudar({ texto: e.target.value })} />
      </label>

      <div className="fld">
        <span>Grande setor</span>
        <div className="chips" role="group" aria-label="Grande setor">
          {dic.grandes.map((nome, g) => (
            <button key={nome} type="button" className="chip" aria-pressed={f.grandes.includes(g)}
              style={{ ['--c' as string]: corGrande(g) }} onClick={() => alternarGrande(g)}>
              <i />{nome}
            </button>
          ))}
        </div>
      </div>

      <label className="fld" htmlFor="f-sub">Subsetor IBGE
        <select id="f-sub" className="inp" value={f.subsetor ?? ''} onChange={e => onMudar({ subsetor: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Todos</option>
          {subsetores.map(([k, s]) => <option key={k} value={k}>{s.nome}</option>)}
        </select>
      </label>

      <div className="fld-2">
        <label className="fld" htmlFor="f-porte">Porte (vínculos)
          <select id="f-porte" className="inp" value={f.porte ?? ''} onChange={e => onMudar({ porte: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Todos</option>
            {FAIXAS_PORTE.map((p, i) => <option key={p} value={i}>{p}</option>)}
          </select>
        </label>
        <label className="fld" htmlFor="f-bairro">Bairro
          <select id="f-bairro" className="inp" value={f.bairro ?? ''} onChange={e => onMudar({ bairro: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Todos</option>
            {dic.bairros.map((b, i) => <option key={b} value={i}>{b}</option>)}
          </select>
        </label>
      </div>

      <label className="chk" htmlFor="f-emp">
        <input id="f-emp" type="checkbox" checked={f.soComEmpregados} onChange={e => onMudar({ soComEmpregados: e.target.checked })} />
        Somente estabelecimentos com empregados em 31/12
      </label>
    </div>
  )
}
