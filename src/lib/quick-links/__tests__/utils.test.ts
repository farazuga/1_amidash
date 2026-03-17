import { describe, it, expect } from 'vitest';
import { buildCategoryTree, filterTree } from '../utils';
import type { QuickLinkCategory, QuickLinkItem } from '@/types/quick-links';

function makeCategory(overrides: Partial<QuickLinkCategory> & { id: string; name: string }): QuickLinkCategory {
  return {
    parent_id: null,
    icon: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<QuickLinkItem> & { id: string; category_id: string; title: string; url: string }): QuickLinkItem {
  return {
    description: null,
    icon: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildCategoryTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildCategoryTree([], [])).toEqual([]);
  });

  it('builds top-level categories with items', () => {
    const categories = [
      makeCategory({ id: 'c1', name: 'HR' }),
      makeCategory({ id: 'c2', name: 'IT' }),
    ];
    const items = [
      makeItem({ id: 'i1', category_id: 'c1', title: 'Handbook', url: 'https://example.com/handbook' }),
      makeItem({ id: 'i2', category_id: 'c2', title: 'VPN', url: 'https://example.com/vpn' }),
    ];

    const tree = buildCategoryTree(categories, items);
    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe('HR');
    expect(tree[0].items).toHaveLength(1);
    expect(tree[0].items[0].title).toBe('Handbook');
    expect(tree[1].name).toBe('IT');
    expect(tree[1].items).toHaveLength(1);
    expect(tree[1].items[0].title).toBe('VPN');
  });

  it('nests subcategories under parents', () => {
    const categories = [
      makeCategory({ id: 'c1', name: 'IT' }),
      makeCategory({ id: 'c2', name: 'Networking', parent_id: 'c1' }),
    ];
    const items = [
      makeItem({ id: 'i1', category_id: 'c2', title: 'VPN', url: 'https://example.com/vpn' }),
    ];

    const tree = buildCategoryTree(categories, items);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('IT');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].name).toBe('Networking');
    expect(tree[0].children[0].items).toHaveLength(1);
    expect(tree[0].children[0].items[0].title).toBe('VPN');
  });

  it('sorts categories and items by sort_order', () => {
    const categories = [
      makeCategory({ id: 'c1', name: 'Zulu', sort_order: 2 }),
      makeCategory({ id: 'c2', name: 'Alpha', sort_order: 1 }),
    ];
    const items = [
      makeItem({ id: 'i1', category_id: 'c2', title: 'Second', url: 'https://example.com/2', sort_order: 2 }),
      makeItem({ id: 'i2', category_id: 'c2', title: 'First', url: 'https://example.com/1', sort_order: 1 }),
    ];

    const tree = buildCategoryTree(categories, items);
    expect(tree[0].name).toBe('Alpha');
    expect(tree[1].name).toBe('Zulu');
    expect(tree[0].items[0].title).toBe('First');
    expect(tree[0].items[1].title).toBe('Second');
  });

  it('ignores items with unknown category_id', () => {
    const categories = [makeCategory({ id: 'c1', name: 'HR' })];
    const items = [
      makeItem({ id: 'i1', category_id: 'unknown', title: 'Orphan', url: 'https://example.com/orphan' }),
    ];

    const tree = buildCategoryTree(categories, items);
    expect(tree).toHaveLength(1);
    expect(tree[0].items).toHaveLength(0);
  });
});

describe('filterTree', () => {
  const categories = [
    makeCategory({ id: 'c1', name: 'HR' }),
    makeCategory({ id: 'c2', name: 'IT' }),
  ];
  const items = [
    makeItem({ id: 'i1', category_id: 'c1', title: 'Employee Handbook', url: 'https://example.com/handbook', description: 'Company policies' }),
    makeItem({ id: 'i2', category_id: 'c1', title: 'PTO Calendar', url: 'https://example.com/pto' }),
    makeItem({ id: 'i3', category_id: 'c2', title: 'VPN Setup', url: 'https://example.com/vpn', description: 'Network access guide' }),
  ];
  const tree = buildCategoryTree(categories, items);

  it('returns full tree for empty query', () => {
    expect(filterTree(tree, '')).toEqual(tree);
    expect(filterTree(tree, '   ')).toEqual(tree);
  });

  it('filters by item title', () => {
    const result = filterTree(tree, 'vpn');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('IT');
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].title).toBe('VPN Setup');
  });

  it('includes all items when category name matches', () => {
    const result = filterTree(tree, 'HR');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('HR');
    expect(result[0].items).toHaveLength(2);
  });

  it('filters by item description', () => {
    const result = filterTree(tree, 'policies');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('HR');
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].title).toBe('Employee Handbook');
  });

  it('removes categories with no matching items', () => {
    const result = filterTree(tree, 'xyznonexistent');
    expect(result).toHaveLength(0);
  });
});
