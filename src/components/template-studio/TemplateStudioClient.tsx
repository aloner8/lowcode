"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  Braces,
  Database,
  Eye,
  FileText,
  Layers3,
  Map,
  Monitor,
  Play,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { SCREEN_REGION_KEYS } from "@/lib/template/contracts";
import { COMPONENT_PALETTE } from "@/lib/engine/ComponentRegistry";
import { createDefaultModuleConfig } from "@/lib/modules/moduleSettings";
import { TemplatePropertyEditor } from "@/components/template-studio/TemplatePropertyEditor";
import { TemplateRuntimePreview } from "@/components/template-studio/TemplateRuntimePreview";
import {
  moveItem,
  orderComponents,
  placementOf,
  type StudioPageRelation,
} from "@/lib/template/studioEditing";

type ObjectType =
  | "STARTUP"
  | "MODULE"
  | "ROUTE"
  | "SCREEN"
  | "PAGE"
  | "COMPONENT"
  | "COMPONENT_INSTANCE"
  | "COLLECTION"
  | "POPUP";

interface TemplateSummary {
  id: string;
  templateName: string;
  templateSlug: string;
  isPublic: boolean;
  editVersion: number;
  publishedRevisionId: string | null;
}

interface StudioObject {
  id: string;
  objectType: ObjectType;
  objectKey: string;
  objectName: string;
  editVersion: number;
  definition: Record<string, unknown>;
}

interface ScreenPageRelation {
  id: string;
  screenObjectId: string;
  screenKey: string;
  pageObjectId: string;
  pageKey: string;
  sortOrder: number;
  isDefault: boolean;
}

interface PublishReview {
  canPublish: boolean;
  issues: Array<{ code: string; path: string; message: string }>;
  draft: { editVersion: number; digest: string };
  published: null | {
    id: string;
    number: number;
    digest: string;
    sourceEditVersion: number;
    publishedAt: string;
  };
  diff: {
    added: number;
    removed: number;
    changed: number;
    changes: Array<{
      kind: "added" | "removed" | "changed";
      objectType: string;
      objectKey: string;
    }>;
  };
}

const sections = [
  { id: "startup", label: "On Start Up", types: ["STARTUP"], icon: Play },
  { id: "modules", label: "Module Setting", types: ["MODULE"], icon: Settings2 },
  { id: "sitemap", label: "Site Map View", types: ["ROUTE"], icon: Map },
  { id: "collections", label: "Collection Set", types: ["COLLECTION"], icon: Database },
  { id: "screens", label: "Screens", types: ["SCREEN", "POPUP"], icon: Monitor },
  { id: "pages", label: "Pages", types: ["PAGE"], icon: FileText },
  { id: "components", label: "Components", types: ["COMPONENT", "COMPONENT_INSTANCE"], icon: Boxes },
] as const;

const standardComponents = COMPONENT_PALETTE.map((item) => ({
  type: item.type,
  label: item.label,
  defaultProps: item.defaultProps,
}));

const safeKeyPart = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const errorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

function PlacementInstances({
  items,
  busy,
  selectedId,
  onSelect,
  onMove,
  onRemove,
}: {
  items: StudioObject[];
  busy: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (items: StudioObject[], from: number, to: number) => void;
  onRemove: (item: StudioObject) => void;
}) {
  const ordered = orderComponents(items);
  if (!ordered.length) return <div className="small text-muted mt-2">ยังไม่มี Component</div>;
  return <div className="mt-2 d-flex flex-column gap-1">
    {ordered.map((item, index) => <div className={`d-flex align-items-center gap-1 border rounded px-2 py-1 bg-white ${selectedId === item.id ? "border-primary" : ""}`} key={item.id}>
      <button type="button" className="btn btn-sm border-0 p-0 text-start flex-grow-1" onClick={() => onSelect(item.id)}>
        <span className="small fw-semibold">{item.objectName}</span>
        <span className="small text-muted ms-2">#{index + 1}</span>
      </button>
      <button type="button" aria-label={`Move ${item.objectName} up`} className="btn btn-sm btn-light p-1" disabled={busy || index === 0} onClick={() => onMove(ordered, index, index - 1)}><ArrowUp size={13} /></button>
      <button type="button" aria-label={`Move ${item.objectName} down`} className="btn btn-sm btn-light p-1" disabled={busy || index === ordered.length - 1} onClick={() => onMove(ordered, index, index + 1)}><ArrowDown size={13} /></button>
      <button type="button" aria-label={`Remove ${item.objectName}`} className="btn btn-sm btn-outline-danger p-1" disabled={busy} onClick={() => onRemove(item)}><Trash2 size={13} /></button>
    </div>)}
  </div>;
}

export function TemplateStudioClient({ templateId }: { readonly templateId: string }) {
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [objects, setObjects] = useState<StudioObject[]>([]);
  const [screenPages, setScreenPages] = useState<ScreenPageRelation[]>([]);
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("startup");
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [publishReview, setPublishReview] = useState<PublishReview | null>(null);
  const [message, setMessage] = useState("กำลังโหลด Template…");

  const load = useCallback(async () => {
    const [templateResponse, objectsResponse, relationsResponse] = await Promise.all([
      fetch(`/api/templates/${templateId}`, { cache: "no-store" }),
      fetch(`/api/templates/${templateId}/objects`, { cache: "no-store" }),
      fetch(`/api/templates/${templateId}/screen-pages`, { cache: "no-store" }),
    ]);
    const templateBody = await templateResponse.json();
    const objectsBody = await objectsResponse.json();
    const relationsBody = await relationsResponse.json();
    if (!templateResponse.ok) throw new Error(templateBody.error ?? "โหลด Template ไม่สำเร็จ");
    if (!objectsResponse.ok) throw new Error(objectsBody.error ?? "โหลด Objects ไม่สำเร็จ");
    if (!relationsResponse.ok) throw new Error(relationsBody.error ?? "โหลด Site Map ไม่สำเร็จ");
    setTemplate(templateBody.template);
    setObjects(objectsBody.objects ?? []);
    setScreenPages(relationsBody.screenPages ?? []);
    setMessage("พร้อมแก้ไข");
  }, [templateId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial remote state hydration
    void load().catch((error) => setMessage(errorMessage(error)));
  }, [load]);

  const section = sections.find((item) => item.id === activeSection) ?? sections[0];
  const visibleObjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return objects.filter((object) =>
      section.types.some((type) => type === object.objectType) &&
      (!needle || `${object.objectName} ${object.objectKey} ${object.objectType}`.toLowerCase().includes(needle)),
    );
  }, [objects, query, section]);
  const selected = objects.find((object) => object.id === selectedId) ?? null;
  const pages = objects.filter((object) => object.objectType === "PAGE");
  const screens = objects.filter((object) => object.objectType === "SCREEN");
  const routes = objects.filter((object) => object.objectType === "ROUTE");

  const request = async (url: string, init: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
    const body = response.status === 204 ? {} : await response.json();
    if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
    return body;
  };

  const saveObject = async (
    objectType: ObjectType,
    objectKey: string,
    objectName: string,
    definition: Record<string, unknown>,
  ): Promise<StudioObject> => {
    const body = await request(`/api/templates/${templateId}/objects`, {
      method: "POST",
      body: JSON.stringify({
        objectType,
        objectKey,
        objectName,
        definition,
        expectedEditVersion: 0,
      }),
    });
    return body.object;
  };

  const updateObject = async (
    object: StudioObject,
    definition: Record<string, unknown>,
    objectName = object.objectName,
  ): Promise<StudioObject> => {
    const body = await request(`/api/templates/${templateId}/objects`, {
      method: "POST",
      body: JSON.stringify({
        objectId: object.id,
        objectType: object.objectType,
        objectKey: object.objectKey,
        objectName,
        definition,
        expectedEditVersion: object.editVersion,
      }),
    });
    return body.object;
  };

  const definitionFor = (type: ObjectType, key: string, name: string): Record<string, unknown> => {
    if (type === "STARTUP") return { mainCss: "", browserActions: [] };
    if (type === "MODULE") return { moduleKey: "auth", enabled: true, config: createDefaultModuleConfig("auth") };
    if (type === "ROUTE") {
      return {
        path: routes.length ? `/${safeKeyPart(name)}` : "/",
        screenId: screens[0]?.objectKey ?? "",
        isDefault: routes.length === 0,
      };
    }
    if (type === "SCREEN") {
      return {
        defaultPageId: pages[0]?.objectKey ?? "",
        regions: SCREEN_REGION_KEYS.map((regionKey) => ({ key: regionKey, componentInstanceIds: [] })),
        menu: [], popupIds: [], eventSteps: [], css: "",
      };
    }
    if (type === "PAGE") {
      return {
        panels: [{
          id: `panel.${safeKeyPart(name) || "content"}`,
          name: "Content",
          order: 0,
          responsive: { desktop: 12, tablet: 12, mobile: 12 },
        }],
        collections: [], css: "",
      };
    }
    if (type === "COLLECTION") {
      return {
        tableName: (safeKeyPart(name) || "records").replace(/-/g, "_"),
        access: { publicRead: false, publicCreate: false, publicUpdate: false },
        fields: [
          { id: "id", name: "ID", type: "integer", required: true, primaryKey: true },
          { id: "name", name: "Name", type: "string", required: true },
        ],
      };
    }
    if (type === "POPUP") return { pageId: pages[0]?.objectKey ?? "" };
    return { componentType: "standard", version: 1, definition: { standardType: "TextComponent" } };
  };

  const createObject = async (forcedType?: ObjectType) => {
    const name = newName.trim();
    if (!name) return;
    const type: ObjectType = forcedType ?? (activeSection === "startup"
      ? "STARTUP"
      : activeSection === "modules"
        ? "MODULE"
        : activeSection === "sitemap"
          ? "ROUTE"
          : activeSection === "collections"
            ? "COLLECTION"
            : activeSection === "screens"
              ? "SCREEN"
              : activeSection === "pages"
                ? "PAGE"
                : "COMPONENT");
    if (type === "STARTUP" && objects.some((object) => object.objectType === "STARTUP")) {
      setMessage("Template มี On Start Up อยู่แล้ว");
      return;
    }
    if (type === "ROUTE" && !screens.length) {
      setMessage("สร้าง Screen ก่อน Route");
      return;
    }
    if (type === "SCREEN" && !pages.length) {
      setMessage("สร้าง Page ก่อน Screen เพื่อกำหนด Default Page");
      return;
    }
    if (type === "POPUP" && !pages.length) {
      setMessage("สร้าง Page ก่อน Popup");
      return;
    }
    const prefix = type.toLowerCase().replace("component_instance", "instance");
    const key = newKey.trim() || `${prefix}.${safeKeyPart(name)}`;
    setBusy(true);
    try {
      const saved = await saveObject(type, key, name, definitionFor(type, key, name));
      if (type === "SCREEN" && pages[0]) {
        const latestTemplate = await request(`/api/templates/${templateId}`, { method: "GET" });
        await request(`/api/templates/${templateId}/screen-pages`, {
          method: "PUT",
          body: JSON.stringify({
            screenObjectId: saved.id,
            expectedTemplateEditVersion: latestTemplate.template.editVersion,
            pages: [{ pageObjectId: pages[0].id, sortOrder: 0, isDefault: true }],
          }),
        });
      }
      if (type === "PAGE" && screens[0]) {
        const currentRelations = screenPages.filter(
          (relation) => relation.screenObjectId === screens[0].id,
        );
        const latestTemplate = await request(`/api/templates/${templateId}`, { method: "GET" });
        await request(`/api/templates/${templateId}/screen-pages`, {
          method: "PUT",
          body: JSON.stringify({
            screenObjectId: screens[0].id,
            expectedTemplateEditVersion: latestTemplate.template.editVersion,
            pages: [
              ...currentRelations.map((relation) => ({
                pageObjectId: relation.pageObjectId,
                sortOrder: relation.sortOrder,
                isDefault: relation.isDefault,
              })),
              {
                pageObjectId: saved.id,
                sortOrder: currentRelations.length,
                isDefault: currentRelations.length === 0,
              },
            ],
          }),
        });
      }
      setNewName("");
      setNewKey("");
      setSelectedId(saved.id);
      await load();
      setMessage(`สร้าง ${type} แล้ว`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const togglePublic = async () => {
    if (!template) return;
    setBusy(true);
    try {
      await request(`/api/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedEditVersion: template.editVersion,
          isPublic: !template.isPublic,
        }),
      });
      await load();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const reviewPublish = async () => {
    setBusy(true);
    try {
      const body = await request(`/api/templates/${templateId}/publish`, { method: "GET" });
      setPublishReview(body.review as PublishReview);
      setMessage(body.review.canPublish ? "ตรวจ Draft แล้ว พร้อม Publish" : "Draft ยังมีปัญหาที่ต้องแก้");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!publishReview) return;
    setBusy(true);
    try {
      const body = await request(`/api/templates/${templateId}/publish`, {
        method: "POST",
        body: JSON.stringify({ expectedEditVersion: publishReview.draft.editVersion }),
      });
      setPublishReview(null);
      await load();
      setMessage(`Published revision #${body.revision.number}`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const createInstance = async (page: StudioObject, panelId: string, standardType: string) => {
    setBusy(true);
    try {
      const suffix = crypto.randomUUID().slice(0, 8);
      await saveObject(
        "COMPONENT_INSTANCE",
        `instance.${safeKeyPart(standardType)}-${suffix}`,
        standardType,
        {
          placement: "page_panel",
          pageId: page.objectKey,
          panelId,
          loadOrder: objects.filter((object) => object.objectType === "COMPONENT_INSTANCE").length,
          source: "standard",
          standardType,
          props: structuredClone(standardComponents.find((item) => item.type === standardType)?.defaultProps ?? {}),
          bindings: {},
        },
      );
      await load();
      setMessage(`วาง ${standardType} ลง ${page.objectName} แล้ว`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const createScreenInstance = async (
    screen: StudioObject,
    regionKey: (typeof SCREEN_REGION_KEYS)[number],
    standardType: string,
  ) => {
    setBusy(true);
    try {
      const suffix = crypto.randomUUID().slice(0, 8);
      const instance = await saveObject(
        "COMPONENT_INSTANCE",
        `instance.${safeKeyPart(standardType)}-${suffix}`,
        standardType,
        {
          placement: "screen_region",
          screenId: screen.objectKey,
          region: regionKey,
          loadOrder: objects.filter((object) =>
            object.objectType === "COMPONENT_INSTANCE" &&
            object.definition.placement === "screen_region" &&
            object.definition.screenId === screen.objectKey,
          ).length,
          source: "standard",
          standardType,
          props: structuredClone(standardComponents.find((item) => item.type === standardType)?.defaultProps ?? {}),
          bindings: {},
        },
      );
      const regions = (screen.definition.regions as Array<{
        key: string;
        componentInstanceIds: string[];
      }> | undefined) ?? [];
      await updateObject(screen, {
        ...screen.definition,
        regions: regions.map((region) => region.key === regionKey
          ? {
              ...region,
              componentInstanceIds: [...(region.componentInstanceIds ?? []), instance.objectKey],
            }
          : region),
      });
      await load();
      setMessage(`วาง ${standardType} ลง ${screen.objectName}/${regionKey} แล้ว`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const createAutoForm = async (collection: StudioObject) => {
    const page = pages[0];
    const panel = (page?.definition.panels as Array<{ id: string }> | undefined)?.[0];
    if (!page || !panel) {
      setMessage("สร้าง Page ที่มี Panel ก่อนสร้าง Auto Form");
      return;
    }
    setBusy(true);
    try {
      const suffix = crypto.randomUUID().slice(0, 8);
      const componentKey = `component.${safeKeyPart(collection.objectName)}-form-${suffix}`;
      const collectionLoads = (
        page.definition.collections as Array<{
          collectionId: string;
          loadOrder: number;
          alias: string;
        }> | undefined
      ) ?? [];
      if (!collectionLoads.some((load) => load.collectionId === collection.objectKey)) {
        await updateObject(page, {
          ...page.definition,
          collections: [
            ...collectionLoads,
            {
              collectionId: collection.objectKey,
              loadOrder: collectionLoads.length,
              alias: safeKeyPart(collection.objectName).replace(/-/g, "_") || "records",
            },
          ],
        });
      }
      await saveObject("COMPONENT", componentKey, `${collection.objectName} Form`, {
        componentType: "standard",
        version: 1,
        definition: {
          standardType: "FormComponent",
          sourceCollectionId: collection.objectKey,
          sourceCollectionVersion: collection.editVersion,
          fields: collection.definition.fields ?? [],
        },
      });
      await saveObject("COMPONENT_INSTANCE", `instance.${safeKeyPart(collection.objectName)}-form-${suffix}`, `${collection.objectName} Form`, {
        placement: "page_panel",
        pageId: page.objectKey,
        panelId: panel.id,
        loadOrder: 0,
        source: "reusable",
        componentId: componentKey,
        props: { mode: "insert", collectionId: collection.objectKey },
        bindings: {},
      });
      await load();
      setMessage(`สร้าง Form จาก ${collection.objectName} แล้ว`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const renameSelected = async () => {
    if (!selected) return;
    const nextName = window.prompt("ชื่อใหม่", selected.objectName)?.trim();
    if (!nextName || nextName === selected.objectName) return;
    setBusy(true);
    try {
      await updateObject(selected, selected.definition, nextName);
      await load();
      setMessage(`เปลี่ยนชื่อเป็น ${nextName} แล้ว`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const saveSelectedDefinition = async (definition: Record<string, unknown>) => {
    if (!selected) return;
    setBusy(true);
    try {
      const saved = await updateObject(selected, definition);
      setSelectedId(saved.id);
      await load();
      setMessage(`บันทึก ${selected.objectName} แล้ว`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const reorderInstances = async (siblings: StudioObject[], from: number, to: number) => {
    const placement = placementOf(siblings[0]?.definition ?? {});
    if (!placement) {
      setMessage("Placement ของ Component ไม่ถูกต้อง");
      return;
    }
    const next = moveItem(siblings, from, to);
    setBusy(true);
    try {
      await request(`/api/templates/${templateId}/objects`, {
        method: "PUT",
        body: JSON.stringify({
          placement,
          objects: next.map((item) => ({
            objectId: item.id,
            expectedEditVersion: item.editVersion,
          })),
        }),
      });
      await load();
      setMessage("จัดลำดับ Component แล้ว");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const removeInstance = async (item: StudioObject) => {
    if (!window.confirm(`ลบ ${item.objectName} ออกจาก Layout?`)) return;
    setBusy(true);
    try {
      await request(`/api/templates/${templateId}/objects`, {
        method: "DELETE",
        body: JSON.stringify({ objectId: item.id, expectedEditVersion: item.editVersion }),
      });
      if (selectedId === item.id) setSelectedId(null);
      await load();
      setMessage(`ลบ ${item.objectName} แล้ว`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const saveSelectedScreenPages = async (
    relations: StudioPageRelation[],
    definition: Record<string, unknown>,
  ) => {
    if (!selected || selected.objectType !== "SCREEN") return;
    const defaultPage = pages.find((page) => relations.some((item) => item.pageObjectId === page.id && item.isDefault));
    if (!defaultPage) {
      setMessage("เลือก Default Page ก่อนบันทึก");
      return;
    }
    setBusy(true);
    try {
      await updateObject(selected, { ...definition, defaultPageId: defaultPage.objectKey });
      const latestTemplate = await request(`/api/templates/${templateId}`, { method: "GET" });
      await request(`/api/templates/${templateId}/screen-pages`, {
        method: "PUT",
        body: JSON.stringify({
          screenObjectId: selected.id,
          expectedTemplateEditVersion: latestTemplate.template.editVersion,
          pages: relations,
        }),
      });
      await load();
      setMessage(`บันทึก Pages ของ ${selected.objectName} แล้ว`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="d-flex flex-column bg-light" style={{ minHeight: "calc(100vh - 64px)" }}>
      <header className="bg-dark text-white px-3 py-2 d-flex align-items-center gap-3 flex-wrap">
        <div className="me-auto">
          <strong>{template?.templateName ?? "Template Studio"}</strong>
          <span className="text-white-50 ms-2 small">{template?.templateSlug}</span>
        </div>
        <label className="d-flex align-items-center gap-2 small">
          <input type="checkbox" checked={template?.isPublic ?? false} disabled={busy} onChange={() => void togglePublic()} />
          Public
        </label>
        <div className="input-group input-group-sm" style={{ width: 280 }}>
          <span className="input-group-text"><Search size={14} /></span>
          <input className="form-control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้น Object ในแม่แบบ" />
        </div>
        <button className="btn btn-sm btn-outline-light d-flex align-items-center gap-1" disabled={busy} onClick={() => setShowPreview(true)}><Eye size={14} />Preview</button>
        <button className="btn btn-sm btn-success" disabled={busy} onClick={() => void reviewPublish()}>Publish</button>
      </header>

      <div className="d-flex flex-grow-1 align-items-stretch">
        <aside className="bg-white border-end p-2" style={{ width: 230 }}>
          {sections.map((item) => {
            const Icon = item.icon;
            const count = objects.filter((object) => item.types.some((type) => type === object.objectType)).length;
            return (
              <button key={item.id} className={`btn btn-sm w-100 d-flex align-items-center gap-2 text-start mb-1 ${activeSection === item.id ? "btn-primary" : "btn-light"}`} onClick={() => setActiveSection(item.id)}>
                <Icon size={15} /><span className="flex-grow-1">{item.label}</span><span className="badge text-bg-secondary">{count}</span>
              </button>
            );
          })}
        </aside>

        <main className="p-3 flex-grow-1 min-w-0">
          <div className="d-flex align-items-center mb-3 gap-2">
            <Layers3 size={20} className="text-primary" />
            <h1 className="h5 mb-0">{section.label}</h1>
            <span className="small text-muted ms-auto">v{template?.editVersion ?? "—"} · {message}</span>
          </div>

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body py-2 d-flex gap-2 flex-wrap">
              <input className="form-control form-control-sm" style={{ maxWidth: 220 }} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={`ชื่อ ${section.label}`} />
              <input className="form-control form-control-sm" style={{ maxWidth: 240 }} value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="Object key (สร้างอัตโนมัติได้)" />
              <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" disabled={busy || !newName.trim()} onClick={() => void createObject()}><Plus size={14} />{activeSection === "screens" ? "สร้าง Screen" : "สร้างโดยไม่แก้ JSON"}</button>
              {activeSection === "screens" && <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" disabled={busy || !newName.trim()} onClick={() => void createObject("POPUP")}><Plus size={14} />สร้าง Popup</button>}
            </div>
          </div>

          {activeSection === "sitemap" && (
            <div className="card border-0 shadow-sm mb-3"><div className="card-body">
              <div className="fw-semibold mb-2">Route → Screen → Page</div>
              {routes.map((route) => {
                const screen = screens.find((item) => item.objectKey === route.definition.screenId);
                const relations = screenPages.filter((item) => item.screenObjectId === screen?.id);
                return <div key={route.id} className="border-start border-primary ps-3 py-1 mb-2"><code>{String(route.definition.path)}</code> <span className="text-muted">→</span> {screen?.objectName ?? "Missing Screen"}<div className="small text-muted ps-3">{relations.map((item) => `${item.pageKey}${item.isDefault ? " (default)" : ""}`).join(" · ") || "No Page relation"}</div></div>;
              })}
            </div></div>
          )}

          {activeSection === "pages" && (
            <div className="card border-0 shadow-sm mb-3"><div className="card-body">
              <div className="small fw-semibold mb-2">ลาก Standard Component ลง Panel</div>
              <div className="d-flex gap-2 flex-wrap mb-3">
                {standardComponents.map((item) => <span key={item.type} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-lowcode-component", item.type)} className="badge text-bg-light border p-2" style={{ cursor: "grab" }}>{item.label}</span>)}
              </div>
              <div className="row g-2">
                {pages.map((page) => ((page.definition.panels as Array<{ id: string; name: string; responsive?: Record<string, number> }> | undefined) ?? []).map((panel) => (
                  <div className="col-12 col-lg-6" key={`${page.id}:${panel.id}`}>
                    <div className="border border-2 border-dashed rounded p-3 bg-light" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const type = event.dataTransfer.getData("application/x-lowcode-component"); if (type) void createInstance(page, panel.id, type); }}>
                      <strong>{page.objectName} / {panel.name}</strong>
                      <div className="small text-muted">Desktop {panel.responsive?.desktop ?? 12} · Tablet {panel.responsive?.tablet ?? 12} · Mobile {panel.responsive?.mobile ?? 12}</div>
                      <PlacementInstances items={objects.filter((item) => item.objectType === "COMPONENT_INSTANCE" && item.definition.placement === "page_panel" && item.definition.pageId === page.objectKey && item.definition.panelId === panel.id)} busy={busy} selectedId={selectedId} onSelect={setSelectedId} onMove={(items, from, to) => void reorderInstances(items, from, to)} onRemove={(item) => void removeInstance(item)} />
                    </div>
                  </div>
                )))}
              </div>
            </div></div>
          )}

          {activeSection === "screens" && (
            <div className="card border-0 shadow-sm mb-3"><div className="card-body">
              <div className="small fw-semibold mb-2">ลาก Standard Component ลง Screen region</div>
              <div className="d-flex gap-2 flex-wrap mb-3">
                {standardComponents.map((item) => <span key={item.type} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-lowcode-component", item.type)} className="badge text-bg-light border p-2" style={{ cursor: "grab" }}>{item.label}</span>)}
              </div>
              {screens.map((screen) => <div key={screen.id} className="mb-3"><strong>{screen.objectName}</strong><div className="row g-2 mt-1">{SCREEN_REGION_KEYS.map((regionKey) => <div className={regionKey === "content" ? "col-12" : "col-6"} key={regionKey}><div className="border border-2 border-dashed rounded p-2 bg-light h-100" style={{ minHeight: regionKey === "content" ? 90 : 58 }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const type = event.dataTransfer.getData("application/x-lowcode-component"); if (type) void createScreenInstance(screen, regionKey, type); }}><span className="small text-uppercase text-muted">{regionKey}</span><PlacementInstances items={objects.filter((item) => item.objectType === "COMPONENT_INSTANCE" && item.definition.placement === "screen_region" && item.definition.screenId === screen.objectKey && item.definition.region === regionKey)} busy={busy} selectedId={selectedId} onSelect={setSelectedId} onMove={(items, from, to) => void reorderInstances(items, from, to)} onRemove={(item) => void removeInstance(item)} /></div></div>)}</div></div>)}
            </div></div>
          )}

          <div className="row g-2">
            {visibleObjects.map((object) => (
              <div className="col-12 col-xl-6" key={object.id}>
                <button className={`card w-100 text-start border-0 shadow-sm ${selectedId === object.id ? "ring" : ""}`} onClick={() => setSelectedId(object.id)}>
                  <div className="card-body">
                    <div className="d-flex align-items-center gap-2"><Braces size={15} className="text-primary" /><strong>{object.objectName}</strong><span className="badge text-bg-light ms-auto">{object.objectType}</span></div>
                    <code className="small">{object.objectKey}</code>
                    {object.objectType === "COLLECTION" && <div className="mt-2"><span role="button" tabIndex={0} className="btn btn-sm btn-outline-primary" onClick={(event) => { event.stopPropagation(); void createAutoForm(object); }}>Auto Form</span></div>}
                  </div>
                </button>
              </div>
            ))}
          </div>

          {!visibleObjects.length && <div className="text-center text-muted p-5">ยังไม่มี Object ในส่วนนี้</div>}
          {selected && <TemplatePropertyEditor key={`${selected.id}:${selected.editVersion}:${screenPages.map((item) => `${item.id}:${item.sortOrder}:${item.isDefault}`).join("|")}`} object={selected} objects={objects} relations={screenPages} busy={busy} onRename={() => void renameSelected()} onSaveDefinition={saveSelectedDefinition} onSaveScreenPages={saveSelectedScreenPages} />}
        </main>
      </div>
      {publishReview && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 1080, background: "rgba(15, 23, 42, 0.72)" }}>
          <section className="card shadow-lg border-0 w-100" style={{ maxWidth: 760, maxHeight: "88vh", overflow: "auto" }} role="dialog" aria-label="Publish review" aria-modal="true">
            <div className="card-header bg-white d-flex align-items-center gap-2">
              <div>
                <strong>ตรวจสอบก่อน Publish</strong>
                <div className="small text-muted">Draft v{publishReview.draft.editVersion} → {publishReview.published ? `revision #${publishReview.published.number}` : "revision แรก"}</div>
              </div>
              <button type="button" className="btn-close ms-auto" aria-label="Close publish review" disabled={busy} onClick={() => setPublishReview(null)} />
            </div>
            <div className="card-body">
              <div className="d-flex gap-2 flex-wrap mb-3">
                <span className="badge text-bg-success">เพิ่ม {publishReview.diff.added}</span>
                <span className="badge text-bg-warning">แก้ {publishReview.diff.changed}</span>
                <span className="badge text-bg-danger">ลบ {publishReview.diff.removed}</span>
                <code className="small ms-auto">{publishReview.draft.digest.slice(0, 12)}</code>
              </div>
              {publishReview.issues.length > 0 && (
                <div className="alert alert-danger py-2">
                  <strong>Publish ไม่ได้: {publishReview.issues.length} ปัญหา</strong>
                  <ul className="mb-0 mt-2 small">
                    {publishReview.issues.map((issue, index) => <li key={`${issue.code}:${issue.path}:${index}`}><code>{issue.path}</code> — {issue.message}</li>)}
                  </ul>
                </div>
              )}
              {publishReview.diff.changes.length > 0 ? (
                <div className="list-group list-group-flush border rounded">
                  {publishReview.diff.changes.map((change) => (
                    <div className="list-group-item d-flex align-items-center gap-2 py-2" key={`${change.kind}:${change.objectType}:${change.objectKey}`}>
                      <span className={`badge ${change.kind === "added" ? "text-bg-success" : change.kind === "removed" ? "text-bg-danger" : "text-bg-warning"}`}>{change.kind}</span>
                      <span className="small text-muted">{change.objectType}</span>
                      <code className="small">{change.objectKey}</code>
                    </div>
                  ))}
                </div>
              ) : <div className="alert alert-secondary py-2 mb-0">Draft ตรงกับ revision ที่ Publish อยู่ ระบบจะใช้ revision เดิม</div>}
            </div>
            <div className="card-footer bg-white d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setPublishReview(null)}>กลับไปแก้</button>
              <button type="button" className="btn btn-success" disabled={busy || !publishReview.canPublish} onClick={() => void publish()}>ยืนยัน Publish</button>
            </div>
          </section>
        </div>
      )}
      {showPreview && <TemplateRuntimePreview templateId={templateId} onClose={() => setShowPreview(false)} />}
    </div>
  );
}
