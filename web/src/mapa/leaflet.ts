// Leaflet + plugin de mapa de calor. O plugin espera `L` global, então ele é
// registrado aqui antes de o plugin ser importado.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

;(window as unknown as { L: typeof L }).L = L

export async function carregarHeat() {
  await import('leaflet.heat')
  return (L as unknown as { heatLayer: (pts: [number, number, number][], o: object) => L.Layer }).heatLayer
}

export default L
