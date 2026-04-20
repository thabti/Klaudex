import { memo, useState, useCallback } from 'react'
import { IconForms, IconSend } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { ipc } from '@/lib/ipc'
import { useTaskStore } from '@/stores/taskStore'

interface UserInputField {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
}

interface UserInputCardProps {
  taskId: string
  requestId: string
  fields: UserInputField[]
}

export const UserInputCard = memo(function UserInputCard({
  taskId, requestId, fields,
}: UserInputCardProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})

  const handleFieldChange = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(() => {
    ipc.respondUserInput(taskId, requestId, values).catch(() => {})
    useTaskStore.setState((s) => {
      const { [taskId]: _, ...rest } = s.pendingUserInputs
      return { pendingUserInputs: rest }
    })
  }, [taskId, requestId, values])

  const isValid = fields.every((f) => !f.required || (values[f.name] !== undefined && values[f.name] !== ''))

  return (
    <div
      data-testid="user-input-card"
      className="my-3 overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.04] to-transparent"
    >
      <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/[0.06] px-4 py-2">
        <IconForms className="size-4 text-primary" aria-hidden />
        <span className="text-[12px] font-semibold tracking-wide text-primary">Input Required</span>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        {fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-1">
            <label htmlFor={`input-${field.name}`} className="text-[12px] font-medium text-foreground">
              {field.label}
              {field.required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
            {field.type === 'select' && field.options ? (
              <select
                id={`input-${field.name}`}
                value={(values[field.name] as string) ?? ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10"
                aria-label={field.label}
              >
                <option value="">Select...</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                id={`input-${field.name}`}
                value={(values[field.name] as string) ?? ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                rows={3}
                className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 focus:ring-1 focus:ring-primary/10"
                aria-label={field.label}
              />
            ) : (
              <input
                id={`input-${field.name}`}
                type={field.type === 'boolean' ? 'checkbox' : 'text'}
                value={field.type === 'boolean' ? undefined : ((values[field.name] as string) ?? '')}
                checked={field.type === 'boolean' ? (values[field.name] as boolean) ?? false : undefined}
                onChange={(e) => handleFieldChange(field.name, field.type === 'boolean' ? e.target.checked : e.target.value)}
                className={cn(
                  field.type === 'boolean'
                    ? 'size-4 rounded border-border accent-primary'
                    : 'w-full rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 focus:ring-1 focus:ring-primary/10',
                )}
                aria-label={field.label}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end border-t border-primary/10 bg-primary/[0.02] px-4 py-2.5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-all',
            isValid
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'cursor-not-allowed bg-muted text-muted-foreground',
          )}
          aria-label="Submit input"
          tabIndex={0}
        >
          <IconSend className="size-3.5" aria-hidden />
          Submit
        </button>
      </div>
    </div>
  )
})
