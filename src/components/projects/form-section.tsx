import * as React from "react"

import { cn } from "@/lib/utils"

interface FormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  variant?: "default" | "muted"
  className?: string
}

export function FormSection({
  title,
  description,
  children,
  variant = "default",
  className,
}: FormSectionProps) {
  return (
    <fieldset
      className={cn(
        "space-y-4",
        variant === "muted" && "bg-muted/30 rounded-lg p-4 border border-dashed",
        className
      )}
    >
      <legend className="flex items-center gap-3 text-sm font-semibold text-primary w-full">
        <span className="h-px flex-1 bg-border" />
        <span className="uppercase tracking-wide px-2">{title}</span>
        <span className="h-px flex-1 bg-border" />
      </legend>
      {description && (
        <p className="text-sm text-muted-foreground -mt-2">{description}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  )
}
