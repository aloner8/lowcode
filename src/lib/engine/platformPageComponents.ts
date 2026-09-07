import "server-only";
import { getCoreDb } from "@/lib/db/coreDb";
import type { ComponentNode } from "@/types";
import type { PoolClient } from "pg";

interface InstanceRow {
  page_slug: string;
  instance_key: string;
  instance_name: string;
  layout_region: string;
  platform_component_id: string;
  component_key: string;
  component_name: string;
  component_type: string;
  definition: Record<string, unknown>;
  version: number;
  props_overrides: Record<string, unknown>;
  request_bindings: Record<string, unknown>;
  response_bindings: Record<string, unknown>;
}

export interface HydratablePage {
  id: string;
  componentTree?: ComponentNode[];
  [key: string]: unknown;
}

export const stripHydratedPageComponentNodes = (nodes: ComponentNode[]) =>
  nodes.filter(
    (node) =>
      !node.props ||
      typeof node.props.__pageComponentInstanceId !== "string",
  );

export interface HydratedPageComponentUpdate {
  instanceKey: string;
  instanceName?: string;
  layoutRegion: string;
  propsOverrides: Record<string, unknown>;
  requestBindings: Record<string, unknown>;
  responseBindings: Record<string, unknown>;
}

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * Hydrated reusable components do not live in platform_pages.component_tree.
 * Convert their edited canvas representation back into instance overrides so
 * Page Designer saves are not silently discarded when the page is hydrated
 * again.
 */
export const getHydratedPageComponentUpdates = (
  nodes: ComponentNode[],
): HydratedPageComponentUpdate[] =>
  nodes.flatMap((node) => {
    const instanceKey = node.props?.__pageComponentInstanceId;
    if (typeof instanceKey !== "string" || !instanceKey) return [];

    const propsOverrides = Object.fromEntries(
      Object.entries(node.props || {}).filter(([key]) => !key.startsWith("__")),
    );
    propsOverrides.actionTriggerId = node.actionTriggerId ?? null;
    const requestBindings = objectValue(propsOverrides.requestBindings);
    const responseBindings = objectValue(propsOverrides.responseBindings);
    delete propsOverrides.requestBindings;
    delete propsOverrides.responseBindings;

    return [
      {
        instanceKey,
        instanceName: node.label,
        layoutRegion:
          typeof node.props.__layoutRegion === "string"
            ? node.props.__layoutRegion
            : typeof node.props.__sectionId === "string"
              ? node.props.__sectionId
              : "content",
        propsOverrides,
        requestBindings,
        responseBindings,
      },
    ];
  });

export async function syncHydratedPageComponentNodes(
  client: Pick<PoolClient, "query">,
  platformId: string,
  pageSlug: string,
  nodes: ComponentNode[],
) {
  for (const update of getHydratedPageComponentUpdates(nodes)) {
    await client.query(
      `UPDATE public.platform_pages_components ppc
       SET instance_name=COALESCE($4,ppc.instance_name),
           layout_region=$5,
           props_overrides=$6::jsonb,
           request_bindings=$7::jsonb,
           response_bindings=$8::jsonb,
           updated_at=NOW()
       FROM public.platform_pages pp
       WHERE ppc.platform_page_id=pp.id
         AND pp.platform_id=$1 AND pp.page_slug=$2
         AND ppc.instance_key=$3`,
      [
        platformId,
        pageSlug,
        update.instanceKey,
        update.instanceName || null,
        update.layoutRegion,
        JSON.stringify(update.propsOverrides),
        JSON.stringify(update.requestBindings),
        JSON.stringify(update.responseBindings),
      ],
    );
  }
}

export async function hydratePlatformPageComponents<T extends HydratablePage>(
  platformId: string,
  pages: T[],
): Promise<T[]> {
  if (!pages.length) return pages;
  const result = await getCoreDb().query<InstanceRow>(
    `SELECT pp.page_slug, ppc.instance_key, ppc.instance_name,
            ppc.layout_region, ppc.platform_component_id,
            pc.component_key, pc.component_name, pc.component_type,
            pc.definition, pc.version, ppc.props_overrides,
            ppc.request_bindings, ppc.response_bindings
     FROM public.platform_pages_components ppc
     JOIN public.platform_pages pp ON pp.id=ppc.platform_page_id
     JOIN public.platform_components pc ON pc.id=ppc.platform_component_id
     WHERE pp.platform_id=$1
     ORDER BY pp.page_slug, ppc.sort_order, ppc.created_at`,
    [platformId],
  );
  const byPage = new Map<string, InstanceRow[]>();
  result.rows.forEach((row) => {
    const rows = byPage.get(row.page_slug) || [];
    rows.push(row);
    byPage.set(row.page_slug, rows);
  });
  return pages.map((page) => {
    const instances = byPage.get(page.id) || [];
    if (!instances.length) return page;
    const instanceNodes: ComponentNode[] = instances.map((instance) => {
      const hasActionTriggerOverride = Object.prototype.hasOwnProperty.call(
        instance.props_overrides,
        "actionTriggerId",
      );
      const configuredActionTriggerId = hasActionTriggerOverride
        ? instance.props_overrides.actionTriggerId
        : instance.definition.actionTriggerId;
      const actionTriggerId =
        typeof configuredActionTriggerId === "string" &&
        configuredActionTriggerId.trim()
          ? configuredActionTriggerId
          : !hasActionTriggerOverride &&
              instance.definition.actionTriggerId === undefined &&
              instance.instance_key === "auth.login.form"
            ? "auth.login.submit"
            : undefined;
      const hydratedProps = {
        ...instance.definition,
        ...instance.props_overrides,
      };
      delete hydratedProps.actionTriggerId;
      const collectionSet = Array.isArray(instance.definition.collectionSet)
        ? (instance.definition.collectionSet as Array<{
            collectionId?: string;
            role?: string;
          }>)
        : [];
      const primaryCollection = collectionSet.find(
        (item) => item.role === "primary",
      )?.collectionId;
      return {
        id: instance.instance_key,
        type: instance.component_type as ComponentNode["type"],
        label: instance.instance_name || instance.component_name,
        templateRef: `component://private/${instance.platform_component_id}`,
        actionTriggerId,
        props: {
          ...hydratedProps,
          formId: instance.component_key,
          collectionId: primaryCollection,
          __layoutRegion: instance.layout_region,
          __sectionId: instance.layout_region,
          __platformComponentId: instance.platform_component_id,
          __platformComponentVersion: instance.version,
          __pageComponentInstanceId: instance.instance_key,
          requestBindings: instance.request_bindings,
          responseBindings: instance.response_bindings,
        },
      };
    });
    const ids = new Set(instanceNodes.map((node) => node.id));
    return {
      ...page,
      componentTree: [
        ...(page.componentTree || []).filter((node) => !ids.has(node.id)),
        ...instanceNodes,
      ],
    };
  });
}
