import { useEffect, useState } from 'react'

export const fmt = (n: number) => n.toLocaleString('pt-BR')
export const fmtCep = (c: string) => (c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : c)

/** Lê uma variável CSS do tema atual. Aceita também cores literais. */
export function cor(nome: string | null | undefined): string {
  if (!nome) return 'transparent'
  if (!nome.startsWith('--')) return nome
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
}

/** Contador que muda quando o tema (claro/escuro) muda, para recolorir o mapa. */
export function useTema() {
  const [t, setT] = useState(0)
  useEffect(() => {
    const bump = () => setT(x => x + 1)
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    mq?.addEventListener?.('change', bump)
    const mo = new MutationObserver(bump)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { mq?.removeEventListener?.('change', bump); mo.disconnect() }
  }, [])
  return t
}

export const corGrande = (g: number) => `var(--s${g})`
