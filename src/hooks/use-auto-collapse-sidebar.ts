'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSidebarStore } from '@/lib/stores/sidebar-store';

export function useAutoCollapseSidebar() {
  const pathname = usePathname();
  const { setCollapsed } = useSidebarStore();
  const previousPathRef = useRef(pathname);

  // Pattern: /projects/[id]/... (any sub-page of a specific project)
  const isProjectSubPage = /^\/projects\/[^/]+\/.+/.test(pathname);

  useEffect(() => {
    const wasProjectSubPage = /^\/projects\/[^/]+\/.+/.test(previousPathRef.current);

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
