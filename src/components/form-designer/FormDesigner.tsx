"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Braces,
  ClipboardList,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { FormComponent } from "@/components/shared/FormComponent";
import type { FieldInputProps } from "@/components/shared/FieldInputComponent";

type ContractItem = {
  id: string;
  key: string;
  label: string;
  source?: string;
  type?: string;
  required?: boolean;
};
type CollectionBinding = {
  collectionId: string;
  alias: string;
  role: "primary" | "lookup";
};
type FormDefinition = {
  schemaVersion: 1;
  title: string;
  description: string;
  submitText: string;
  resetText: string;
  mode: "insert" | "update" | "readOnly";
  fields: FieldInputProps[];
  collectionSet: CollectionBinding[];
  requestContract: ContractItem[];
  responseContract: ContractItem[];
};
type Platform = { id: string; platformName: string; platformSlug: string };
type ComponentDto = {
  id: string;
  platformId: string;
  key: string;
  name: string;
  componentType: string;
  definition: FormDefinition;
  version: number;
  isPublic?: boolean;
};
type PublicComponentDto = Omit<ComponentDto, "version" | "isPublic"> & {
  sourceVersion: number;
  publisherName?: string;
};
type Collection = { id: string; name: string; table?: string };
type Page = { id: string; title: string };

const FIELD_TYPES: Array<{ type: FieldInputProps["type"]; label: string }> = [
  ["text", "ข้อความ"],
  ["number", "ตัวเลข"],
  ["email", "อีเมล"],
  ["password", "รหัสผ่าน"],
  ["date", "วันที่"],
  ["datetime", "วันและเวลา"],
  ["select", "ตัวเลือก"],
  ["collection-select", "Collection Select"],
  ["checkbox", "Checkbox"],
  ["switch", "Switch"],
  ["radio", "Radio"],
  ["textarea", "ข้อความหลายบรรทัด"],
  ["html-editor", "HTML Editor"],
  ["file", "ไฟล์"],
  ["multi-file", "หลายไฟล์"],
  ["tags", "Tags"],
  ["color", "สี"],
].map(([type, label]) => ({ type: type as FieldInputProps["type"], label }));

const emptyDefinition = (): FormDefinition => ({
  schemaVersion: 1,
  title: "ฟอร์มข้อมูลใหม่",
  description: "",
  submitText: "บันทึกข้อมูล",
  resetText: "ล้างค่า",
  mode: "insert",
  fields: [],
  collectionSet: [],
  requestContract: [
    {
      id: crypto.randomUUID(),
      key: "currentUser",
      label: "ผู้ใช้ปัจจุบัน",
      source: "auth.currentUser",
      required: false,
    },
    {
      id: crypto.randomUUID(),
      key: "siteOwner",
      label: "ข้อมูลเจ้าของเว็บไซต์",
      source: "app.owner",
      required: false,
    },
  ],
  responseContract: [
    {
      id: crypto.randomUUID(),
      key: "formData",
      label: "ข้อมูลจากฟอร์ม",
      type: "object",
    },
    {
      id: crypto.randomUUID(),
      key: "submitResult",
      label: "ผลการบันทึก",
      type: "object",
    },
  ],
});

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-|-$/g, "") || `form-${Date.now().toString(36)}`;

export default function FormDesigner() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platformId, setPlatformId] = useState("");
  const [components, setComponents] = useState<ComponentDto[]>([]);
  const [publicComponents, setPublicComponents] = useState<PublicComponentDto[]>([]);
  const [listTab, setListTab] = useState<"mine" | "public">("mine");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [componentId, setComponentId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState("new-form");
  const [formName, setFormName] = useState("ฟอร์มข้อมูลใหม่");
  const [definition, setDefinition] = useState<FormDefinition>(emptyDefinition);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"properties" | "collections">(
    "properties",
  );
  const [targetPage, setTargetPage] = useState("");
  const [status, setStatus] = useState("กำลังโหลด...");
  const [screen, setScreen] = useState<"list" | "designer">("list");

  const field = definition.fields.find((item) => item.name === selectedField);
  const primaryCollection = definition.collectionSet.find(
    (item) => item.role === "primary",
  )?.collectionId;

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/platforms", { cache: "no-store" });
      const data = (await response.json()) as { platforms?: Platform[] };
      const list = data.platforms || [];
      setPlatforms(list);
      const requested = new URLSearchParams(window.location.search).get(
        "platformId",
      );
      const requestedFormId = new URLSearchParams(window.location.search).get(
        "formId",
      );
      let resolvedPlatformId = "";
      if (!requested && requestedFormId && requestedFormId !== "new") {
        const componentResponse = await fetch(
          `/api/platform-components?componentId=${encodeURIComponent(requestedFormId)}`,
          { cache: "no-store" },
        );
        if (componentResponse.ok) {
          const componentData = (await componentResponse.json()) as {
            component?: ComponentDto;
          };
          resolvedPlatformId = componentData.component?.platformId || "";
        }
      }
      const last = localStorage.getItem("matchanu:last-studio-platform-id");
      setPlatformId(
        list.find((item) => item.id === requested)?.id ||
          list.find((item) => item.id === resolvedPlatformId)?.id ||
          list.find((item) => item.id === last)?.id ||
          list[0]?.id ||
          "",
      );
    })();
  }, []);

  useEffect(() => {
    if (!platformId) return;
    void (async () => {
      setStatus("กำลังโหลด Form และ Collection...");
      localStorage.setItem("matchanu:last-studio-platform-id", platformId);
      const promotionResponse = await fetch(
        `/api/platforms/${platformId}/page-components`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "promote-embedded-forms" }),
        },
      );
      if (!promotionResponse.ok) {
        const promotionData = (await promotionResponse.json()) as {
          error?: string;
        };
        setStatus(promotionData.error || "นำเข้า Form เดิมจาก Page ไม่สำเร็จ");
        return;
      }
      const [componentResponse, studioResponse, collectionResponse] = await Promise.all([
        fetch(
          `/api/platform-components?platformId=${encodeURIComponent(platformId)}`,
          { cache: "no-store" },
        ),
        fetch(`/api/platforms/${platformId}/studio`, { cache: "no-store" }),
        fetch(`/api/collection-sets?platformId=${encodeURIComponent(platformId)}`, { cache: "no-store" }),
      ]);
      const componentData = (await componentResponse.json()) as {
        components?: ComponentDto[];
        sharedComponents?: PublicComponentDto[];
        error?: string;
      };
      const studioData = (await studioResponse.json()) as {
        platform?: {
          studioCollections?: Collection[];
          studioPages?: Page[];
        };
        error?: string;
      };
      const collectionData = (await collectionResponse.json()) as {
        collections?: Array<{ id: string; key: string; name: string; definition: { table?: string } }>;
      };
      if (!componentResponse.ok || !studioResponse.ok) {
        setStatus(componentData.error || studioData.error || "โหลดข้อมูลไม่สำเร็จ");
        return;
      }
      const forms = (componentData.components || []).filter(
        (item) => item.componentType === "FormComponent",
      );
      setComponents(forms);
      setPublicComponents(
        (componentData.sharedComponents || []).filter(
          (item) => item.componentType === "FormComponent",
        ),
      );
      const collectionSetItems = (collectionData.collections || []).map((item) => ({ id: item.key, name: item.name, table: item.definition.table }));
      setCollections(Array.from(new Map([...(studioData.platform?.studioCollections || []), ...collectionSetItems].map((item) => [item.id, item])).values()));
      setPages(studioData.platform?.studioPages || []);
      setTargetPage(studioData.platform?.studioPages?.[0]?.id || "");
      const requested = new URLSearchParams(window.location.search).get(
        "formId",
      );
      const selected = requested
        ? forms.find((item) => item.id === requested || item.key === requested)
        : undefined;
      if (selected) {
        setScreen("designer");
        setComponentId(selected.id);
        setFormKey(selected.key);
        setFormName(selected.name);
        setDefinition({
          ...emptyDefinition(),
          ...structuredClone(selected.definition),
        });
        setSelectedField(null);
      } else if (requested === "new") {
        setScreen("designer");
        setComponentId(null);
        setFormKey(`form-${crypto.randomUUID().slice(0, 8)}`);
        setFormName("ฟอร์มข้อมูลใหม่");
        setDefinition(emptyDefinition());
        setSelectedField(null);
      } else {
        setScreen("list");
        setComponentId(null);
        setSelectedField(null);
      }
      setStatus("พร้อมออกแบบ");
    })();
  }, [platformId]);

  const selectForm = (component: ComponentDto) => {
    setComponentId(component.id);
    setFormKey(component.key);
    setFormName(component.name);
    setDefinition({ ...emptyDefinition(), ...structuredClone(component.definition) });
    setSelectedField(null);
    setScreen("designer");
    router.push(
      `/form-designer?formId=${encodeURIComponent(component.id)}`,
    );
  };

  const publishForm = async (component: ComponentDto) => {
    setStatus("กำลังเผยแพร่ฟอร์ม...");
    const response = await fetch("/api/platform-components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish", platformId, componentId: component.id }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) return setStatus(data.error || "เผยแพร่ฟอร์มไม่สำเร็จ");
    setComponents((current) => current.map((item) => item.id === component.id ? { ...item, isPublic: true } : item));
    setStatus("เผยแพร่ฟอร์มเวอร์ชันนี้แล้ว");
  };

  const clonePublicForm = async (component: PublicComponentDto) => {
    setStatus("กำลัง Clone ฟอร์ม...");
    const response = await fetch("/api/platform-components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clone-shared", platformId, sharedComponentId: component.id }),
    });
    const data = (await response.json()) as { component?: ComponentDto; error?: string };
    if (!response.ok || !data.component) return setStatus(data.error || "Clone ฟอร์มไม่สำเร็จ");
    setComponents((current) => [data.component!, ...current]);
    setListTab("mine");
    setStatus("Clone เข้า Form ของฉันแล้ว");
  };

  const newForm = () => {
    setComponentId(null);
    setFormKey(`form-${crypto.randomUUID().slice(0, 8)}`);
    setFormName("ฟอร์มข้อมูลใหม่");
    setDefinition(emptyDefinition());
    setSelectedField(null);
    setScreen("designer");
    window.history.pushState(
      {},
      "",
      `/form-designer?platformId=${encodeURIComponent(platformId)}&formId=new`,
    );
  };

  const updateDefinition = (changes: Partial<FormDefinition>) =>
    setDefinition((current) => ({ ...current, ...changes }));

  const addField = (type: FieldInputProps["type"], label: string) => {
    const prefix = String(type || "field").replace(/-/g, "_");
    let sequence = definition.fields.length + 1;
    while (definition.fields.some((item) => item.name === `${prefix}_${sequence}`))
      sequence += 1;
    const name = `${prefix}_${sequence}`;
    const next: FieldInputProps = {
      name,
      label,
      type,
      placeholder: "",
      required: false,
      ...(type === "select" || type === "radio"
        ? { options: [{ label: "ตัวเลือก 1", value: "1" }] }
        : {}),
    };
    updateDefinition({ fields: [...definition.fields, next] });
    setSelectedField(name);
  };

  const updateField = (changes: Partial<FieldInputProps>) => {
    if (!field) return;
    const nextName = changes.name || field.name;
    updateDefinition({
      fields: definition.fields.map((item) =>
        item.name === field.name ? { ...item, ...changes } : item,
      ),
    });
    setSelectedField(nextName);
  };

  const save = async () => {
    if (!platformId || !formName.trim()) return;
    setStatus("กำลังบันทึก...");
    const payload = {
      platformId,
      key: slugify(formKey),
      name: formName.trim(),
      componentType: "FormComponent",
      definition,
      ...(componentId ? { componentId } : {}),
    };
    const response = await fetch("/api/platform-components", {
      method: componentId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as {
      component?: ComponentDto;
      error?: string;
    };
    if (!response.ok || !data.component) {
      setStatus(data.error || "บันทึก Form ไม่สำเร็จ");
      return;
    }
    setComponentId(data.component.id);
    window.history.replaceState(
      {},
      "",
      `/form-designer?formId=${encodeURIComponent(data.component.id)}`,
    );
    setComponents((current) => [
      data.component!,
      ...current.filter((item) => item.id !== data.component?.id),
    ]);
    setStatus(`บันทึกแล้ว · version ${data.component.version}`);
  };

  const addInstance = async () => {
    if (!componentId) {
      setStatus("กรุณาบันทึก Form ก่อนเพิ่มลง Page");
      return;
    }
    if (!targetPage) return;
    setStatus("กำลังสร้าง Form instance...");
    const response = await fetch(
      `/api/platforms/${platformId}/page-components`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: targetPage,
          componentId,
          layoutRegion: "content",
          requestBindings: Object.fromEntries(
            definition.requestContract
              .filter((item) => item.key && item.source)
              .map((item) => [item.key, item.source]),
          ),
          responseBindings: Object.fromEntries(
            definition.responseContract
              .filter((item) => item.key)
              .map((item) => [item.key, item.source || item.key]),
          ),
        }),
      },
    );
    const data = (await response.json()) as {
      instance?: { instanceKey: string };
      error?: string;
    };
    setStatus(
      response.ok && data.instance
        ? `เพิ่ม instance ${data.instance.instanceKey} ลง Page แล้ว`
        : data.error || "เพิ่ม instance ไม่สำเร็จ",
    );
  };

  const toggleCollection = (collection: Collection, enabled: boolean) => {
    const remaining = definition.collectionSet.filter(
      (item) => item.collectionId !== collection.id,
    );
    if (!enabled) {
      if (remaining.length && !remaining.some((item) => item.role === "primary"))
        remaining[0] = { ...remaining[0], role: "primary" };
      updateDefinition({ collectionSet: remaining });
      return;
    }
    updateDefinition({
      collectionSet: [
        ...remaining,
        {
          collectionId: collection.id,
          alias: collection.id.replace(/[^a-z0-9]/gi, "_"),
          role: remaining.length ? "lookup" : "primary",
        },
      ],
    });
  };

  const setPrimary = (collectionId: string) =>
    updateDefinition({
      collectionSet: definition.collectionSet.map((item) => ({
        ...item,
        role: item.collectionId === collectionId ? "primary" : "lookup",
      })),
    });

  const updateContract = (
    kind: "requestContract" | "responseContract",
    id: string,
    changes: Partial<ContractItem>,
  ) =>
    updateDefinition({
      [kind]: definition[kind].map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    });

  const previewFields = useMemo(
    () => definition.fields.map((item) => ({ ...item, disabled: true })),
    [definition.fields],
  );

  if (screen === "list") {
    return (
      <div
        className="d-flex flex-column bg-light"
        style={{ minHeight: "calc(100vh - 64px)" }}
      >
        <header className="bg-white border-bottom px-4 py-3 d-flex align-items-center gap-3">
          <a href="/admin" className="btn btn-sm btn-outline-secondary">
            <ArrowLeft size={14} /> กลับ
          </a>
          <ClipboardList size={22} className="text-primary" />
          <div>
            <h2 className="h5 mb-0">ฟอร์มข้อมูลของฉัน</h2>
            <div className="small text-secondary">
              FormComponent ส่วนตัวใน Platform ที่เลือก
            </div>
          </div>
          <select
            className="form-select form-select-sm ms-auto"
            style={{ width: 260 }}
            value={platformId}
            onChange={(event) => {
              const nextPlatformId = event.target.value;
              localStorage.setItem(
                "matchanu:last-studio-platform-id",
                nextPlatformId,
              );
              setPlatformId(nextPlatformId);
              setScreen("list");
              router.push(
                `/form-designer?platformId=${encodeURIComponent(nextPlatformId)}`,
              );
            }}
          >
            {platforms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.platformName}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={newForm}>
            <Plus size={16} /> สร้างฟอร์มใหม่
          </button>
        </header>

        <main className="container-fluid px-4 py-4">
          <div className="d-flex align-items-center border-bottom mb-3">
            <button className={`btn rounded-0 border-0 border-bottom border-3 ${listTab === "mine" ? "border-primary text-primary fw-bold" : "border-transparent text-secondary"}`} onClick={() => setListTab("mine")}>
              ฟอร์มของฉัน <span className="badge text-bg-secondary ms-1">{components.length}</span>
            </button>
            <button className={`btn rounded-0 border-0 border-bottom border-3 ${listTab === "public" ? "border-primary text-primary fw-bold" : "border-transparent text-secondary"}`} onClick={() => setListTab("public")}>
              ฟอร์มสาธารณะ <span className="badge text-bg-secondary ms-1">{publicComponents.length}</span>
            </button>
            <span className="small text-success ms-auto">{status}</span>
          </div>

          {(listTab === "mine" ? components : publicComponents).length ? (
            <div className="bg-white border rounded shadow-sm overflow-hidden">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>ชื่อฟอร์ม</th>
                      <th>Form ID</th>
                      <th className="text-center">Fields</th>
                      <th className="text-center">Version</th>
                      {listTab === "public" && <th>สร้างโดย</th>}
                      <th className="text-end">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(listTab === "mine" ? components : publicComponents).map((component) => (
                      <tr key={component.id}>
                        <td>
                          <div className="fw-semibold">{component.name}</div>
                          <div className="small text-secondary">
                            {component.definition.title || "ไม่มีหัวข้อ"}
                          </div>
                        </td>
                        <td>
                          <code>{component.key}</code>
                        </td>
                        <td className="text-center">
                          {component.definition.fields?.length || 0}
                        </td>
                        <td className="text-center">v{"version" in component ? component.version : component.sourceVersion}</td>
                        {listTab === "public" && <td>{"publisherName" in component ? component.publisherName || "-" : "-"}</td>}
                        <td className="text-end">
                          {listTab === "mine" ? <div className="d-flex justify-content-end gap-2">
                            <button className="btn btn-sm btn-outline-secondary" disabled={(component as ComponentDto).isPublic} onClick={() => void publishForm(component as ComponentDto)}>
                              {(component as ComponentDto).isPublic ? "Public แล้ว" : "ตั้งเป็น Public"}
                            </button>
                            <button className="btn btn-sm btn-outline-primary" onClick={() => selectForm(component as ComponentDto)}>แก้ไขฟอร์ม</button>
                          </div> : <button className="btn btn-sm btn-primary" onClick={() => void clonePublicForm(component as PublicComponentDto)}>Clone เข้า Form ของฉัน</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border rounded p-5 text-center shadow-sm">
              <ClipboardList size={42} className="text-secondary mb-3" />
              <h3 className="h5">{listTab === "mine" ? "ยังไม่มีฟอร์มของฉัน" : "ยังไม่มีฟอร์มสาธารณะจากผู้ใช้อื่น"}</h3>
              <p className="text-secondary">
                {listTab === "mine" ? "สร้าง FormComponent แรกสำหรับ Platform นี้" : "เมื่อผู้ใช้อื่นตั้งฟอร์มเป็น Public จะแสดงที่นี่"}
              </p>
              {listTab === "mine" && <button className="btn btn-primary" onClick={newForm}>
                <Plus size={16} /> สร้างฟอร์มใหม่
              </button>}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div
      className="d-flex flex-column bg-light"
      style={{ height: "calc(100vh - 64px)" }}
    >
      <header className="bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2">
        <a
          href={`/form-designer?platformId=${encodeURIComponent(platformId)}`}
          className="btn btn-sm btn-outline-secondary"
        >
          <ArrowLeft size={14} /> รายการฟอร์ม
        </a>
        <ClipboardList size={20} className="text-primary" />
        <strong>ออกแบบฟอร์มข้อมูล</strong>
        <select
          className="form-select form-select-sm ms-3"
          style={{ width: 230 }}
          value={platformId}
          onChange={(event) => setPlatformId(event.target.value)}
        >
          {platforms.map((item) => (
            <option key={item.id} value={item.id}>
              {item.platformName}
            </option>
          ))}
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: 240 }}
          value={componentId || ""}
          onChange={(event) => {
            const selected = components.find(
              (item) => item.id === event.target.value,
            );
            if (selected) selectForm(selected);
          }}
        >
          <option value="">Form ใหม่</option>
          {components.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · v{item.version}
            </option>
          ))}
        </select>
        <button className="btn btn-sm btn-outline-primary" onClick={newForm}>
          <Plus size={14} /> Form ใหม่
        </button>
        <span className="small text-success ms-auto">{status}</span>
        <select
          className="form-select form-select-sm"
          style={{ width: 190 }}
          value={targetPage}
          onChange={(event) => setTargetPage(event.target.value)}
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title}
            </option>
          ))}
        </select>
        <button className="btn btn-sm btn-outline-success" onClick={addInstance}>
          <Plus size={14} /> เพิ่มลง Page
        </button>
        <button className="btn btn-sm btn-success" onClick={() => void save()}>
          <Save size={14} /> บันทึก Form
        </button>
      </header>

      <div
        className="d-grid flex-grow-1 position-relative overflow-hidden"
        style={{ gridTemplateColumns: "270px minmax(0,1fr) 300px" }}
      >
        <aside className="bg-white border-end p-3 overflow-auto pb-5">
          <div className="btn-group btn-group-sm w-100 mb-3">
            <button
              className={`btn ${leftTab === "properties" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setLeftTab("properties")}
            >
              คุณสมบัติฟอร์ม
            </button>
            <button
              className={`btn ${leftTab === "collections" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setLeftTab("collections")}
            >
              Collection Set
            </button>
          </div>
          {leftTab === "properties" ? (
            <>
              <label className="form-label small">Form ID</label>
              <input
                className="form-control form-control-sm mb-2 font-monospace"
                value={formKey}
                disabled={Boolean(componentId)}
                onChange={(event) => setFormKey(event.target.value)}
              />
              <label className="form-label small">ชื่อแม่แบบ</label>
              <input
                className="form-control form-control-sm mb-2"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
              />
              <label className="form-label small">หัวข้อฟอร์ม</label>
              <input
                className="form-control form-control-sm mb-2"
                value={definition.title}
                onChange={(event) =>
                  updateDefinition({ title: event.target.value })
                }
              />
              <label className="form-label small">คำอธิบาย</label>
              <textarea
                className="form-control form-control-sm mb-2"
                value={definition.description}
                onChange={(event) =>
                  updateDefinition({ description: event.target.value })
                }
              />
              <div className="small fw-bold mt-3 mb-2">REQ · รับค่าจากภายนอก</div>
              {definition.requestContract.map((item) => (
                <div key={item.id} className="border rounded p-2 mb-2 bg-light">
                  <input
                    className="form-control form-control-sm mb-1 font-monospace"
                    value={item.key}
                    onChange={(event) =>
                      updateContract("requestContract", item.id, {
                        key: event.target.value,
                      })
                    }
                  />
                  <input
                    className="form-control form-control-sm mb-1"
                    value={item.source || ""}
                    placeholder="เช่น auth.currentUser"
                    onChange={(event) =>
                      updateContract("requestContract", item.id, {
                        source: event.target.value,
                      })
                    }
                  />
                  <label className="small">
                    <input
                      type="checkbox"
                      className="form-check-input me-1"
                      checked={Boolean(item.required)}
                      onChange={(event) =>
                        updateContract("requestContract", item.id, {
                          required: event.target.checked,
                        })
                      }
                    />
                    จำเป็น
                  </label>
                </div>
              ))}
              <button
                className="btn btn-sm btn-outline-primary w-100"
                onClick={() =>
                  updateDefinition({
                    requestContract: [
                      ...definition.requestContract,
                      {
                        id: crypto.randomUUID(),
                        key: "input",
                        label: "Input",
                        source: "page.context",
                      },
                    ],
                  })
                }
              >
                <Plus size={13} /> เพิ่ม Request
              </button>
              <div className="small fw-bold mt-3 mb-2">RESPONSE · ส่งกลับให้ Page</div>
              {definition.responseContract.map((item) => (
                <div key={item.id} className="border rounded p-2 mb-2 bg-light">
                  <input
                    className="form-control form-control-sm mb-1 font-monospace"
                    value={item.key}
                    onChange={(event) =>
                      updateContract("responseContract", item.id, {
                        key: event.target.value,
                      })
                    }
                  />
                  <input
                    className="form-control form-control-sm"
                    value={item.type || "object"}
                    onChange={(event) =>
                      updateContract("responseContract", item.id, {
                        type: event.target.value,
                      })
                    }
                  />
                </div>
              ))}
              <button
                className="btn btn-sm btn-outline-primary w-100"
                onClick={() =>
                  updateDefinition({
                    responseContract: [
                      ...definition.responseContract,
                      {
                        id: crypto.randomUUID(),
                        key: "result",
                        label: "Result",
                        type: "object",
                      },
                    ],
                  })
                }
              >
                <Plus size={13} /> เพิ่ม Response
              </button>
            </>
          ) : (
            <>
              <div className="small text-secondary mb-2">
                เลือกได้มากกว่า 1 Collection และต้องมีตัวหลักหนึ่งรายการ
              </div>
              {collections.map((collection) => {
                const binding = definition.collectionSet.find(
                  (item) => item.collectionId === collection.id,
                );
                return (
                  <div key={collection.id} className="border rounded p-2 mb-2">
                    <label className="d-flex gap-2 align-items-start">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={Boolean(binding)}
                        onChange={(event) =>
                          toggleCollection(collection, event.target.checked)
                        }
                      />
                      <span>
                        <b className="small">{collection.name}</b>
                        <code className="d-block small">{collection.id}</code>
                      </span>
                    </label>
                    {binding && (
                      <label className="small mt-1">
                        <input
                          type="radio"
                          name="primary-collection"
                          className="form-check-input me-1"
                          checked={primaryCollection === collection.id}
                          onChange={() => setPrimary(collection.id)}
                        />
                        Collection หลัก
                      </label>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </aside>

        <main className="overflow-auto p-4" style={{ paddingBottom: 300 }}>
          <div className="mx-auto" style={{ maxWidth: 850 }}>
            <FormComponent
              formId={formKey}
              collectionId={primaryCollection}
              title={definition.title}
              description={definition.description}
              fields={previewFields}
              submitText={definition.submitText}
              resetText={definition.resetText}
              mode={definition.mode}
            />
            <div className="mt-3 d-flex flex-column gap-2">
              {definition.fields.map((item, index) => (
                <button
                  key={item.name}
                  className={`btn text-start border ${selectedField === item.name ? "border-primary bg-primary-subtle" : "bg-white"}`}
                  onClick={() => setSelectedField(item.name)}
                >
                  {index + 1}. {item.label || item.name} <code>{item.name}</code>
                </button>
              ))}
            </div>
          </div>
        </main>

        <aside className="bg-white border-start p-3 overflow-auto">
          <div className="fw-bold mb-2">Field ทุกประเภท</div>
          <div className="row g-2">
            {FIELD_TYPES.map((item) => (
              <div className="col-12" key={item.type}>
                <button
                  className="btn btn-sm btn-outline-primary w-100 text-start"
                  onClick={() => addField(item.type, item.label)}
                >
                  <Plus size={13} /> {item.label}
                  <code className="float-end">{item.type}</code>
                </button>
              </div>
            ))}
          </div>
        </aside>

        {field && (
          <section
            className="position-absolute bottom-0 bg-white border border-2 border-primary shadow-lg p-3 overflow-auto"
            style={{ left: 270, right: 300, height: 280, zIndex: 5 }}
          >
            <div className="d-flex align-items-center mb-3">
              <Braces size={16} className="text-primary me-2" />
              <b>คุณสมบัติ Field</b>
              <code className="ms-2">{field.name}</code>
              <button
                className="btn btn-sm btn-outline-danger ms-auto"
                onClick={() => {
                  updateDefinition({
                    fields: definition.fields.filter(
                      (item) => item.name !== field.name,
                    ),
                  });
                  setSelectedField(null);
                }}
              >
                <Trash2 size={13} /> ลบ Field
              </button>
            </div>
            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label small">ชื่อ Field</label>
                <input
                  className="form-control form-control-sm font-monospace"
                  value={field.name}
                  onChange={(event) =>
                    updateField({
                      name: event.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                    })
                  }
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Label</label>
                <input
                  className="form-control form-control-sm"
                  value={field.label || ""}
                  onChange={(event) => updateField({ label: event.target.value })}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Placeholder</label>
                <input
                  className="form-control form-control-sm"
                  value={field.placeholder || ""}
                  onChange={(event) =>
                    updateField({ placeholder: event.target.value })
                  }
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small d-block">Validation</label>
                <label className="small me-3">
                  <input
                    type="checkbox"
                    className="form-check-input me-1"
                    checked={Boolean(field.required)}
                    onChange={(event) =>
                      updateField({ required: event.target.checked })
                    }
                  />
                  Required
                </label>
                <label className="small">
                  <input
                    type="checkbox"
                    className="form-check-input me-1"
                    checked={Boolean(field.disabled)}
                    onChange={(event) =>
                      updateField({ disabled: event.target.checked })
                    }
                  />
                  Disabled
                </label>
              </div>
              <div className="col-md-8">
                <label className="form-label small">Help text</label>
                <input
                  className="form-control form-control-sm"
                  value={field.helpText || ""}
                  onChange={(event) =>
                    updateField({ helpText: event.target.value })
                  }
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
