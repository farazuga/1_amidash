'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUser } from '@/contexts/user-context';
import {
  GLOBAL_SHORTCUTS,
  ADMIN_SHORTCUTS,
  CALENDAR_SHORTCUTS,
  PROJECTS_SHORTCUTS,
  PROJECT_DETAIL_SHORTCUTS,
  formatShortcutKeys,
  type ShortcutDefinition,
} from '@/lib/keyboard-shortcuts';

function ShortcutSection({
  title,
  shortcuts,
}: {
  title: string;
  shortcuts: ShortcutDefinition[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-1">
        {shortcuts.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-1">
            <span className="text-sm">{s.label}</span>
            <kbd className="inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
              {formatShortcutKeys(s.keys)}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useUser();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-shortcuts-dialog', handler);
    return () => window.removeEventListener('open-shortcuts-dialog', handler);
  }, []);

  const globalNonNav = GLOBAL_SHORTCUTS.filter((s) => s.section === 'Global');
  const navigation = GLOBAL_SHORTCUTS.filter((s) => s.section === 'Navigation');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <ShortcutSection title="Global" shortcuts={globalNonNav} />
          <ShortcutSection title="Navigation" shortcuts={navigation} />
          {isAdmin && <ShortcutSection title="Admin" shortcuts={ADMIN_SHORTCUTS} />}
          <ShortcutSection title="Calendar" shortcuts={CALENDAR_SHORTCUTS} />
          <ShortcutSection title="Projects List" shortcuts={PROJECTS_SHORTCUTS} />
          <ShortcutSection title="Project Detail" shortcuts={PROJECT_DETAIL_SHORTCUTS} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
