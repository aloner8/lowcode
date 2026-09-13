import {
  SCREEN_REGION_KEYS,
  TEMPLATE_DEFINITION_SCHEMA_VERSION,
  type TemplateDefinition,
} from "./contracts";

export interface TemplateDefinitionIssue {
  code: string;
  path: string;
  message: string;
}

export interface TemplateDefinitionValidationResult {
  valid: boolean;
  issues: TemplateDefinitionIssue[];
}

const duplicateValues = (values: string[]) =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

const DATABASE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

export function validateTemplateDefinition(
  definition: TemplateDefinition,
): TemplateDefinitionValidationResult {
  try {
    return validateTypedTemplateDefinition(definition);
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          code: "invalid_definition_shape",
          path: "definition",
          message: error instanceof Error ? error.message : "Template definition shape is invalid",
        },
      ],
    };
  }
}

function validateTypedTemplateDefinition(
  definition: TemplateDefinition,
): TemplateDefinitionValidationResult {
  const issues: TemplateDefinitionIssue[] = [];
  const issue = (code: string, path: string, message: string) => {
    issues.push({ code, path, message });
  };

  if (definition.schemaVersion !== TEMPLATE_DEFINITION_SCHEMA_VERSION) {
    issue(
      "unsupported_schema_version",
      "schemaVersion",
      `Expected ${TEMPLATE_DEFINITION_SCHEMA_VERSION}`,
    );
  }

  if (typeof definition.startup.mainCss !== "string") {
    issue("invalid_startup_css", "startup.mainCss", "mainCss must be a string");
  }
  if (!Array.isArray(definition.startup.browserActions)) {
    issue(
      "invalid_startup_actions",
      "startup.browserActions",
      "browserActions must be an array",
    );
  }

  if (!definition.template.customerId.trim()) {
    issue("customer_required", "template.customerId", "Customer ownership is required");
  }
  if (!Number.isInteger(definition.template.editVersion) || definition.template.editVersion < 1) {
    issue("invalid_edit_version", "template.editVersion", "editVersion must be a positive integer");
  }
  if (definition.template.status === "published" && !definition.template.revision?.trim()) {
    issue("revision_required", "template.revision", "Published definitions require an immutable revision");
  }
  if (definition.template.status === "draft" && definition.template.revision) {
    issue("draft_has_revision", "template.revision", "Draft definitions cannot claim a published revision");
  }

  const collections = new Map(definition.collections.map((item) => [item.id, item]));
  const components = new Map(definition.components.map((item) => [item.id, item]));
  const instances = new Map(definition.componentInstances.map((item) => [item.id, item]));
  const pages = new Map(definition.pages.map((item) => [item.id, item]));
  const popups = new Map(definition.popups.map((item) => [item.id, item]));
  const routes = new Map(definition.routes.map((item) => [item.id, item]));
  const screens = new Map(definition.screens.map((item) => [item.id, item]));

  const registries: Array<[string, string[]]> = [
    ["modules", definition.modules.map((item) => item.id)],
    ["routes", definition.routes.map((item) => item.id)],
    ["screens", definition.screens.map((item) => item.id)],
    ["pages", definition.pages.map((item) => item.id)],
    ["components", definition.components.map((item) => item.id)],
    ["componentInstances", definition.componentInstances.map((item) => item.id)],
    ["collections", definition.collections.map((item) => item.id)],
    ["popups", definition.popups.map((item) => item.id)],
  ];
  for (const [path, ids] of registries) {
    for (const id of duplicateValues(ids)) {
      issue("duplicate_id", path, `Duplicate id '${id}'`);
    }
  }

  for (const tableName of duplicateValues(
    definition.collections.map((collection) => collection.tableName),
  )) {
    issue("duplicate_table_name", "collections", `Duplicate table name '${tableName}'`);
  }

  if (definition.routes.filter((route) => route.isDefault).length !== 1) {
    issue("default_route_count", "routes", "Exactly one default route is required");
  }

  const screenPageKeys = new Set<string>();
  definition.screenPages.forEach((entry, index) => {
    const path = `screenPages[${index}]`;
    if (!screens.has(entry.screenId)) {
      issue("missing_screen", `${path}.screenId`, `Unknown screen '${entry.screenId}'`);
    }
    if (!pages.has(entry.pageId)) {
      issue("missing_page", `${path}.pageId`, `Unknown page '${entry.pageId}'`);
    }
    const key = `${entry.screenId}:${entry.pageId}`;
    if (screenPageKeys.has(key)) {
      issue("duplicate_screen_page", path, `Duplicate screen/page relationship '${key}'`);
    }
    screenPageKeys.add(key);
  });

  definition.routes.forEach((route, index) => {
    if (!screens.has(route.screenId)) {
      issue("missing_screen", `routes[${index}].screenId`, `Unknown screen '${route.screenId}'`);
    }
  });

  definition.screens.forEach((screen, index) => {
    const path = `screens[${index}]`;
    if (!screenPageKeys.has(`${screen.id}:${screen.defaultPageId}`)) {
      issue(
        "default_page_not_in_screen",
        `${path}.defaultPageId`,
        `Default page '${screen.defaultPageId}' is not assigned to screen '${screen.id}'`,
      );
    }

    const regionKeys = screen.regions.map((region) => region.key);
    for (const key of SCREEN_REGION_KEYS) {
      if (!regionKeys.includes(key)) {
        issue("missing_screen_region", `${path}.regions`, `Missing '${key}' region`);
      }
    }
    for (const key of duplicateValues(regionKeys)) {
      issue("duplicate_screen_region", `${path}.regions`, `Duplicate '${key}' region`);
    }
    screen.regions.forEach((region, regionIndex) => {
      region.componentInstanceIds.forEach((instanceId) => {
        const instance = instances.get(instanceId);
        if (!instance) {
          issue(
            "missing_component_instance",
            `${path}.regions[${regionIndex}]`,
            `Unknown component instance '${instanceId}'`,
          );
        } else if (
          instance.placement !== "screen_region" ||
          instance.screenId !== screen.id ||
          instance.region !== region.key
        ) {
          issue(
            "invalid_screen_component_placement",
            `${path}.regions[${regionIndex}]`,
            `Component instance '${instanceId}' is not placed in this Screen region`,
          );
        }
      });
    });
    screen.popupIds.forEach((popupId) => {
      if (!popups.has(popupId)) {
        issue("missing_popup", `${path}.popupIds`, `Unknown popup '${popupId}'`);
      }
    });
    screen.menu.forEach((item, menuIndex) => {
      const menuPath = `${path}.menu[${menuIndex}].action`;
      if (item.action.type === "change_page" && !screenPageKeys.has(`${screen.id}:${item.action.pageId}`)) {
        issue("menu_page_not_in_screen", menuPath, `Page '${item.action.pageId}' is not assigned to this screen`);
      }
      if (item.action.type === "navigate_route" && !routes.has(item.action.routeId)) {
        issue("missing_route", menuPath, `Unknown route '${item.action.routeId}'`);
      }
      if (item.action.type === "open_popup" && !popups.has(item.action.popupId)) {
        issue("missing_popup", menuPath, `Unknown popup '${item.action.popupId}'`);
      } else if (item.action.type === "open_popup" && !screen.popupIds.includes(item.action.popupId)) {
        issue(
          "popup_not_in_screen",
          menuPath,
          `Popup '${item.action.popupId}' is not assigned to this screen`,
        );
      }
    });
  });

  definition.pages.forEach((page, pageIndex) => {
    const path = `pages[${pageIndex}]`;
    const panelIds = page.panels.map((panel) => panel.id);
    for (const id of duplicateValues(panelIds)) {
      issue("duplicate_panel", `${path}.panels`, `Duplicate panel '${id}'`);
    }
    const aliases = page.collections.map((collection) => collection.alias);
    for (const alias of duplicateValues(aliases)) {
      issue("duplicate_collection_alias", `${path}.collections`, `Duplicate alias '${alias}'`);
    }
    page.collections.forEach((load, loadIndex) => {
      if (!collections.has(load.collectionId)) {
        issue(
          "missing_collection",
          `${path}.collections[${loadIndex}].collectionId`,
          `Unknown collection '${load.collectionId}'`,
        );
      }
    });
  });

  definition.componentInstances.forEach((instance, index) => {
    const path = `componentInstances[${index}]`;
    const bindingPages = instance.placement === "page_panel"
      ? definition.pages.filter((page) => page.id === instance.pageId)
      : definition.screenPages
          .filter((entry) => entry.screenId === instance.screenId)
          .map((entry) => pages.get(entry.pageId))
          .filter((page): page is NonNullable<typeof page> => Boolean(page));
    const bindingCollections = new Map<string, Array<(typeof definition.collections)[number]>>();
    bindingPages.forEach((page) => {
      page.collections.forEach((load) => {
        const collection = collections.get(load.collectionId);
        if (!collection) return;
        bindingCollections.set(load.alias, [...(bindingCollections.get(load.alias) ?? []), collection]);
      });
    });
    if (instance.placement === "page_panel") {
      const page = pages.get(instance.pageId);
      if (!page) {
        issue("missing_page", `${path}.pageId`, `Unknown page '${instance.pageId}'`);
      } else if (!page.panels.some((panel) => panel.id === instance.panelId)) {
        issue("missing_panel", `${path}.panelId`, `Unknown panel '${instance.panelId}' on page '${page.id}'`);
      }
    } else {
      const screen = screens.get(instance.screenId);
      if (!screen) {
        issue("missing_screen", `${path}.screenId`, `Unknown screen '${instance.screenId}'`);
      } else if (!screen.regions.some((region) => region.key === instance.region)) {
        issue("missing_screen_region", `${path}.region`, `Unknown region '${instance.region}' on screen '${screen.id}'`);
      }
    }
    if (instance.source === "reusable" && !components.has(instance.componentId)) {
      issue("missing_component", `${path}.componentId`, `Unknown component '${instance.componentId}'`);
    }
    Object.entries(instance.bindings).forEach(([property, bindingPath]) => {
      const parts = bindingPath.split(".").map((part) => part.trim()).filter(Boolean);
      const candidates = bindingCollections.get(parts[0] ?? "") ?? [];
      if (!parts.length || !candidates.length) {
        issue(
          "missing_binding_alias",
          `${path}.bindings.${property}`,
          `Unknown Collection alias '${parts[0] ?? ""}' for this Component placement`,
        );
        return;
      }
      const fieldId = parts[1] === "rows" ? parts[2] : parts[1];
      if (
        fieldId &&
        !candidates.some((collection) => collection.fields.some((field) => field.id === fieldId))
      ) {
        issue(
          "missing_binding_field",
          `${path}.bindings.${property}`,
          `Unknown field '${fieldId}' on Collection alias '${parts[0]}'`,
        );
      }
    });
  });

  definition.collections.forEach((collection, collectionIndex) => {
    const collectionPath = `collections[${collectionIndex}]`;
    if (!DATABASE_IDENTIFIER.test(collection.tableName)) {
      issue(
        "invalid_table_name",
        `${collectionPath}.tableName`,
        `Unsafe database table name '${collection.tableName}'`,
      );
    }
    if (!collection.fields.length) {
      issue("collection_fields_required", `${collectionPath}.fields`, "At least one field is required");
    }
    if (!collection.fields.some((field) => field.primaryKey)) {
      issue("collection_primary_key_required", `${collectionPath}.fields`, "A primary key is required");
    }
    if (collection.access) {
      for (const key of ["publicRead", "publicCreate"] as const) {
        if (typeof collection.access[key] !== "boolean") {
          issue("invalid_collection_access", `${collectionPath}.access.${key}`, `${key} must be boolean`);
        }
      }
      if (
        collection.access.publicUpdate !== undefined &&
        typeof collection.access.publicUpdate !== "boolean"
      ) {
        issue(
          "invalid_collection_access",
          `${collectionPath}.access.publicUpdate`,
          "publicUpdate must be boolean",
        );
      }
    }
    const fieldIds = collection.fields.map((field) => field.id);
    for (const id of duplicateValues(fieldIds)) {
      issue("duplicate_field", `collections[${collectionIndex}].fields`, `Duplicate field '${id}'`);
    }
    collection.fields.forEach((field, fieldIndex) => {
      if (!DATABASE_IDENTIFIER.test(field.id)) {
        issue(
          "invalid_field_name",
          `${collectionPath}.fields[${fieldIndex}].id`,
          `Unsafe database field name '${field.id}'`,
        );
      }
      if (!field.references) return;
      const target = collections.get(field.references.collectionId);
      const path = `collections[${collectionIndex}].fields[${fieldIndex}].references`;
      if (!target) {
        issue("missing_collection", path, `Unknown collection '${field.references.collectionId}'`);
      } else if (!target.fields.some((candidate) => candidate.id === field.references?.fieldId)) {
        issue("missing_collection_field", path, `Unknown field '${field.references.fieldId}'`);
      }
    });
  });

  definition.popups.forEach((popup, index) => {
    if (!pages.has(popup.pageId)) {
      issue("missing_page", `popups[${index}].pageId`, `Unknown page '${popup.pageId}'`);
    }
  });

  return { valid: issues.length === 0, issues };
}
