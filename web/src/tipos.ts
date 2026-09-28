// Tipos compartilhados. Espelham os arquivos gerados por pipeline/gerar_camadas.py.

export type TipoCamada =
  | 'tiles'            // mapa base em mosaico (OSM, satélite…)
  | 'vazio'            // sem fundo
  | 'poligono'         // qualquer GeoJSON de polígonos (limite, bairros, zoneamento…)
  | 'rais-pontos'      // círculos por CEP, recalculados com os filtros
  | 'rais-calor'       // mapa de calor, recalculado com os filtros
  | 'rais-coropletico' // polígonos coloridos pelo total filtrado

export interface Estilo {
  cor?: string              // cor da linha: hex ou nome de variável CSS ("--mun-line")
  espessura?: number
  preenchimento?: string | null
  opacidadePreenchimento?: number
  tracejado?: string
}

export interface Camada {
  id: string
  grupo: string
  nome: string
  tipo: TipoCamada
  visivel: boolean
  opacidade: number
  descricao?: string
  arquivo?: string          // GeoJSON dentro de /dados
  url?: string              // para tiles
  atribuicao?: string
  exclusivo?: string        // camadas com o mesmo valor são mutuamente exclusivas (ex.: "base")
  rotulo?: string           // propriedade mostrada ao identificar
  identificavel?: boolean
  estilo?: Estilo
  chave?: string            // propriedade que liga a feição ao agregado (rais-coropletico)
  agregarPor?: 'bairro' | 'setor'
}

export interface Catalogo {
  titulo: string
  fonte: string
  centro: [number, number]
  zoom: number
  grupos: { id: string; nome: string }[]
  camadas: Camada[]
}

export interface Dicionarios {
  subsetores: Record<string, { nome: string; grande: number }>
  grandes: string[]
  portes: Record<string, string>
  naturezas: { codigo: string; nome: string }[]
  atividades: { nome: string; cnae: string }[]
  bairros: string[]
}

/** [cep, atividade, subsetor, porte, vinculos, ativa_ano, simples, natureza] — índices nos dicionários */
export type Estab = [number, number, number, number, number, number, number, number]
/** [cep, lat, lon, rua, bairro, aprox] */
export type Cep = [string, number, number, string, number, number]

export interface Base {
  catalogo: Catalogo
  dic: Dicionarios
  ceps: Cep[]
  estab: Estab[]
  /** grande setor de cada subsetor, pré-calculado */
  grandeDe: Record<number, number>
}

export type Metrica = 'n' | 'v'

export type Alvo =
  | { tipo: 'cep'; idx: number }
  | { tipo: 'bairro'; id: number }
  | { tipo: 'setor'; setor: string }

export interface EstadoCamada { visivel: boolean; opacidade: number; indisponivel?: boolean }
export type EstadoCamadas = Record<string, EstadoCamada>

/** Pedido para o mapa mudar de enquadramento. `n` muda a cada pedido para disparar o efeito. */
export interface Foco {
  n: number
  pontos?: [number, number][]
  centro?: [number, number]
  zoom?: number
}
