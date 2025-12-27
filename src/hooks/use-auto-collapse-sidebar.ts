'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSidebarStore } from '@/lib/stores/sidebar-store';

export function useAutoCollapseSidebar() {
  const pathname = usePathname();
  const { setCollapsed } = useSidebarStore();
  const previousPathRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Pattern: /projects/[id]/... (any sub-page of a specific project)
  const isProjectSubPage = /^\/projects\/[^/]+\/.+/.test(pathname);

  useEffect(() => {
    // On initial load, collapse if on project sub-page
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (isProjectSubPage) {
        setCollapsed(true);
      }
      previousPathRef.current = pathname;
      return;
    }

    const wasProjectSubPage = previousPathRef.current
      ? /^\/projects\/[^/]+\/.+/.test(previousPathRef.current)
      : false;

    // Auto-collapse when entering project sub-page
    if (isProjectSubPage && !wasProjectSubPage) {
      setCollapsed(true);
    }

    // Auto-expand when leaving project sub-page
    if (!isProjectSubPage && wasProjectSubPage) {
      setCollapsed(false);
    }

    previousPathRef.current = pathname;
  }, [pathname, setCollapsed, isProjectSubPage]);

  return { isProjectSubPage };
}
