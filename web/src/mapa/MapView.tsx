// O mapa. Lê o catálogo de camadas e desenha cada uma conforme o seu `tipo`.
// Camadas estáticas (tiles, polígonos) são criadas uma vez; camadas RAIS são
// redesenhadas sempre que os filtros ou a métrica mudam.
import { useEffect, useRef, useState } from 'react'
import L, { carregarHeat } from './leaflet'
import { carregarGeoJSON } from '../dados/fonte'
import { classe, type Agregado } from '../dados/filtros'
import type { Alvo, Base, Camada, EstadoCamadas, Foco, Metrica } from '../tipos'
import { cor } from '../util'

interface Props {
  base: Base
  estado: EstadoCamadas
  agregado: Agregado
  metrica: Metrica
  quebrasBairro: number[]
  alvo: Alvo | null
  foco: Foco
  tema: number
  onIdentificar: (a: Alvo) => void
  onTilesIndisponiveis: (id: string) => void
}

const PANES: [string, number][] = [['coropletico', 380], ['divisoes', 410], ['calor', 420], ['pontos', 430], ['selecao', 440]]

export default function MapView(p: Props) {
  const div = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const estaticas = useRef(new Map<string, L.Layer>())
  const dinamicas = useRef(new Map<string, L.Layer>())
  const selecao = useRef<L.LayerGroup | null>(null)
  const ultimoPonto = useRef(0)
  const [sobre, setSobre] = useState('')
  const cb = useRef(p)
  cb.current = p

  const camadas = p.base.catalogo.camadas

  // ---------- cria o mapa
  useEffect(() => {
    const { centro, zoom } = p.base.catalogo
    const m = L.map(div.current!, { preferCanvas: true, zoomControl: false, minZoom: 9 }).setView(centro, zoom)
    m.attributionControl.setPrefix(false)
    L.control.zoom({ position: 'topright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(m)
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(m)
    for (const [nome, z] of PANES) m.createPane(nome).style.zIndex = String(z)
    selecao.current = L.layerGroup([], { pane: 'selecao' }).addTo(m)
    m.on('click', async ev => {
      if (Date.now() - ultimoPonto.current < 80) return
      const r = await feicaoEm(ev.latlng)
      if (!r) return
      if ('setor' in r.props) cb.current.onIdentificar({ tipo: 'setor', setor: String(r.props.setor) })
      else cb.current.onIdentificar({ tipo: 'bairro', id: Number(r.props[r.camada.chave ?? 'id']) })
    })
    let pendente = false
    m.on('mousemove', ev => {
      if (pendente) return
      pendente = true
      requestAnimationFrame(async () => {
        pendente = false
        const r = await feicaoEm(ev.latlng)
        setSobre(r ? `${r.camada.nome.replace(/ \(.*\)$/, '')}: ${String(r.props.nome ?? r.props.setor ?? '')}` : '')
      })
    })
    m.on('mouseout', () => setSobre(''))
    mapa.current = m
    return () => { m.remove(); mapa.current = null; estaticas.current.clear(); dinamicas.current.clear() }
  }, [p.base])

  // ---------- camadas estáticas: tiles e polígonos
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    for (const c of camadas) {
      if (c.tipo !== 'tiles' && c.tipo !== 'poligono') continue
      const st = p.estado[c.id]
      let lyr = estaticas.current.get(c.id)
      if (!st.visivel) { if (lyr && m.hasLayer(lyr)) m.removeLayer(lyr); continue }
      if (!lyr) {
        if (c.tipo === 'tiles') {
          const t = L.tileLayer(c.url!, { maxZoom: 19, attribution: c.atribuicao, opacity: st.opacidade })
          let falhas = 0, ok = 0
          t.on('tileload', () => { ok++ })
          t.on('tileerror', () => { if (++falhas >= 4 && ok === 0) cb.current.onTilesIndisponiveis(c.id) })
          lyr = t
        } else {
          const g = L.geoJSON(undefined, { pane: 'divisoes', interactive: false, style: () => estiloPoligono(c, st.opacidade) })
          carregarGeoJSON(c.arquivo!).then(fc => g.addData(fc))
          lyr = g
        }
        estaticas.current.set(c.id, lyr)
      }
      if (lyr instanceof L.TileLayer) lyr.setOpacity(st.opacidade)
      else if (lyr instanceof L.GeoJSON) lyr.setStyle(estiloPoligono(c, st.opacidade))
      if (!m.hasLayer(lyr)) m.addLayer(lyr)
      if (lyr instanceof L.TileLayer) lyr.bringToBack()
    }
  }, [p.estado, p.tema, camadas])

  /** Polígono identificável sob o cursor. Pontos ficam num canvas acima dos polígonos,
   *  então polígonos são identificados por geometria (ponto-em-polígono), não por evento. */
  async function feicaoEm(ll: L.LatLng): Promise<{ camada: Camada; props: Record<string, unknown> } | null> {
    const est = cb.current.estado
    const ordem = [...camadas].filter(c => c.identificavel && c.arquivo && est[c.id]?.visivel)
      .sort((a, b) => (a.id === 'setores' ? -1 : b.id === 'setores' ? 1 : 0))
    for (const c of ordem) {
      const f = acharFeicao(await carregarGeoJSON(c.arquivo!), ll.lat, ll.lng)
      if (f) return { camada: c, props: f.properties ?? {} }
    }
    return null
  }

  // ---------- camadas RAIS (dinâmicas)
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    let cancelado = false
    for (const [, l] of dinamicas.current) m.removeLayer(l)
    dinamicas.current.clear()
    const { agregado: A, metrica, base } = p

    for (const c of camadas) {
      const st = p.estado[c.id]
      if (!st?.visivel) continue

      if (c.tipo === 'rais-pontos') {
        const renderer = L.canvas({ pane: 'pontos', padding: 0.3 })
        const grupo = L.layerGroup()
        const ordem: number[] = []
        for (let i = 0; i < A.cepN.length; i++) if (A.cepN[i]) ordem.push(i)
        const val = (i: number) => (metrica === 'n' ? A.cepN[i] : A.cepV[i])
        ordem.sort((a, b) => val(b) - val(a))
        const borda = cor('--panel')
        const cores = [0, 1, 2, 3, 4, 5].map(g => cor(`--s${g}`))
        for (const i of ordem) {
          const cep = base.ceps[i]
          const x = val(i)
          const r = metrica === 'n' ? Math.min(3 + Math.sqrt(x) * 1.25, 26) : Math.min(3 + Math.sqrt(x) * 0.33, 32)
          L.circleMarker([cep[1], cep[2]], {
            renderer, pane: 'pontos', radius: r, color: borda, weight: 0.8,
            fillColor: cores[A.cepDom[i]], fillOpacity: st.opacidade * (cep[5] ? 0.55 : 1),
            opacity: st.opacidade,
          }).on('click', () => { ultimoPonto.current = Date.now(); cb.current.onIdentificar({ tipo: 'cep', idx: i }) }).addTo(grupo)
        }
        grupo.addTo(m)
        dinamicas.current.set(c.id, grupo)
      }

      if (c.tipo === 'rais-calor') {
        carregarHeat().then(heatLayer => {
          if (cancelado) return
          const pts: [number, number, number][] = []
          for (let i = 0; i < A.cepN.length; i++) {
            const x = metrica === 'n' ? A.cepN[i] : A.cepV[i]
            if (!x) continue
            const cep = base.ceps[i]
            pts.push([cep[1], cep[2], x])
          }
          const h = heatLayer(pts, {
            // intensidade máxima = percentil 97 dos CEPs filtrados, para o mapa não "apagar" com poucos dados
            radius: 22, blur: 18, maxZoom: 15, max: Math.max(1, percentil(pts.map(x => x[2]), 0.97)),
            gradient: { 0.2: '#2c7fb8', 0.45: '#41b6c4', 0.65: '#c7e9b4', 0.82: '#fdae61', 1: '#d7191c' },
          })
          h.addTo(m)
          const canvas = (h as unknown as { _canvas?: HTMLCanvasElement })._canvas
          if (canvas) { canvas.style.opacity = String(st.opacidade); canvas.style.zIndex = '420' }
          dinamicas.current.set(c.id, h)
        })
      }

      if (c.tipo === 'rais-coropletico') {
        const g = L.geoJSON(undefined, {
          pane: 'coropletico', interactive: false,
          style: f => {
            const id = Number(f?.properties?.[c.chave ?? 'id'])
            const s = A.porBairro.get(id)
            const k = classe(s ? (metrica === 'n' ? s.n : s.v) : 0, p.quebrasBairro)
            return { color: cor('--div-line'), weight: 0.8, fillColor: k ? cor(`--q${k}`) : 'transparent', fillOpacity: k ? st.opacidade : 0 }
          },
        })
        carregarGeoJSON(c.arquivo!).then(fc => { if (!cancelado) g.addData(fc) })
        g.addTo(m)
        dinamicas.current.set(c.id, g)
      }
    }
    return () => { cancelado = true }
  }, [p.agregado, p.metrica, p.estado, p.quebrasBairro, p.tema, camadas])

  useEffect(() => setSobre(''), [p.estado])

  // ---------- destaque do item identificado
  useEffect(() => {
    const s = selecao.current
    if (!s) return
    s.clearLayers()
    const a = p.alvo
    if (!a) return
    const destaque = cor('--accent')
    if (a.tipo === 'cep') {
      const c = p.base.ceps[a.idx]
      L.circleMarker([c[1], c[2]], { pane: 'selecao', radius: 14, color: destaque, weight: 3, fill: false, interactive: false }).addTo(s)
    } else {
      const arquivo = a.tipo === 'bairro' ? 'bairros.geojson' : 'setores.geojson'
      carregarGeoJSON(arquivo).then(fc => {
        const f = fc.features.find(x => (a.tipo === 'bairro' ? x.properties?.id === a.id : x.properties?.setor === a.setor))
        if (f) L.geoJSON(f, { pane: 'selecao', interactive: false, style: { color: destaque, weight: 3, fill: false } }).addTo(s)
      })
    }
  }, [p.alvo, p.tema, p.base])

  // ---------- enquadramento pedido pela busca / rankings
  useEffect(() => {
    const m = mapa.current
    const f = p.foco
    if (!m || !f.n) return
    if (f.pontos?.length) m.fitBounds(L.latLngBounds(f.pontos).pad(0.3), { maxZoom: 16 })
    else if (f.centro) m.setView(f.centro, f.zoom ?? 16)
  }, [p.foco])

  return (
    <>
      <div ref={div} className="mapa" role="region" aria-label="Mapa" />
      {sobre && <div className="sobre" aria-hidden="true">{sobre}</div>}
    </>
  )
}

// ---------- geometria simples (ponto-em-polígono com pré-teste de caixa)
type Anel = number[][]
const caixas = new WeakMap<GeoJSON.Feature, [number, number, number, number]>()
function caixa(f: GeoJSON.Feature) {
  let b = caixas.get(f)
  if (!b) {
    b = [Infinity, Infinity, -Infinity, -Infinity]
    for (const anel of aneis(f.geometry)) for (const [x, y] of anel) {
      if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y
    }
    caixas.set(f, b)
  }
  return b
}
function aneis(g: GeoJSON.Geometry): Anel[] {
  if (g.type === 'Polygon') return g.coordinates as Anel[]
  if (g.type === 'MultiPolygon') return (g.coordinates as Anel[][]).flat()
  return []
}
function dentroAnel(x: number, y: number, a: Anel) {
  let d = false
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [xi, yi] = a[i], [xj, yj] = a[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d
  }
  return d
}
function acharFeicao(fc: GeoJSON.FeatureCollection, lat: number, lng: number) {
  for (const f of fc.features) {
    const b = caixa(f)
    if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue
    // regra par-ímpar sobre todos os anéis trata buracos corretamente
    let d = false
    for (const a of aneis(f.geometry)) if (dentroAnel(lng, lat, a)) d = !d
    if (d) return f
  }
  return null
}

function percentil(v: number[], p: number) {
  if (!v.length) return 1
  const s = [...v].sort((a, b) => a - b)
  return s[Math.floor(p * (s.length - 1))]
}

function estiloPoligono(c: Camada, opacidade: number): L.PathOptions {
  const e = c.estilo ?? {}
  return {
    color: cor(e.cor ?? '--div-line'), weight: e.espessura ?? 1, dashArray: e.tracejado, opacity: opacidade,
    fill: !!e.preenchimento, fillColor: cor(e.preenchimento ?? null), fillOpacity: (e.opacidadePreenchimento ?? 0.3) * opacidade,
  }
}
