"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  required,
  error,
  description,
  children,
  className,
}: FormFieldProps) {
  const id = React.useId()

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className={cn(error && "text-destructive")}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      <div className="relative">
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
              id,
              "aria-invalid": !!error,
              "aria-describedby": error
                ? `${id}-error`
                : description
                  ? `${id}-desc`
                  : undefined,
              className: cn(
                (children as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props.className,
                error && "border-destructive focus-visible:ring-destructive/50"
              ),
            })
          : children}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="text-xs text-destructive flex items-center gap-1"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}

      {description && !error && (
        <p id={`${id}-desc`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}
