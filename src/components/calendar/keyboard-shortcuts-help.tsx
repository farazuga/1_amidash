'use client';

import { useState } from 'react';
import { Keyboard, Command, Option } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ShortcutItem {
  keys: string[];
  action: string;
  description: string;
}

const shortcuts: ShortcutItem[] = [
  {
    keys: ['⌘', 'Drag'],
    action: 'Copy day',
    description: 'Hold Cmd while dragging to copy an assignment day',
  },
  {
    keys: ['⌥', 'Click'],
    action: 'Delete day',
    description: 'Hold Option and click to quickly remove a day',
  },
  {
    keys: ['⌘', 'Z'],
    action: 'Undo',
    description: 'Undo your last action (up to 10 actions)',
  },
];

function KeyboardKey({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium',
        'bg-muted border border-border rounded shadow-sm',
        'min-w-[24px] h-5',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', className)}
          title="Keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </div>
          <div className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  {shortcut.keys.map((key, keyIndex) => (
                    <span key={keyIndex} className="flex items-center gap-0.5">
                      {keyIndex > 0 && <span className="text-muted-foreground text-xs">+</span>}
                      <KeyboardKey>{key}</KeyboardKey>
                    </span>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{shortcut.action}</div>
                  <div className="text-xs text-muted-foreground">{shortcut.description}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <span className="font-medium">Tip:</span> On Windows, use Ctrl instead of ⌘ and Alt instead of ⌥
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
