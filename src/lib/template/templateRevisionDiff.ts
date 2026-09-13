import type { TemplateDefinition } from "./contracts";
import { stableStringify } from "./compileTemplateDefinition";

export type TemplateRevisionChangeKind = "added" | "removed" | "changed";

export interface TemplateRevisionChange {
  kind: TemplateRevisionChangeKind;
  objectType: string;
  objectKey: string;
}

export interface TemplateRevisionDiff {
  added: number;
  removed: number;
  changed: number;
  changes: TemplateRevisionChange[];
}

interface ComparableEntry {
  objectType: string;
  objectKey: string;
  value: unknown;
}

const keyedEntries = (
  objectType: string,
  items: Array<{ id: string }>,
): ComparableEntry[] => items.map((item) => ({
  objectType,
  objectKey: item.id,
  value: item,
}));

const comparableEntries = (definition: TemplateDefinition): ComparableEntry[] => [
  {
    objectType: "TEMPLATE",
    objectKey: definition.template.id,
    value: {
      schemaVersion: definition.schemaVersion,
      id: definition.template.id,
      customerId: definition.template.customerId,
      name: definition.template.name,
    },
  },
  { objectType: "STARTUP", objectKey: "startup", value: definition.startup },
  ...keyedEntries("MODULE", definition.modules),
  ...keyedEntries("ROUTE", definition.routes),
  ...keyedEntries("SCREEN", definition.screens),
  ...definition.screenPages.map((item) => ({
    objectType: "SCREEN_PAGE",
    objectKey: `${item.screenId}:${item.pageId}`,
    value: item,
  })),
  ...keyedEntries("PAGE", definition.pages),
  ...keyedEntries("COMPONENT", definition.components),
  ...keyedEntries("COMPONENT_INSTANCE", definition.componentInstances),
  ...keyedEntries("COLLECTION", definition.collections),
  ...keyedEntries("POPUP", definition.popups),
];

const entryId = (entry: Pick<ComparableEntry, "objectType" | "objectKey">) =>
  `${entry.objectType}:${entry.objectKey}`;

/**
 * Produces a stable, credential-free structural diff for the publish review UI.
 * Published-only identity fields (status/revision) are intentionally excluded.
 */
export function diffTemplateRevisions(
  published: TemplateDefinition | null,
  draft: TemplateDefinition,
): TemplateRevisionDiff {
  const before = new Map(
    (published ? comparableEntries(published) : []).map((entry) => [entryId(entry), entry]),
  );
  const after = new Map(comparableEntries(draft).map((entry) => [entryId(entry), entry]));
  const changes: TemplateRevisionChange[] = [];

  for (const [id, entry] of after) {
    const previous = before.get(id);
    if (!previous) {
      changes.push({ kind: "added", objectType: entry.objectType, objectKey: entry.objectKey });
    } else if (stableStringify(previous.value) !== stableStringify(entry.value)) {
      changes.push({ kind: "changed", objectType: entry.objectType, objectKey: entry.objectKey });
    }
  }
  for (const [id, entry] of before) {
    if (!after.has(id)) {
      changes.push({ kind: "removed", objectType: entry.objectType, objectKey: entry.objectKey });
    }
  }

  changes.sort((left, right) =>
    `${left.objectType}:${left.objectKey}:${left.kind}`.localeCompare(
      `${right.objectType}:${right.objectKey}:${right.kind}`,
    ));
  return {
    added: changes.filter((item) => item.kind === "added").length,
    removed: changes.filter((item) => item.kind === "removed").length,
    changed: changes.filter((item) => item.kind === "changed").length,
    changes,
  };
}
