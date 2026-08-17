/**
 * dsh-market client: registers a "Market" settings section rendering the
 * plugin market UI, plus the post-install toast in the shell overlay layer.
 * Built by tsdown into the __ModuleLoader__ factory bundle at
 * client/client.js; the only externals are the loader module table's react
 * entries.
 */
import { createElement as h } from 'react'
import { en, zh } from './locales.ts'
import { InstallToast } from './InstallToast.tsx'
import { MarketSection } from './MarketSection.tsx'
import type { ThemeSnapshot, Translate } from './market-data.ts'

const NS = 'dsh-market'

/** The subset of the theme service this plugin touches. */
interface ThemeService {
  getTheme(): ThemeSnapshot | null
  setTheme(id: string): void
}

/** The subset of the locale service this plugin touches. */
interface LocaleService {
  register(namespace: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): unknown
  bind(namespace: string): Translate
  subscribe(callback: () => void): () => void
  getSnapshot(): { active: string }
}

/** The subset of the slots service this plugin touches. */
interface SlotsService {
  inject(slot: string, register: () => unknown): void
  register(meta: Record<string, unknown>, component: () => unknown): unknown
}

/** The client cordis context shape this plugin relies on (structural: the
 * host provides the real Context; typing the touched surface keeps this
 * external package free of monorepo-internal type dependencies). */
interface MarketClientContext {
  effect(callback: () => unknown, label?: string): void
  on(event: string, callback: () => void): () => void
  locale: LocaleService
  slots: SlotsService
  theme: ThemeService
}

export const name = 'dsh-market'
// 'theme' is safe to require: ui-layout (mandatory in every web composition)
// already hard-depends on it. This cordis's object-form inject means
// intercept config, NOT {required,optional} — do not use it here.
export const inject = ['slots', 'locale', 'theme']
export function apply(ctx: MarketClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-market: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'market',
    order: 40,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ t }),
  }, () => h(MarketSection, {
    t,
    locale: ctx.locale,
    theme: ctx.theme,
    themeStore: {
      subscribe: (cb: () => void) => ctx.on('theme/change', cb),
      getSnapshot: () => ctx.theme.getTheme(),
    },
  })))

  const Toast = () => h(InstallToast, { t })
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'dsh-market-toast',
    label: () => 'dsh-market',
  }, Toast))
}
