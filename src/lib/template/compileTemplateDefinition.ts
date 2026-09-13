import type {
  AppComponentInstanceDefinition,
  CollectionDefinition,
  PopupDefinition,
  ReusableComponentDefinition,
  ScreenDefinition,
  ScreenPageDefinition,
  TemplateDefinition,
  TemplateModuleDefinition,
  TemplateRouteDefinition,
  TemplateStartupDefinition,
  PageDefinition,
} from "./contracts";
import { TEMPLATE_DEFINITION_SCHEMA_VERSION } from "./contracts";
import {
  validateTemplateDefinition,
  type TemplateDefinitionIssue,
} from "./validateTemplateDefinition";

export interface CompilableTemplateRow {
  id: string;
  customer_id: string;
  template_name: string;
  edit_version: string | number;
}

export interface CompilableObjectRow {
  id: string;
  object_type: string;
  object_key: string;
  object_name: string;
  definition: Record<string, unknown>;
}

export interface CompilableScreenPageRow {
  screen_key: string;
  page_key: string;
  sort_order: number;
  is_default: boolean;
}

export interface CompileTemplateResult {
  definition: TemplateDefinition;
  issues: TemplateDefinitionIssue[];
}

const rowsOfType = (
  rows: CompilableObjectRow[],
  type: string,
) => rows.filter((row) => row.object_type === type);

const withIdentity = <T>(row: CompilableObjectRow): T => ({
  ...row.definition,
  id: row.object_key,
  name: row.object_name,
}) as T;

/** Stable JSON is used as the revision digest input. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "null" : serialized;
}

export function compileTemplateDefinition(
  template: CompilableTemplateRow,
  objects: CompilableObjectRow[],
  screenPages: CompilableScreenPageRow[],
  revisionId?: string,
): CompileTemplateResult {
  const compileIssues: TemplateDefinitionIssue[] = [];
  const startupRows = rowsOfType(objects, "STARTUP");
  if (startupRows.length !== 1) {
    compileIssues.push({
      code: "startup_object_count",
      path: "startup",
      message: "Exactly one STARTUP Object is required",
    });
  }
  const startup = startupRows[0]?.definition ?? {
    mainCss: "",
    browserActions: [],
  };

  const definition: TemplateDefinition = {
    schemaVersion: TEMPLATE_DEFINITION_SCHEMA_VERSION,
    template: {
      id: template.id,
      customerId: template.customer_id,
      name: template.template_name,
      status: revisionId ? "published" : "draft",
      editVersion: Number(template.edit_version),
      ...(revisionId ? { revision: revisionId } : {}),
    },
    startup: startup as unknown as TemplateStartupDefinition,
    modules: rowsOfType(objects, "MODULE").map((row) =>
      withIdentity<TemplateModuleDefinition>(row),
    ),
    routes: rowsOfType(objects, "ROUTE").map((row) =>
      withIdentity<TemplateRouteDefinition>(row),
    ),
    screens: rowsOfType(objects, "SCREEN").map((row) => {
      const screen = withIdentity<ScreenDefinition>(row);
      const defaultPage = screenPages.find(
        (entry) => entry.screen_key === row.object_key && entry.is_default,
      );
      return defaultPage
        ? { ...screen, defaultPageId: defaultPage.page_key }
        : screen;
    }),
    screenPages: screenPages.map<ScreenPageDefinition>((row) => ({
      screenId: row.screen_key,
      pageId: row.page_key,
      sortOrder: row.sort_order,
    })),
    pages: rowsOfType(objects, "PAGE").map((row) =>
      withIdentity<PageDefinition>(row),
    ),
    components: rowsOfType(objects, "COMPONENT").map((row) =>
      withIdentity<ReusableComponentDefinition>(row),
    ),
    componentInstances: rowsOfType(objects, "COMPONENT_INSTANCE").map((row) =>
      withIdentity<AppComponentInstanceDefinition>(row),
    ),
    collections: rowsOfType(objects, "COLLECTION").map((row) =>
      withIdentity<CollectionDefinition>(row),
    ),
    popups: rowsOfType(objects, "POPUP").map((row) =>
      withIdentity<PopupDefinition>(row),
    ),
  };

  const validation = validateTemplateDefinition(definition);
  return {
    definition,
    issues: [...compileIssues, ...validation.issues],
  };
}
