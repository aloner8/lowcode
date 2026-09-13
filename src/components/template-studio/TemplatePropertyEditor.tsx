"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Braces, Plus, Save, Trash2, Workflow } from "lucide-react";
import { HtmlStudioShell } from "@/components/html-studio";
import type { HtmlStudioDocument } from "@/lib/html-studio";
import {
  buildScreenPageUpdate,
  moveItem,
  normalizeEventSteps,
  normalizePanels,
  parseStudioValue,
  renameRecordKey,
  type StudioEventStep,
  type StudioPanel,
} from "@/lib/template/studioEditing";

interface StudioObject {
  id: string;
  objectType: string;
  objectKey: string;
  objectName: string;
  editVersion: number;
  definition: Record<string, unknown>;
}

interface Relation {
  screenObjectId: string;
  pageObjectId: string;
  sortOrder: number;
  isDefault: boolean;
}

interface Props {
  object: StudioObject;
  objects: StudioObject[];
  relations: Relation[];
  busy: boolean;
  onRename: () => void;
  onSaveDefinition: (definition: Record<string, unknown>) => Promise<void>;
  onSaveScreenPages: (
    relations: ReturnType<typeof buildScreenPageUpdate>,
    definition: Record<string, unknown>,
  ) => Promise<void>;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const panelsFrom = (value: unknown): StudioPanel[] => Array.isArray(value)
  ? value.map((panel, index) => {
      const item = record(panel);
      const responsive = record(item.responsive);
      return {
        id: String(item.id ?? `panel.${index + 1}`),
        name: String(item.name ?? `Panel ${index + 1}`),
        order: Number(item.order ?? index),
        responsive: {
          desktop: Number(responsive.desktop ?? 12),
          tablet: Number(responsive.tablet ?? 12),
          mobile: Number(responsive.mobile ?? 12),
        },
      };
    })
  : [];

const fieldTypes = ["string", "text", "integer", "decimal", "boolean", "date", "datetime", "json"] as const;

interface CollectionField {
  id: string;
  name: string;
  type: (typeof fieldTypes)[number];
  required: boolean;
  primaryKey?: boolean;
}

const fieldsFrom = (value: unknown): CollectionField[] => Array.isArray(value)
  ? value.map((field, index) => {
      const item = record(field);
      const type = fieldTypes.includes(item.type as CollectionField["type"])
        ? item.type as CollectionField["type"]
        : "string";
      return {
        id: String(item.id ?? `field_${index + 1}`),
        name: String(item.name ?? `Field ${index + 1}`),
        type,
        required: item.required === true,
        primaryKey: item.primaryKey === true,
      };
    })
  : [];

const eventPhases: StudioEventStep["phase"][] = [
  "onload", "afterLoad", "setLayout", "afterSetLayout", "changePage", "afterChangePage",
];

const stepsFrom = (value: unknown): StudioEventStep[] => Array.isArray(value)
  ? value.map((step, index) => {
      const item = record(step);
      const phase = eventPhases.includes(item.phase as StudioEventStep["phase"])
        ? item.phase as StudioEventStep["phase"]
        : "onload";
      return {
        id: String(item.id ?? `step.${index + 1}`),
        phase,
        order: Number(item.order ?? index),
        action: String(item.action ?? ""),
        input: record(item.input),
      };
    })
  : [];

const emptyHtmlDocument = (object: StudioObject): HtmlStudioDocument => {
  const now = new Date().toISOString();
  return {
    id: `html-${object.objectKey.replace(/[^A-Za-z0-9_-]/g, "-")}`,
    scope: "app",
    kind: "shared-template",
    name: object.objectName,
    version: 1,
    schemaVersion: 1,
    root: [{
      id: "root",
      kind: "element",
      tag: "section",
      classList: ["p-3"],
      children: [{ id: "text", kind: "text", text: object.objectName }],
    }],
    styleSheet: {
      scopeId: `component-${object.objectKey.replace(/[^A-Za-z0-9_-]/g, "-")}`,
      rules: [],
    },
    dependencies: [],
    settings: { cssScope: "component", dataPolicy: "collection-read", scriptPolicy: "none" },
    createdAt: now,
    updatedAt: now,
  };
};

function RecordEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const entries = Object.entries(value);
  const add = () => {
    let index = entries.length + 1;
    while (`property_${index}` in value) index += 1;
    onChange({ ...value, [`property_${index}`]: "" });
  };
  return <div className="col-12">
    <div className="d-flex align-items-center mb-2"><strong>{label}</strong><button type="button" className="btn btn-sm btn-outline-primary ms-auto" onClick={add}><Plus size={13} /> Add</button></div>
    {entries.length === 0 && <div className="small text-muted border rounded p-2">No {label.toLowerCase()} configured.</div>}
    {entries.map(([key, item], index) => <div className="row g-2 mb-2" key={`property-row-${index}`}>
      <div className="col-md-5"><input aria-label={`${label} key`} className="form-control form-control-sm font-monospace" value={key} onChange={(event) => onChange(renameRecordKey(value, key, event.target.value))} /></div>
      <div className="col-md-6"><input aria-label={`${label} value`} className="form-control form-control-sm" value={item === null ? "null" : String(item)} onChange={(event) => onChange({ ...value, [key]: parseStudioValue(event.target.value) })} /></div>
      <div className="col-md-1"><button type="button" aria-label={`Remove ${key}`} className="btn btn-sm btn-outline-danger" onClick={() => onChange(Object.fromEntries(entries.filter(([candidate]) => candidate !== key)))}><Trash2 size={13} /></button></div>
    </div>)}
  </div>;
}

interface BindingOption {
  value: string;
  label: string;
}

function BindingEditor({
  value,
  options,
  onChange,
}: {
  value: Record<string, unknown>;
  options: BindingOption[];
  onChange: (value: Record<string, unknown>) => void;
}) {
  const entries = Object.entries(value);
  const listId = `binding-sources-${options.map((option) => option.value).join("-").replace(/[^a-z0-9_-]/gi, "").slice(0, 40)}`;
  const add = () => {
    let index = entries.length + 1;
    while (`property_${index}` in value) index += 1;
    onChange({ ...value, [`property_${index}`]: options[0]?.value ?? "" });
  };
  return <div className="col-12">
    <div className="d-flex align-items-center mb-2"><strong>Bindings</strong><button type="button" className="btn btn-sm btn-outline-primary ms-auto" onClick={add}><Plus size={13} /> Add</button></div>
    {entries.length === 0 && <div className="small text-muted border rounded p-2">No bindings configured.</div>}
    {options.length > 0 && <datalist id={listId}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist>}
    {entries.map(([key, item], index) => <div className="row g-2 mb-2" key={`binding-row-${index}`}>
      <div className="col-md-5"><input aria-label="Bindings key" className="form-control form-control-sm font-monospace" value={key} onChange={(event) => onChange(renameRecordKey(value, key, event.target.value))} placeholder="Component prop" /></div>
      <div className="col-md-6"><input aria-label="Bindings source" list={options.length ? listId : undefined} className="form-control form-control-sm font-monospace" value={typeof item === "string" ? item : String(item ?? "")} onChange={(event) => onChange({ ...value, [key]: event.target.value })} placeholder="collectionAlias.field" /></div>
      <div className="col-md-1"><button type="button" aria-label={`Remove ${key}`} className="btn btn-sm btn-outline-danger" onClick={() => onChange(Object.fromEntries(entries.filter(([candidate]) => candidate !== key)))}><Trash2 size={13} /></button></div>
    </div>)}
    {options.length > 0 && <div className="small text-muted">เลือก source จาก Collection schema ได้ หรือพิมพ์ path เอง</div>}
  </div>;
}

const bindingOptionsFor = (
  object: StudioObject,
  objects: StudioObject[],
  relations: Relation[],
): BindingOption[] => {
  const pageKeys = new Set<string>();
  if (object.definition.placement === "page_panel" && typeof object.definition.pageId === "string") {
    pageKeys.add(object.definition.pageId);
  }
  if (object.definition.placement === "screen_region" && typeof object.definition.screenId === "string") {
    const screen = objects.find((candidate) =>
      candidate.objectType === "SCREEN" && candidate.objectKey === object.definition.screenId,
    );
    relations
      .filter((relation) => relation.screenObjectId === screen?.id)
      .forEach((relation) => {
        const page = objects.find((candidate) => candidate.id === relation.pageObjectId);
        if (page) pageKeys.add(page.objectKey);
      });
  }

  const collections = new Map(
    objects.filter((candidate) => candidate.objectType === "COLLECTION")
      .map((candidate) => [candidate.objectKey, candidate]),
  );
  const options: BindingOption[] = [];
  objects
    .filter((candidate) => candidate.objectType === "PAGE" && pageKeys.has(candidate.objectKey))
    .forEach((page) => {
      const loads = Array.isArray(page.definition.collections) ? page.definition.collections : [];
      loads.map(record).forEach((load) => {
        const alias = typeof load.alias === "string" ? load.alias : "";
        const collectionId = typeof load.collectionId === "string" ? load.collectionId : "";
        if (!alias) return;
        options.push({ value: alias, label: `${alias} · all rows` });
        const collection = collections.get(collectionId);
        const fields = Array.isArray(collection?.definition.fields) ? collection.definition.fields : [];
        fields.map(record).forEach((field) => {
          if (typeof field.id === "string") {
            options.push({
              value: `${alias}.${field.id}`,
              label: `${alias}.${field.id} · ${String(field.name ?? field.id)}`,
            });
          }
        });
      });
    });
  return [...new Map(options.map((option) => [option.value, option])).values()];
};

export function TemplatePropertyEditor({ object, objects, relations, busy, onRename, onSaveDefinition, onSaveScreenPages }: Props) {
  const initialRelations = relations
    .filter((item) => item.screenObjectId === object.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const [draft, setDraft] = useState(object.definition);
  const [screenPageIds, setScreenPageIds] = useState<string[]>(
    initialRelations.map((item) => item.pageObjectId),
  );
  const [defaultPageId, setDefaultPageId] = useState(
    initialRelations.find((item) => item.isDefault)?.pageObjectId ?? "",
  );
  const [showHtmlStudio, setShowHtmlStudio] = useState(false);
  const pages = objects.filter((item) => item.objectType === "PAGE");
  const screens = objects.filter((item) => item.objectType === "SCREEN");

  const set = (key: string, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));
  const save = () => onSaveDefinition(draft);
  const panels = panelsFrom(draft.panels);
  const setPanels = (next: StudioPanel[]) => set("panels", normalizePanels(next));
  const fields = fieldsFrom(draft.fields);
  const setFields = (next: CollectionField[]) => set("fields", next);
  const eventSteps = stepsFrom(draft.eventSteps);
  const setEventSteps = (next: StudioEventStep[]) => set("eventSteps", normalizeEventSteps(next));
  const componentDefinition = record(draft.definition);
  const bindingOptions = bindingOptionsFor(object, objects, relations);

  const togglePage = (pageId: string) => {
    if (screenPageIds.includes(pageId)) {
      const next = screenPageIds.filter((id) => id !== pageId);
      setScreenPageIds(next);
      if (defaultPageId === pageId) setDefaultPageId(next[0] ?? "");
    } else {
      const next = [...screenPageIds, pageId];
      setScreenPageIds(next);
      if (!defaultPageId) setDefaultPageId(pageId);
    }
  };

  if (showHtmlStudio) {
    const document = componentDefinition.document as HtmlStudioDocument | undefined;
    return <HtmlStudioShell
      document={document ?? emptyHtmlDocument(object)}
      onClose={() => setShowHtmlStudio(false)}
      onSave={(nextDocument) => {
        setDraft((current) => ({
          ...current,
          componentType: "html",
          definition: { ...record(current.definition), document: nextDocument },
        }));
        setShowHtmlStudio(false);
      }}
    />;
  }

  return (
    <div className="card border-0 shadow-sm mt-3">
      <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
        Properties — {object.objectName}
        <span className="badge text-bg-light">{object.objectType}</span>
        <button className="btn btn-sm btn-outline-primary ms-auto" disabled={busy} onClick={onRename}>Rename</button>
      </div>
      <div className="card-body">
        <div className="row g-3">
          <div className="col-md-8"><label className="form-label small">Object key</label><input className="form-control form-control-sm" value={object.objectKey} disabled /></div>
          <div className="col-md-4"><label className="form-label small">Version</label><input className="form-control form-control-sm" value={object.editVersion} disabled /></div>

          {object.objectType === "STARTUP" && <div className="col-12"><label className="form-label small">Main CSS</label><textarea rows={8} className="form-control form-control-sm font-monospace" value={String(draft.mainCss ?? "")} onChange={(event) => set("mainCss", event.target.value)} /></div>}

          {object.objectType === "MODULE" && <><div className="col-md-8"><label className="form-label small">Module key</label><input className="form-control form-control-sm" value={String(draft.moduleKey ?? "")} onChange={(event) => set("moduleKey", event.target.value)} /></div><div className="col-md-4 d-flex align-items-end"><label className="form-check"><input className="form-check-input" type="checkbox" checked={draft.enabled === true} onChange={(event) => set("enabled", event.target.checked)} /> <span className="form-check-label">Enabled</span></label></div></>}

          {object.objectType === "ROUTE" && <><div className="col-md-5"><label className="form-label small">Path</label><input className="form-control form-control-sm" value={String(draft.path ?? "")} onChange={(event) => set("path", event.target.value)} /></div><div className="col-md-5"><label className="form-label small">Screen</label><select className="form-select form-select-sm" value={String(draft.screenId ?? "")} onChange={(event) => set("screenId", event.target.value)}>{screens.map((screen) => <option key={screen.id} value={screen.objectKey}>{screen.objectName}</option>)}</select></div><div className="col-md-2 d-flex align-items-end"><label className="form-check"><input className="form-check-input" type="checkbox" checked={draft.isDefault === true} onChange={(event) => set("isDefault", event.target.checked)} /> Default</label></div></>}

          {object.objectType === "COLLECTION" && <><div className="col-md-6"><label className="form-label small">Table name</label><input className="form-control form-control-sm" value={String(draft.tableName ?? "")} onChange={(event) => set("tableName", event.target.value)} /></div><div className="col-md-6"><label className="form-label small d-block">Public access</label>{["publicRead", "publicCreate", "publicUpdate"].map((key) => <label className="form-check form-check-inline" key={key}><input className="form-check-input" type="checkbox" checked={record(draft.access)[key] === true} onChange={(event) => set("access", { ...record(draft.access), [key]: event.target.checked })} /> {key.replace("public", "")}</label>)}</div><div className="col-12"><div className="d-flex align-items-center mb-2"><strong>Fields</strong><button className="btn btn-sm btn-outline-primary ms-auto" onClick={() => setFields([...fields, { id: `field_${fields.length + 1}`, name: `Field ${fields.length + 1}`, type: "string", required: false }])}><Plus size={14} /> Add field</button></div>{fields.map((field, index) => <div className="row g-2 border rounded p-2 mb-2" key={index}><div className="col-md-3"><label className="form-label small mb-0">Column</label><input className="form-control form-control-sm" value={field.id} onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, id: event.target.value } : item))} /></div><div className="col-md-3"><label className="form-label small mb-0">Label</label><input className="form-control form-control-sm" value={field.name} onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></div><div className="col-md-2"><label className="form-label small mb-0">Type</label><select className="form-select form-select-sm" value={field.type} onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as CollectionField["type"] } : item))}>{fieldTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></div><div className="col-md-3 d-flex align-items-end gap-3"><label className="form-check"><input className="form-check-input" type="checkbox" checked={field.required} onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))} /> Required</label><label className="form-check"><input className="form-check-input" type="radio" name={`pk-${object.id}`} checked={field.primaryKey === true} onChange={() => setFields(fields.map((item, itemIndex) => ({ ...item, primaryKey: itemIndex === index })))} /> PK</label></div><div className="col-md-1 d-flex align-items-end"><button className="btn btn-sm btn-outline-danger" disabled={fields.length === 1 || field.primaryKey === true} onClick={() => setFields(fields.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></div></div>)}</div></>}

          {object.objectType === "SCREEN" && <><div className="col-12"><label className="form-label small">CSS</label><textarea rows={4} className="form-control form-control-sm font-monospace" value={String(draft.css ?? "")} onChange={(event) => set("css", event.target.value)} /></div><div className="col-12"><div className="fw-semibold mb-2">Pages in this Screen</div>{pages.map((page) => { const selected = screenPageIds.includes(page.id); const index = screenPageIds.indexOf(page.id); return <div className="d-flex align-items-center gap-2 border rounded p-2 mb-2" key={page.id}><input type="checkbox" checked={selected} onChange={() => togglePage(page.id)} /><span className="flex-grow-1">{page.objectName}</span>{selected && <><label className="small"><input type="radio" name={`default-${object.id}`} checked={defaultPageId === page.id} onChange={() => setDefaultPageId(page.id)} /> Default</label><button type="button" className="btn btn-sm btn-light" disabled={index <= 0} onClick={() => setScreenPageIds(moveItem(screenPageIds, index, index - 1))}><ArrowUp size={14} /></button><button type="button" className="btn btn-sm btn-light" disabled={index < 0 || index >= screenPageIds.length - 1} onClick={() => setScreenPageIds(moveItem(screenPageIds, index, index + 1))}><ArrowDown size={14} /></button></>}</div>; })}</div></>}

          {object.objectType === "SCREEN" && <div className="col-12"><div className="d-flex align-items-center mb-2"><Workflow size={15} className="me-2 text-primary" /><strong>Lifecycle event steps</strong><button type="button" className="btn btn-sm btn-outline-primary ms-auto" onClick={() => setEventSteps([...eventSteps, { id: `step.${crypto.randomUUID().slice(0, 8)}`, phase: "onload", order: eventSteps.length, action: "" }])}><Plus size={13} /> Add step</button></div>{eventSteps.length === 0 && <div className="small text-muted border rounded p-2">No lifecycle actions configured.</div>}{eventSteps.map((step, index) => <div className="row g-2 border rounded p-2 mb-2" key={step.id}><div className="col-md-3"><label className="form-label small mb-0">Phase</label><select className="form-select form-select-sm" value={step.phase} onChange={(event) => setEventSteps(eventSteps.map((item) => item.id === step.id ? { ...item, phase: event.target.value as StudioEventStep["phase"] } : item))}>{eventPhases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}</select></div><div className="col-md-6"><label className="form-label small mb-0">Action</label><input className="form-control form-control-sm" value={step.action} onChange={(event) => setEventSteps(eventSteps.map((item) => item.id === step.id ? { ...item, action: event.target.value } : item))} placeholder="loadSession, setTheme, …" /></div><div className="col-md-3 d-flex align-items-end gap-1"><button type="button" className="btn btn-sm btn-light" disabled={index === 0} onClick={() => setEventSteps(moveItem(eventSteps, index, index - 1))}><ArrowUp size={14} /></button><button type="button" className="btn btn-sm btn-light" disabled={index === eventSteps.length - 1} onClick={() => setEventSteps(moveItem(eventSteps, index, index + 1))}><ArrowDown size={14} /></button><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setEventSteps(eventSteps.filter((item) => item.id !== step.id))}><Trash2 size={14} /></button></div></div>)}<button type="button" className="btn btn-sm btn-primary mt-2" disabled={busy || !screenPageIds.length || eventSteps.some((step) => !step.action.trim())} onClick={() => void onSaveScreenPages(buildScreenPageUpdate(screenPageIds, defaultPageId), draft)}><Save size={14} className="me-1" />Save Screen + Pages</button></div>}

          {object.objectType === "PAGE" && <><div className="col-12"><label className="form-label small">CSS</label><textarea rows={4} className="form-control form-control-sm font-monospace" value={String(draft.css ?? "")} onChange={(event) => set("css", event.target.value)} /></div><div className="col-12"><div className="d-flex align-items-center mb-2"><strong>Panels</strong><button className="btn btn-sm btn-outline-primary ms-auto" onClick={() => setPanels([...panels, { id: `panel.${crypto.randomUUID().slice(0, 8)}`, name: `Panel ${panels.length + 1}`, order: panels.length, responsive: { desktop: 12, tablet: 12, mobile: 12 } }])}><Plus size={14} /> Add panel</button></div>{panels.map((panel, index) => <div className="row g-2 border rounded p-2 mb-2" key={panel.id}><div className="col-lg-4"><input className="form-control form-control-sm" value={panel.name} onChange={(event) => setPanels(panels.map((item) => item.id === panel.id ? { ...item, name: event.target.value } : item))} /></div>{(["desktop", "tablet", "mobile"] as const).map((device) => <div className="col-3 col-lg-2" key={device}><label className="form-label small mb-0">{device}</label><input type="number" min={1} max={12} className="form-control form-control-sm" value={panel.responsive[device]} onChange={(event) => setPanels(panels.map((item) => item.id === panel.id ? { ...item, responsive: { ...item.responsive, [device]: Number(event.target.value) } } : item))} /></div>)}<div className="col-3 col-lg-2 d-flex align-items-end gap-1"><button className="btn btn-sm btn-light" disabled={index === 0} onClick={() => setPanels(moveItem(panels, index, index - 1))}><ArrowUp size={14} /></button><button className="btn btn-sm btn-light" disabled={index === panels.length - 1} onClick={() => setPanels(moveItem(panels, index, index + 1))}><ArrowDown size={14} /></button><button className="btn btn-sm btn-outline-danger" disabled={panels.length === 1} onClick={() => setPanels(panels.filter((item) => item.id !== panel.id))}><Trash2 size={14} /></button></div></div>)}</div></>}

          {object.objectType === "COMPONENT" && <><div className="col-md-4"><label className="form-label small">Component type</label><select className="form-select form-select-sm" value={String(draft.componentType ?? "standard")} onChange={(event) => set("componentType", event.target.value)}><option value="standard">Standard</option><option value="html">HTML</option></select></div><div className="col-md-3"><label className="form-label small">Version</label><input type="number" min={1} className="form-control form-control-sm" value={Number(draft.version ?? 1)} onChange={(event) => set("version", Math.max(1, Number(event.target.value)))} /></div>{draft.componentType === "html" ? <div className="col-md-5 d-flex align-items-end"><button type="button" className="btn btn-outline-primary w-100" onClick={() => setShowHtmlStudio(true)}><Braces size={15} className="me-1" />Open HTML Studio</button></div> : <div className="col-md-5"><label className="form-label small">Standard component</label><input className="form-control form-control-sm" value={String(componentDefinition.standardType ?? "TextComponent")} onChange={(event) => set("definition", { ...componentDefinition, standardType: event.target.value })} /></div>}</>}

          {object.objectType === "COMPONENT_INSTANCE" && <><div className="col-md-4"><label className="form-label small">Source</label><input className="form-control form-control-sm" value={String(draft.standardType ?? draft.componentId ?? "—")} disabled /></div><div className="col-md-4"><label className="form-label small">Placement</label><input className="form-control form-control-sm" value={draft.placement === "screen_region" ? `${String(draft.screenId)} / ${String(draft.region)}` : `${String(draft.pageId)} / ${String(draft.panelId)}`} disabled /></div><div className="col-md-4"><label className="form-label small">Load order</label><input type="number" min={0} className="form-control form-control-sm" value={Number(draft.loadOrder ?? 0)} onChange={(event) => set("loadOrder", Math.max(0, Number(event.target.value)))} /></div><RecordEditor label="Props" value={record(draft.props)} onChange={(value) => set("props", value)} /><BindingEditor value={record(draft.bindings)} options={bindingOptions} onChange={(value) => set("bindings", value)} /></>}
        </div>

        {object.objectType !== "SCREEN" && <div className="d-flex justify-content-end mt-3"><button className="btn btn-primary" disabled={busy} onClick={() => void save()}><Save size={15} className="me-1" />Save properties</button></div>}
      </div>
    </div>
  );
}
