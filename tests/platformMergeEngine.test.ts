import { describe, expect, it } from 'vitest';
import { mergePlatformMasterWithTenantOverrides } from '@/lib/engine/PlatformMergeEngine';
import type { ComponentNode } from '@/types';

const master: ComponentNode[] = [
  { id: 'nav', type: 'NavMenuComponent', props: { brandName: 'Master' } },
  {
    id: 'body',
    type: 'CardComponent',
    props: { title: 'Card' },
    children: [
      { id: 'chart', type: 'ChartComponent', props: { title: 'Chart' } },
      { id: 'table', type: 'TableDataComponent', props: { title: 'Table' } },
    ],
  },
];

describe('mergePlatformMasterWithTenantOverrides', () => {
  it('returns the master tree unchanged when no overrides exist', () => {
    expect(mergePlatformMasterWithTenantOverrides(master)).toEqual(master);
  });

  it('removes components disabled by id', () => {
    const result = mergePlatformMasterWithTenantOverrides(master, { disabledFeatures: ['nav'] });
    expect(result.map((node) => node.id)).toEqual(['body']);
  });

  it('removes components disabled by type, including nested ones', () => {
    const result = mergePlatformMasterWithTenantOverrides(master, { disabledFeatures: ['ChartComponent'] });
    expect(result[1].children?.map((node) => node.id)).toEqual(['table']);
  });

  it('applies prop overrides without dropping untouched props', () => {
    const result = mergePlatformMasterWithTenantOverrides(master, {
      componentPropsOverrides: { nav: { props: { brandName: 'Tenant' } } },
    });
    expect(result[0].props.brandName).toBe('Tenant');
  });

  it('merges style overrides', () => {
    const result = mergePlatformMasterWithTenantOverrides(master, {
      componentPropsOverrides: { nav: { style: { color: 'red' } } },
    });
    expect(result[0].style).toEqual({ color: 'red' });
  });

  it('does not mutate the master tree', () => {
    const snapshot = JSON.parse(JSON.stringify(master));
    mergePlatformMasterWithTenantOverrides(master, {
      disabledFeatures: ['chart'],
      componentPropsOverrides: { nav: { props: { brandName: 'Tenant' } } },
    });
    expect(master).toEqual(snapshot);
  });
});
