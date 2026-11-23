import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { LoaderCircle } from 'lucide-react'

export function Button({ children, className = '', loading = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return <button className={`button ${className}`} disabled={props.disabled || loading} {...props}>
    {loading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}{children}
  </button>
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <section className={`surface-card ${className}`} {...props}>{children}</section>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'teal' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading">
    <div><h1>{title}</h1><p>{description}</p></div>
    {action}
  </div>
}

export function LoadingPanel({ label = 'Loading data' }: { label?: string }) {
  return <div className="loading-panel" role="status"><LoaderCircle className="size-5 animate-spin text-teal-700" /><span>{label}</span></div>
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-panel" role="alert"><p>{message}</p>{onRetry && <button className="text-link" onClick={onRetry}>Try again</button>}</div>
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  afterLabel?: ReactNode
  endAdornment?: ReactNode
  error?: string
}

export function TextInput({ label, hint, afterLabel, endAdornment, error, id, className = '', ...props }: TextInputProps) {
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = error ? `${inputId}-error` : undefined
  const hintId = hint ? `${inputId}-hint` : undefined
  return <div className={`text-input-field ${className}`}>
    <div className="field-label-row"><label htmlFor={inputId}>{label}</label>{afterLabel}</div>
    <div className="field-control-wrap"><input id={inputId} aria-invalid={Boolean(error)} aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined} {...props} />{endAdornment}</div>
    {hint && <span id={hintId} className="text-input-hint">{hint}</span>}
    {error && <span id={errorId} className="field-error">{error}</span>}
  </div>
}

export interface DataColumn<Row> {
  key: string
  label: string
  className?: string
  render: (row: Row) => ReactNode
}

export function DataTable<Row extends { _id: string }>({ columns, rows, ariaLabel, empty }: { columns: DataColumn<Row>[]; rows: Row[]; ariaLabel: string; empty: ReactNode }) {
  if (!rows.length) return <div className="empty-table">{empty}</div>
  return <div className="table-scroll"><table className="data-table" aria-label={ariaLabel}>
    <thead><tr>{columns.map((column) => <th className={column.className} key={column.key} scope="col">{column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr key={row._id}>{columns.map((column) => <td className={column.className} key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody>
  </table></div>
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab' && dialogRef.current) {
        const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled'))
        if (!controls.length) { event.preventDefault(); return }
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-panel" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="modal-header"><h2 id={titleId}>{title}</h2><button type="button" className="modal-close" aria-label="Close dialog" onClick={onClose}>×</button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>
}
