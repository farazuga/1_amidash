import type {
  QuickLinkCategory,
  QuickLinkItem,
  QuickLinkCategoryTree,
} from '@/types/quick-links';

export function buildCategoryTree(
  categories: QuickLinkCategory[],
  items: QuickLinkItem[]
): QuickLinkCategoryTree[] {
  const nodeMap = new Map<string, QuickLinkCategoryTree>();
  for (const cat of categories) {
    nodeMap.set(cat.id, { ...cat, children: [], items: [] });
  }

  for (const item of items) {
    const node = nodeMap.get(item.category_id);
    if (node) node.items.push(item);
  }

  const roots: QuickLinkCategoryTree[] = [];
  for (const node of nodeMap.values()) {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: QuickLinkCategoryTree[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const node of nodes) {
      node.items.sort((a, b) => a.sort_order - b.sort_order);
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

export function filterTree(
  tree: QuickLinkCategoryTree[],
  query: string
): QuickLinkCategoryTree[] {
  if (!query.trim()) return tree;

  const q = query.toLowerCase();

  return tree
    .map((category) => {
      const categoryNameMatches = category.name.toLowerCase().includes(q);
      const filteredChildren = filterTree(category.children, query);
      const filteredItems = categoryNameMatches
        ? category.items
        : category.items.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              (item.description && item.description.toLowerCase().includes(q))
          );

      if (filteredItems.length > 0 || filteredChildren.length > 0 || categoryNameMatches) {
        return {
          ...category,
          children: filteredChildren,
          items: filteredItems,
        };
      }

      return null;
    })
    .filter((c): c is QuickLinkCategoryTree => c !== null);
}
