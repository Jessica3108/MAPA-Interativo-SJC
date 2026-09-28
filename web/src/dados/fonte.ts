// Única porta de entrada dos dados no frontend.
//
// Fase 1 (hoje): arquivos estáticos gerados pelo pipeline em public/dados/.
// Fase 2 (API):  troque BASE_DADOS por '/api/' — a API FastAPI serve os mesmos
//                caminhos (camadas.json, estabelecimentos.json…), então nada mais muda.
import type { Base, Catalogo, Cep, Dicionarios, Estab } from '../tipos'

export const BASE_DADOS = `${import.meta.env.BASE_URL}dados/`

async function json<T>(arquivo: string): Promise<T> {
  const r = await fetch(BASE_DADOS + arquivo)
  if (!r.ok) throw new Error(`Não foi possível carregar ${arquivo} (HTTP ${r.status}).`)
  return r.json() as Promise<T>
}

export async function carregarBase(): Promise<Base> {
  const [catalogo, dic, ceps, estab] = await Promise.all([
    json<Catalogo>('camadas.json'),
    json<Dicionarios>('dicionarios.json'),
    json<{ linhas: Cep[] }>('ceps.json'),
    json<{ linhas: Estab[] }>('estabelecimentos.json'),
  ])
  const grandeDe: Record<number, number> = {}
  for (const [k, v] of Object.entries(dic.subsetores)) grandeDe[Number(k)] = v.grande
  return { catalogo, dic, ceps: ceps.linhas, estab: estab.linhas, grandeDe }
}

const cacheGeo = new Map<string, Promise<GeoJSON.FeatureCollection>>()
export function carregarGeoJSON(arquivo: string) {
  if (!cacheGeo.has(arquivo)) cacheGeo.set(arquivo, json<GeoJSON.FeatureCollection>(arquivo))
  return cacheGeo.get(arquivo)!
}
