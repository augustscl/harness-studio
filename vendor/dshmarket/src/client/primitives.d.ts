/**
 * Ambient types for @deepseek-ai/dsh-client-ui-primitives — provided at
 * runtime by the host's frozen platform module table
 * (packages/client/web/src/platform.ts), never bundled or installed, so the
 * package has no published types to import. Only the members this plugin
 * uses are declared; keep signatures in sync with
 * deepseek-harness/packages/client/ui-primitives/src/.
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode } from 'react'

  export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'toolbar'
  export function Button(props: {
    variant?: ButtonVariant
    size?: 'md' | 'sm'
    icon?: ReactNode
    className?: string | undefined
    children?: ReactNode
  } & ButtonHTMLAttributes<HTMLButtonElement>): ReactElement

  export function Pill(props: {
    active?: boolean
    className?: string | undefined
    children?: ReactNode
  } & ButtonHTMLAttributes<HTMLButtonElement>): ReactElement

  export function Input(props: {
    icon?: ReactNode
    className?: string
  } & InputHTMLAttributes<HTMLInputElement>): ReactElement

  export function Modal(props: {
    open: boolean
    onClose: () => void
    title: string
    closeLabel?: string
    description?: string
    children?: ReactNode
    footer?: ReactNode
    className?: string
    contentClassName?: string
    headless?: boolean
  }): ReactElement | null

  export function Toast(props: {
    text: string
    icon?: ReactNode
    anchor?: HTMLElement | null
    onDone: () => void
  }): ReactElement

  export interface IconProps {
    size?: number
    className?: string
  }
  export function IconChevronDownOutline14(props: IconProps): ReactElement
  export function IconChevronUpOutline14(props: IconProps): ReactElement
  export function IconSearchOutline16(props: IconProps): ReactElement

  export type StateDotState = 'done' | 'warning' | 'ongoing' | 'error'
  export function StateDot(props: {
    state: StateDotState
    size?: number | undefined
    className?: string | undefined
  }): ReactElement
}
