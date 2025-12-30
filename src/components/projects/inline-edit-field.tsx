'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditFieldProps {
  value: string | null | undefined;
  displayValue?: React.ReactNode;
  onSave: (value: string) => Promise<void>;
  type?: 'text' | 'number' | 'date' | 'currency' | 'select';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export function InlineEditField({
  value,
  displayValue,
  onSave,
  type = 'text',
  options = [],
  placeholder = 'Not set',
  className,
  inputClassName,
  disabled = false,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (disabled) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {displayValue || value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {type === 'select' ? (
          <Select
            value={editValue}
            onValueChange={(v) => {
              setEditValue(v);
              // Auto-save on select
              setIsSaving(true);
              onSave(v).then(() => {
                setIsEditing(false);
                setIsSaving(false);
              }).catch(() => setIsSaving(false));
            }}
          >
            <SelectTrigger className={cn('h-8 w-auto min-w-[120px]', inputClassName)}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            ref={inputRef}
            type={type === 'currency' ? 'number' : type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={cn('h-8 w-auto min-w-[100px]', inputClassName)}
            step={type === 'currency' ? '0.01' : undefined}
            disabled={isSaving}
          />
        )}
        {type !== 'select' && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setEditValue(value || '');
        setIsEditing(true);
      }}
      className={cn(
        'group flex items-center gap-2 cursor-pointer hover:bg-primary/5 rounded px-1 -mx-1 transition-colors text-left',
        className
      )}
    >
      {displayValue || value || <span className="text-muted-foreground italic">{placeholder}</span>}
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
