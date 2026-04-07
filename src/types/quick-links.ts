export interface QuickLinkCategory {
  id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuickLinkItem {
  id: string;
  category_id: string;
  title: string;
  url: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Category with its items and subcategories nested */
export interface QuickLinkCategoryTree extends QuickLinkCategory {
  children: QuickLinkCategoryTree[];
  items: QuickLinkItem[];
}
