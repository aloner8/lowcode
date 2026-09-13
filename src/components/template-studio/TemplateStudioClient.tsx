"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
} from "lucide-react";
import { SCREEN_REGION_KEYS } from "@/lib/template/contracts";
import { TemplatePropertyEditor } from "@/components/template-studio/TemplatePropertyEditor";
import { TemplateRuntimePreview } from "@/components/template-studio/TemplateRuntimePreview";
import type { StudioPageRelation } from "@/lib/template/studioEditing";

type ObjectType =
  | "STARTUP"
  | "MODULE"
  | "ROUTE"
  | "SCREEN"
  | "PAGE"
  | "COMPONENT"
  | "COMPONENT_INSTANCE"
  | "COLLECTION";

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

const sections = [
  { id: "startup", label: "On Start Up", types: ["STARTUP"], icon: Play },
  { id: "modules", label: "Module Setting", types: ["MODULE"], icon: Settings2 },
  { id: "sitemap", label: "Site Map View", types: ["ROUTE"], icon: Map },
  { id: "collections", label: "Collection Set", types: ["COLLECTION"], icon: Database },
  { id: "screens", label: "Screens", types: ["SCREEN"], icon: Monitor },
  { id: "pages", label: "Pages", types: ["PAGE"], icon: FileText },
  { id: "components", label: "Components", types: ["COMPONENT", "COMPONENT_INSTANCE"], icon: Boxes },
] as const;

const standardComponents = ["TextComponent", "ButtonComponent", "DataTableComponent", "FormComponent"];

const safeKeyPart = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const errorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

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
    if (type === "MODULE") return { moduleKey: key, enabled: true, config: {} };
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
    return { componentType: "standard", version: 1, definition: { standardType: "TextComponent" } };
  };

  const createObject = async () => {
    const name = newName.trim();
    if (!name) return;
    const type: ObjectType = activeSection === "startup"
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
                : "COMPONENT";
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

  const publish = async () => {
    setBusy(true);
    try {
      const body = await request(`/api/templates/${templateId}/publish`, {
        method: "POST",
        body: "{}",
      });
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
          props: {},
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
          props: {},
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
        <button className="btn btn-sm btn-success" disabled={busy} onClick={() => void publish()}>Publish</button>
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
              <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" disabled={busy || !newName.trim()} onClick={() => void createObject()}><Plus size={14} />สร้างโดยไม่แก้ JSON</button>
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
                {standardComponents.map((type) => <span key={type} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-lowcode-component", type)} className="badge text-bg-light border p-2" style={{ cursor: "grab" }}>{type}</span>)}
              </div>
              <div className="row g-2">
                {pages.map((page) => ((page.definition.panels as Array<{ id: string; name: string; responsive?: Record<string, number> }> | undefined) ?? []).map((panel) => (
                  <div className="col-12 col-lg-6" key={`${page.id}:${panel.id}`}>
                    <div className="border border-2 border-dashed rounded p-3 bg-light" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const type = event.dataTransfer.getData("application/x-lowcode-component"); if (type) void createInstance(page, panel.id, type); }}>
                      <strong>{page.objectName} / {panel.name}</strong>
                      <div className="small text-muted">Desktop {panel.responsive?.desktop ?? 12} · Tablet {panel.responsive?.tablet ?? 12} · Mobile {panel.responsive?.mobile ?? 12}</div>
                      <div className="mt-2 d-flex flex-wrap gap-1">{objects.filter((item) => item.objectType === "COMPONENT_INSTANCE" && item.definition.pageId === page.objectKey && item.definition.panelId === panel.id).map((item) => <span className="badge text-bg-primary" key={item.id}>{item.objectName}</span>)}</div>
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
                {standardComponents.map((type) => <span key={type} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-lowcode-component", type)} className="badge text-bg-light border p-2" style={{ cursor: "grab" }}>{type}</span>)}
              </div>
              {screens.map((screen) => <div key={screen.id} className="mb-3"><strong>{screen.objectName}</strong><div className="row g-2 mt-1">{SCREEN_REGION_KEYS.map((regionKey) => <div className={regionKey === "content" ? "col-12" : "col-6"} key={regionKey}><div className="border border-2 border-dashed rounded p-2 bg-light h-100" style={{ minHeight: regionKey === "content" ? 90 : 58 }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const type = event.dataTransfer.getData("application/x-lowcode-component"); if (type) void createScreenInstance(screen, regionKey, type); }}><span className="small text-uppercase text-muted">{regionKey}</span><div className="d-flex gap-1 flex-wrap mt-1">{objects.filter((item) => item.objectType === "COMPONENT_INSTANCE" && item.definition.placement === "screen_region" && item.definition.screenId === screen.objectKey && item.definition.region === regionKey).map((item) => <span className="badge text-bg-primary" key={item.id}>{item.objectName}</span>)}</div></div></div>)}</div></div>)}
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
      {showPreview && <TemplateRuntimePreview templateId={templateId} onClose={() => setShowPreview(false)} />}
    </div>
  );
}
