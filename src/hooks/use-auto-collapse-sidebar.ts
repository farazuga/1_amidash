'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSidebarStore } from '@/lib/stores/sidebar-store';

export function useAutoCollapseSidebar() {
  const pathname = usePathname();
  const { setCollapsed } = useSidebarStore();
  const previousPathRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Pattern: /projects/[salesOrder] or /projects/[salesOrder]/... (project detail or sub-pages)
  // But NOT /projects (list) or /projects/new (create)
  const isProjectDetailPage = /^\/projects\/(?!new$)[^/]+/.test(pathname);

  useEffect(() => {
    // On initial load, collapse if on project detail page
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (isProjectDetailPage) {
        setCollapsed(true);
      }
      previousPathRef.current = pathname;
      return;
    }

    const wasProjectDetailPage = previousPathRef.current
      ? /^\/projects\/(?!new$)[^/]+/.test(previousPathRef.current)
      : false;

    // Auto-collapse when entering project detail page
    if (isProjectDetailPage && !wasProjectDetailPage) {
      setCollapsed(true);
    }

    // Auto-expand when leaving project detail page
    if (!isProjectDetailPage && wasProjectDetailPage) {
      setCollapsed(false);
    }

    previousPathRef.current = pathname;
  }, [pathname, setCollapsed, isProjectDetailPage]);

  return { isProjectDetailPage };
}
