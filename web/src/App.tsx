import { useCallback, useEffect, useMemo, useState } from 'react'
import { carregarBase } from './dados/fonte'
import { agregar, contarFiltros, FILTROS_INICIAIS, quebras, type Filtros } from './dados/filtros'
import type { Alvo, Base, EstadoCamadas, Foco, Metrica } from './tipos'
import MapView from './mapa/MapView'
import Busca, { type Resultado } from './components/Busca'
import PainelCamadas from './components/PainelCamadas'
import PainelFiltros from './components/PainelFiltros'
import PainelIndicadores from './components/PainelIndicadores'
import PainelIdentificar from './components/PainelIdentificar'
import Legenda from './components/Legenda'
import { fmt, useTema } from './util'

type Aba = 'camadas' | 'filtros' | 'indicadores'

export default function App() {
  const [base, setBase] = useState<Base | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => { carregarBase().then(setBase).catch(e => setErro(String(e.message ?? e))) }, [])
  if (erro) return <div className="carregando erro">Não foi possível carregar os dados. {erro}</div>
  if (!base) return <div className="carregando">Carregando dados da RAIS…</div>
  return <Geoportal base={base} />
}

function Geoportal({ base }: { base: Base }) {
  const tema = useTema()
  const [aba, setAba] = useState<Aba>('camadas')
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS)
  const [metrica, setMetrica] = useState<Metrica>('n')
  const [alvo, setAlvo] = useState<Alvo | null>(null)
  const [foco, setFoco] = useState<Foco>({ n: 0 })
  const [estado, setEstado] = useState<EstadoCamadas>(() =>
    Object.fromEntries(base.catalogo.camadas.map(c => [c.id, { visivel: c.visivel, opacidade: c.opacidade }])))

  const agregado = useMemo(() => agregar(base, filtros, metrica), [base, filtros, metrica])
  const quebrasBairro = useMemo(
    () => quebras([...agregado.porBairro.entries()].filter(([b]) => base.dic.bairros[b] !== 'Não identificado').map(([, s]) => (metrica === 'n' ? s.n : s.v))),
    [agregado, metrica, base])

  const mudarFiltros = useCallback((f: Partial<Filtros>) => setFiltros(x => ({ ...x, ...f })), [])
  const focar = (f: Omit<Foco, 'n'>) => setFoco(x => ({ ...f, n: x.n + 1 }))
  const pontosDoBairro = (id: number) => base.ceps.filter(c => c[4] === id && !c[5]).map(c => [c[1], c[2]] as [number, number])

  const alternarCamada = (id: string) => setEstado(e => {
    const c = base.catalogo.camadas.find(x => x.id === id)!
    const novo = { ...e }
    if (c.exclusivo) {
      for (const o of base.catalogo.camadas) if (o.exclusivo === c.exclusivo) novo[o.id] = { ...novo[o.id], visivel: o.id === id }
    } else novo[id] = { ...novo[id], visivel: !novo[id].visivel }
    return novo
  })

  // Se o mapa base não carregar (sem internet ou bloqueado), marca como indisponível e troca para "sem fundo".
  const tilesIndisponiveis = useCallback((id: string) => setEstado(e => {
    if (e[id].indisponivel) return e
    const novo = { ...e, [id]: { ...e[id], indisponivel: true } }
    if (novo[id].visivel) {
      novo[id] = { ...novo[id], visivel: false }
      const vazio = base.catalogo.camadas.find(c => c.tipo === 'vazio')
      if (vazio) novo[vazio.id] = { ...novo[vazio.id], visivel: true }
    }
    return novo
  }), [base])

  const escolherBusca = (r: Resultado) => {
    if (r.tipo === 'cep') { const c = base.ceps[r.idx]; setAlvo({ tipo: 'cep', idx: r.idx }); focar({ centro: [c[1], c[2]], zoom: 17 }) }
    if (r.tipo === 'rua') { setAlvo({ tipo: 'cep', idx: r.ceps[0] }); focar({ pontos: r.ceps.map(i => [base.ceps[i][1], base.ceps[i][2]]) }) }
    if (r.tipo === 'bairro') { setAlvo({ tipo: 'bairro', id: r.id }); focar({ pontos: pontosDoBairro(r.id) }) }
    if (r.tipo === 'atividade') { mudarFiltros({ atividade: r.idx, texto: '' }); setAba('indicadores') }
  }

  const nFiltros = contarFiltros(filtros)

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="7" fill="var(--accent)" /><circle cx="12" cy="13" r="4" fill="var(--accent-ink)" /><circle cx="21" cy="19" r="6" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" /><circle cx="22" cy="9" r="2" fill="var(--accent-ink)" /></svg>
          <div><b>GeoSJC</b><span>Mapa econômico de São José dos Campos</span></div>
        </div>
        <Busca base={base} onEscolher={escolherBusca} />
        <div className="seg metrica" role="group" aria-label="Medir por">
          <button type="button" aria-pressed={metrica === 'n'} onClick={() => setMetrica('n')}>Estabelecimentos</button>
          <button type="button" aria-pressed={metrica === 'v'} onClick={() => setMetrica('v')}>Empregos</button>
        </div>
      </header>

      <aside className="lateral">
        <nav className="abas" role="tablist" aria-label="Painéis">
          {(['camadas', 'filtros', 'indicadores'] as Aba[]).map(a => (
            <button key={a} role="tab" type="button" aria-selected={aba === a} onClick={() => setAba(a)}>
              {a === 'camadas' ? 'Camadas' : a === 'filtros' ? 'Filtros' : 'Indicadores'}
              {a === 'filtros' && nFiltros > 0 && <span className="badge">{nFiltros}</span>}
            </button>
          ))}
        </nav>
        <div className="resumo" aria-live="polite">
          <b>{fmt(agregado.total.n)}</b> estabelecimentos · <b>{fmt(agregado.total.v)}</b> empregos
          {nFiltros > 0 && <button type="button" className="link" onClick={() => setFiltros(FILTROS_INICIAIS)}>limpar filtros</button>}
        </div>
        <div className="aba-corpo" role="tabpanel">
          {aba === 'camadas' && <PainelCamadas catalogo={base.catalogo} estado={estado} onAlternar={alternarCamada}
            onOpacidade={(id, v) => setEstado(e => ({ ...e, [id]: { ...e[id], opacidade: v } }))} />}
          {aba === 'filtros' && <PainelFiltros base={base} filtros={filtros} onMudar={mudarFiltros} />}
          {aba === 'indicadores' && <PainelIndicadores base={base} agregado={agregado} metrica={metrica}
            onAtividade={i => mudarFiltros({ atividade: i, texto: '' })}
            onBairro={id => { setAlvo({ tipo: 'bairro', id }); focar({ pontos: pontosDoBairro(id) }) }} />}
        </div>
        <footer className="fonte">
          Fonte: {base.catalogo.fonte}. Localização pelo CEP; bairros e setores são aproximações derivadas dos CEPs.
        </footer>
      </aside>

      <main className="area-mapa">
        <MapView base={base} estado={estado} agregado={agregado} metrica={metrica} quebrasBairro={quebrasBairro}
          alvo={alvo} foco={foco} tema={tema} onIdentificar={setAlvo} onTilesIndisponiveis={tilesIndisponiveis} />
        <Legenda base={base} estado={estado} metrica={metrica} grandes={filtros.grandes} quebrasBairro={quebrasBairro} temDados={agregado.total.n > 0} />
        {alvo && <PainelIdentificar base={base} alvo={alvo} filtros={filtros} metrica={metrica} onFechar={() => setAlvo(null)}
          onFiltrarBairro={id => { mudarFiltros({ bairro: id }); focar({ pontos: pontosDoBairro(id) }) }} />}
      </main>
    </div>
  )
}
