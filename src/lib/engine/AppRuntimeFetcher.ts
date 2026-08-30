import {
  AppConfig,
  AppRoute,
  ComponentNode,
  PageLayout,
  PageStyleSheet,
  StudioServiceDefinition,
  WorkflowTree,
} from "@/types";

export interface AppRuntimeData {
  appConfig: AppConfig & { inheritedFrom?: string };
  pageLayout: PageLayout;
  workflowTree?: WorkflowTree;
  forms?: Array<{ id: string; componentTree: ComponentNode[] }>;
  collections?: Array<{
    id: string;
    name?: string;
    standardFlows?: Record<string, any>;
    components: Array<{
      id: string;
      type: string;
      componentTree: ComponentNode[];
    }>;
  }>;
  routes?: AppRoute[];
  /*
   * `componentTree` is present only for pages the client can swap in without a
   * request — those a route or a service points at. Every other page is reached
   * by an ordinary link and rendered by the server, so its tree is not sent.
   */
  pages?: Array<{
    id: string;
    title?: string;
    componentTree?: ComponentNode[];
    styleSheet?: PageStyleSheet;
    layoutRegions?: Record<string, boolean>;
  }>;
  services?: StudioServiceDefinition[];
  flows?: Array<{
    routePath: string;
    nodes: Array<{ id: string; data?: Record<string, any> }>;
    edges: Array<Record<string, any>>;
  }>;
}

export class RuntimeUnavailableError extends Error {
  constructor(
    readonly appSlug: string,
    message: string,
  ) {
    super(message);
    this.name = "RuntimeUnavailableError";
  }
}

/**
 * Loads the published runtime payload for a site.
 *
 * There is deliberately no fabricated fallback: a site that has not been
 * published should say so, rather than silently rendering demo content that
 * looks real.
 */
export async function fetchAppRuntimeData(
  appSlug: string,
): Promise<AppRuntimeData> {
  const response = await fetch(`/api/runtime/${encodeURIComponent(appSlug)}`, {
    cache: "no-store",
  });

  if (response.ok) return (await response.json()) as AppRuntimeData;

  if (response.status === 404) {
    throw new RuntimeUnavailableError(
      appSlug,
      `ยังไม่มี Runtime ที่เผยแพร่สำหรับ '${appSlug}' — กรุณา Publish จาก Studio ก่อน`,
    );
  }

  const payload = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  throw new RuntimeUnavailableError(
    appSlug,
    payload.error || "ไม่สามารถโหลด Runtime ได้",
  );
}
