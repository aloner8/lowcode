import {
  SCREEN_REGION_KEYS,
  TEMPLATE_DEFINITION_SCHEMA_VERSION,
  type TemplateDefinition,
} from "../contracts";

export const MINIMAL_TEMPLATE_DEFINITION = {
  schemaVersion: TEMPLATE_DEFINITION_SCHEMA_VERSION,
  template: {
    id: "template.contacts",
    customerId: "customer.demo",
    name: "Contacts",
    status: "draft",
    editVersion: 1,
  },
  startup: {
    connectionProfileRef: "connection.app-primary",
    mainCss: ":root { --app-primary: #0c58a9; }",
    browserActions: [],
  },
  modules: [],
  routes: [
    {
      id: "route.home",
      path: "/",
      screenId: "screen.main",
      isDefault: true,
    },
  ],
  screens: [
    {
      id: "screen.main",
      name: "Main screen",
      defaultPageId: "page.contacts",
      regions: SCREEN_REGION_KEYS.map((key) => ({
        key,
        componentInstanceIds: [],
      })),
      menu: [
        {
          id: "menu.contacts",
          label: "Contacts",
          action: { type: "change_page", pageId: "page.contacts" },
        },
      ],
      popupIds: [],
      eventSteps: [],
      css: "",
    },
  ],
  screenPages: [
    { screenId: "screen.main", pageId: "page.contacts", sortOrder: 0 },
  ],
  pages: [
    {
      id: "page.contacts",
      name: "Contacts",
      panels: [
        {
          id: "panel.content",
          name: "Content",
          order: 0,
          responsive: { desktop: 12, tablet: 12, mobile: 12 },
        },
      ],
      collections: [
        { collectionId: "collection.contacts", loadOrder: 0, alias: "contacts" },
      ],
      css: "",
    },
  ],
  components: [],
  componentInstances: [
    {
      id: "instance.contacts-table",
      placement: "page_panel",
      pageId: "page.contacts",
      panelId: "panel.content",
      loadOrder: 0,
      source: "standard",
      standardType: "DataTableComponent",
      props: { title: "Contacts" },
      bindings: { rows: "contacts.rows" },
    },
  ],
  collections: [
    {
      id: "collection.contacts",
      name: "Contacts",
      tableName: "contacts",
      access: { publicRead: true, publicCreate: true, publicUpdate: true },
      fields: [
        {
          id: "id",
          name: "ID",
          type: "integer",
          required: true,
          primaryKey: true,
        },
        { id: "name", name: "Name", type: "string", required: true },
      ],
    },
  ],
  popups: [],
} satisfies TemplateDefinition;
