import type { SlideMenuItem } from '@/components/shared/SlideMenuComponent';
import { ADMIN_SIDEBAR_ITEMS } from '@/lib/studio/adminMenuTemplate';
import {
  ALL_BACKEND_COLLECTION_SEEDS,
  ALL_BACKEND_FORM_SEEDS,
  type StudioCollectionDefinition,
  type StudioFormDefinition,
} from '@/lib/studio/backendFormDefinitions';

export interface BackendDefinitionIssue {
  scope: 'collection' | 'form' | 'menu';
  id: string;
  message: string;
}

const duplicates = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) !== index);

export function validateBackendDefinitions(
  collections: StudioCollectionDefinition[] = ALL_BACKEND_COLLECTION_SEEDS,
  forms: StudioFormDefinition[] = ALL_BACKEND_FORM_SEEDS,
  menuItems: SlideMenuItem[] = ADMIN_SIDEBAR_ITEMS,
): BackendDefinitionIssue[] {
  const issues: BackendDefinitionIssue[] = [];
  const collectionById = new Map(collections.map((item) => [item.id, item]));
  const formById = new Map(forms.map((item) => [item.id, item]));

  for (const id of duplicates(collections.map((item) => item.id))) issues.push({ scope: 'collection', id, message: 'Duplicate collection id' });
  for (const id of duplicates(forms.map((item) => item.id))) issues.push({ scope: 'form', id, message: 'Duplicate form id' });

  for (const collection of collections) {
    const flowFormIds = new Set([collection.standardFlows.create.formId, collection.standardFlows.edit.formId]);
    for (const formId of flowFormIds) {
      if (!formById.has(formId)) issues.push({ scope: 'collection', id: collection.id, message: `Standard flow references missing form '${formId}'` });
    }
    for (const relation of collection.relations || []) {
      if (!collectionById.has(relation.collectionId)) issues.push({ scope: 'collection', id: collection.id, message: `Relation references missing collection '${relation.collectionId}'` });
    }
    if (!collection.components.some((component) => component.id === collection.standardFlows.view.componentId)) {
      issues.push({ scope: 'collection', id: collection.id, message: `View flow references missing component '${collection.standardFlows.view.componentId}'` });
    }
  }

  for (const form of forms) {
    if (form.id !== 'administrator.sms.form' && !collectionById.has(form.collectionId)) {
      issues.push({ scope: 'form', id: form.id, message: `References missing collection '${form.collectionId}'` });
    }
  }

  const inspectMenu = (items: SlideMenuItem[]) => {
    for (const item of items) {
      if (item.children?.length) inspectMenu(item.children);
      const resource = item.resource;
      if (!resource) continue;
      if (resource.collectionId) {
        const collection = collectionById.get(resource.collectionId);
        if (!collection) issues.push({ scope: 'menu', id: item.id, message: `References missing collection '${resource.collectionId}'` });
        else if (resource.componentId && !collection.components.some((component) => component.id === resource.componentId)) {
          issues.push({ scope: 'menu', id: item.id, message: `References missing component '${resource.componentId}'` });
        }
      }
      if (resource.formId && !formById.has(resource.formId)) issues.push({ scope: 'menu', id: item.id, message: `References missing form '${resource.formId}'` });
      if (resource.kind === 'form' && !resource.formId) issues.push({ scope: 'menu', id: item.id, message: 'Form menu has no formId' });
    }
  };
  inspectMenu(menuItems);

  return issues;
}

export const BACKEND_DEFINITION_ISSUES = validateBackendDefinitions();

