import type { AppRoute } from '@/types';

export interface RouteCollectionSource { id: string; moduleId: string; name: string; table: string; }

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection';

export function generateRoutesFromCollections(input: { platformId: string; containerName: string; collections: RouteCollectionSource[] }): AppRoute[] {
  const usedPaths = new Set<string>();
  return input.collections.map((collection) => {
    const base = `/${slugify(collection.moduleId)}/${slugify(collection.table || collection.id)}`;
    let path = base; let suffix = 2;
    while (usedPaths.has(path)) path = `${base}-${suffix++}`;
    usedPaths.add(path);
    return { id: `route.collection.${collection.id}`, platformId: input.platformId, containerName: input.containerName, path, label: collection.name, targetType: 'collection', targetId: collection.id, isPublic: false, metadata: { generatedBy: 'generateRoutesFromCollections', collectionTable: collection.table } };
  });
}
