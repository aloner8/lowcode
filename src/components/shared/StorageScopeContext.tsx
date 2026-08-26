'use client';

import React, { createContext, useContext, useMemo } from 'react';

/**
 * Which tenant the File Manager reads and writes for.
 *
 * Uploads are tenant data, so every call must name a scope: a Platform Master
 * while designing in Studio, or a Site while running it. Components deep in the
 * tree (form fields, the rich-text editor) read the scope from here instead of
 * threading it through every prop.
 */
export interface StorageScope {
  appId?: string;
  platformId?: string;
}

const StorageScopeContext = createContext<StorageScope>({});

export function StorageScopeProvider({
  scope,
  children,
}: {
  readonly scope: StorageScope;
  readonly children: React.ReactNode;
}) {
  const value = useMemo(() => scope, [scope.appId, scope.platformId]);
  return <StorageScopeContext.Provider value={value}>{children}</StorageScopeContext.Provider>;
}

export const useStorageScope = () => useContext(StorageScopeContext);

/** Query string identifying the scope, appended to every File Manager request. */
export function storageScopeQuery(scope: StorageScope): string {
  if (scope.appId) return `appId=${encodeURIComponent(scope.appId)}`;
  if (scope.platformId) return `platformId=${encodeURIComponent(scope.platformId)}`;
  return '';
}
