"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, RefreshCw, Smartphone, Tablet, X } from "lucide-react";
import { HtmlTemplateComponent } from "@/components/shared/HtmlTemplateComponent";
import { COMPONENT_REGISTRY } from "@/lib/engine/ComponentRegistry";
import type { HtmlStudioDocument } from "@/lib/html-studio";
import { resolveComponentProps } from "@/lib/runtime/resolveComponentBindings";
import {
  LifecycleRunner,
  type LifecycleAdapter,
  type LifecycleTraceEvent,
} from "@/lib/runtime/lifecycleRunner";
import type {
  AppComponentInstanceDefinition,
  JsonValue,
  MenuActionDefinition,
  PageDefinition,
  ScreenDefinition,
  TemplateDefinition,
} from "@/lib/template/contracts";
import type { ComponentType } from "@/types";

type Device = "desktop" | "tablet" | "mobile";

function PreviewInstance({
  instance,
  definition,
  data,
}: {
  instance: AppComponentInstanceDefinition;
  definition: TemplateDefinition;
  data: Record<string, JsonValue>;
}) {
  const props = resolveComponentProps(instance, data);
  if (instance.source === "reusable") {
    const reusable = definition.components.find((item) => item.id === instance.componentId);
    if (!reusable) return <div className="alert alert-warning py-2">Missing {instance.componentId}</div>;
    if (reusable.componentType === "html") {
      const document = reusable.definition.document as unknown as HtmlStudioDocument | undefined;
      return <HtmlTemplateComponent
        {...props}
        document={document}
        componentRegistry={COMPONENT_REGISTRY}
      />;
    }
    const standardType = String(reusable.definition.standardType ?? "CardComponent");
    const Target = COMPONENT_REGISTRY[standardType as ComponentType];
    return Target ? <Target {...props} /> : <div className="alert alert-warning py-2">Missing {standardType}</div>;
  }
  const Target = COMPONENT_REGISTRY[instance.standardType as ComponentType];
  return Target
    ? <Target {...props} />
    : <div className="alert alert-warning py-2">Missing {instance.standardType}</div>;
}

const instancesForRegion = (
  definition: TemplateDefinition,
  screen: ScreenDefinition,
  region: string,
) => definition.componentInstances
  .filter((instance) =>
    instance.placement === "screen_region" &&
    instance.screenId === screen.id &&
    instance.region === region,
  )
  .sort((left, right) => left.loadOrder - right.loadOrder);

const instancesForPanel = (
  definition: TemplateDefinition,
  page: PageDefinition,
  panelId: string,
) => definition.componentInstances
  .filter((instance) =>
    instance.placement === "page_panel" &&
    instance.pageId === page.id &&
    instance.panelId === panelId,
  )
  .sort((left, right) => left.loadOrder - right.loadOrder);

export function TemplateRuntimePreview({
  templateId,
  onClose,
}: {
  readonly templateId: string;
  readonly onClose: () => void;
}) {
  const [definition, setDefinition] = useState<TemplateDefinition | null>(null);
  const [screen, setScreen] = useState<ScreenDefinition | null>(null);
  const [page, setPage] = useState<PageDefinition | null>(null);
  const [pageData, setPageData] = useState<Record<string, JsonValue>>({});
  const [device, setDevice] = useState<Device>("desktop");
  const [activeRouteId, setActiveRouteId] = useState("");
  const [activePopupId, setActivePopupId] = useState("");
  const [trace, setTrace] = useState<LifecycleTraceEvent[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const runnerRef = useRef<LifecycleRunner | null>(null);
  const definitionRef = useRef<TemplateDefinition | null>(null);

  const navigate = useCallback(async (
    routeId: string,
    source = definitionRef.current,
  ) => {
    if (!source) return;
    setBusy(true);
    setActivePopupId("");
    setTrace([]);
    const adapter: LifecycleAdapter = {
      emit: (event) => setTrace((current) => [...current, event]),
      runScreenStep: async () => undefined,
      loadCollection: async () => [],
      prepareScreenComponent: async () => undefined,
      prepareComponent: async () => undefined,
    };
    const runner = new LifecycleRunner(
      source,
      `preview:${templateId}`,
      `draft:${source.template.editVersion}`,
      adapter,
    );
    runnerRef.current = runner;
    const result = await runner.navigateRoute(routeId);
    if (result.status === "ready") {
      setActiveRouteId(routeId);
      setScreen(source.screens.find((item) => item.id === result.screen.screenId) ?? null);
      setPage(source.pages.find((item) => item.id === result.page.pageId) ?? null);
      setPageData(result.page.data);
      setError("");
    } else if (result.status === "error") {
      setError(`Lifecycle failed: ${result.failure.phase} / ${result.failure.objectId}`);
    }
    setBusy(false);
  }, [templateId]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/templates/${templateId}/preview`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          const details = Array.isArray(body.issues)
            ? body.issues.map((issue: { path?: string; message?: string }) => `${issue.path}: ${issue.message}`).join("\n")
            : body.error;
          throw new Error(details ?? "Preview unavailable");
        }
        if (!active) return;
        const next = body.definition as TemplateDefinition;
        definitionRef.current = next;
        setDefinition(next);
        const route = next.routes.find((item) => item.isDefault) ?? next.routes[0];
        if (!route) throw new Error("Template has no Route");
        await navigate(route.id, next);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Preview unavailable");
          setBusy(false);
        }
      });
    return () => {
      active = false;
      runnerRef.current?.cancel();
    };
  }, [navigate, templateId]);

  const runMenuAction = async (action: MenuActionDefinition) => {
    const source = definitionRef.current;
    if (!source) return;
    if (action.type === "navigate_route") {
      await navigate(action.routeId, source);
      return;
    }
    if (action.type === "open_popup") {
      setActivePopupId(action.popupId);
      return;
    }
    const runner = runnerRef.current;
    if (!runner) return;
    setBusy(true);
    setActivePopupId("");
    const result = await runner.changePage(action.pageId, action.params ?? {});
    if (result.status === "ready") {
      setPage(source.pages.find((item) => item.id === result.page.pageId) ?? null);
      setPageData(result.page.data);
      setError("");
    } else if (result.status === "error") {
      setError(`Lifecycle failed: ${result.failure.phase} / ${result.failure.objectId}`);
    }
    setBusy(false);
  };

  const width = device === "mobile" ? 390 : device === "tablet" ? 768 : 1280;
  const columnKey = device;

  return <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark d-flex flex-column" style={{ zIndex: 3100 }}>
    <div className="d-flex align-items-center gap-2 px-3 py-2 text-white border-bottom border-secondary">
      <strong>Draft Lifecycle Preview</strong>
      <span className="small text-white-50">{definition ? `edit v${definition.template.editVersion}` : "loading"}</span>
      {definition && <select className="form-select form-select-sm ms-auto" style={{ width: 220 }} value={activeRouteId} onChange={(event) => void navigate(event.target.value)}>{definition.routes.map((route) => <option key={route.id} value={route.id}>{route.path} · {route.id}</option>)}</select>}
      <div className="btn-group btn-group-sm">
        <button className={`btn ${device === "desktop" ? "btn-light" : "btn-outline-light"}`} onClick={() => setDevice("desktop")}><Monitor size={14} /></button>
        <button className={`btn ${device === "tablet" ? "btn-light" : "btn-outline-light"}`} onClick={() => setDevice("tablet")}><Tablet size={14} /></button>
        <button className={`btn ${device === "mobile" ? "btn-light" : "btn-outline-light"}`} onClick={() => setDevice("mobile")}><Smartphone size={14} /></button>
      </div>
      <button className="btn btn-sm btn-outline-light" disabled={busy || !definition} onClick={() => { const route = definition?.routes.find((item) => item.isDefault) ?? definition?.routes[0]; if (route) void navigate(route.id); }}><RefreshCw size={14} /></button>
      <button className="btn btn-sm btn-outline-light" onClick={onClose}><X size={15} /></button>
    </div>
    <div className="d-flex flex-grow-1 overflow-hidden">
      <main className="flex-grow-1 overflow-auto p-3 bg-secondary bg-opacity-25">
        <div className="bg-white shadow mx-auto min-vh-100 position-relative" style={{ width, maxWidth: "100%", transition: "width .2s" }}>
          {definition && screen && page && <>
            <style>{`${definition.startup.mainCss}\n${screen.css}\n${page.css}`}</style>
            {screen.menu.length > 0 && <nav className="d-flex gap-2 flex-wrap p-2 border-bottom bg-light" aria-label="Preview menu">{screen.menu.map((item) => <button type="button" className="btn btn-sm btn-outline-primary" key={item.id} onClick={() => void runMenuAction(item.action)}>{item.label}</button>)}</nav>}
            <header className="preview-region preview-header p-2 border-bottom" data-screen-region="header">{instancesForRegion(definition, screen, "header").map((instance) => <PreviewInstance key={instance.id} instance={instance} definition={definition} data={pageData} />)}</header>
            <div className="d-flex align-items-stretch" style={{ minHeight: 520 }}>
              <aside className="preview-region preview-left p-2 border-end" style={{ width: device === "mobile" ? 72 : 220 }} data-screen-region="left">{instancesForRegion(definition, screen, "left").map((instance) => <PreviewInstance key={instance.id} instance={instance} definition={definition} data={pageData} />)}</aside>
              <section className="preview-region preview-content p-2 flex-grow-1 min-w-0" data-screen-region="content">
                <div className="row g-2">{[...page.panels].sort((a, b) => a.order - b.order).map((panel) => <div key={panel.id} className={`col-${panel.responsive[columnKey]}`} data-page-panel={panel.id}><div className="border rounded p-2 h-100">{instancesForPanel(definition, page, panel.id).map((instance) => <PreviewInstance key={instance.id} instance={instance} definition={definition} data={pageData} />)}</div></div>)}</div>
                {instancesForRegion(definition, screen, "content").map((instance) => <PreviewInstance key={instance.id} instance={instance} definition={definition} data={pageData} />)}
              </section>
              <aside className="preview-region preview-right p-2 border-start" style={{ width: device === "mobile" ? 72 : 220 }} data-screen-region="right">{instancesForRegion(definition, screen, "right").map((instance) => <PreviewInstance key={instance.id} instance={instance} definition={definition} data={pageData} />)}</aside>
            </div>
            <footer className="preview-region preview-footer p-2 border-top" data-screen-region="footer">{instancesForRegion(definition, screen, "footer").map((instance) => <PreviewInstance key={instance.id} instance={instance} definition={definition} data={pageData} />)}</footer>
            {activePopupId && (() => {
              const popup = definition.popups.find((item) => item.id === activePopupId);
              const popupPage = definition.pages.find((item) => item.id === popup?.pageId);
              return <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center p-4" style={{ zIndex: 2 }} onClick={() => setActivePopupId("")}>
                <section className="bg-white rounded shadow-lg p-3 overflow-auto" style={{ width: "min(760px, 95%)", maxHeight: "85%" }} onClick={(event) => event.stopPropagation()} aria-label="Preview popup">
                  <div className="d-flex align-items-center mb-2"><strong>{popup?.id ?? activePopupId}</strong><button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => setActivePopupId("")}><X size={14} /></button></div>
                  {popupPage ? <div className="row g-2">{[...popupPage.panels].sort((a, b) => a.order - b.order).map((panel) => <div key={panel.id} className={`col-${panel.responsive[columnKey]}`}><div className="border rounded p-2">{instancesForPanel(definition, popupPage, panel.id).map((instance) => <PreviewInstance key={instance.id} instance={instance} definition={definition} data={pageData} />)}</div></div>)}</div> : <div className="alert alert-warning">Popup Page not found</div>}
                </section>
              </div>;
            })()}
          </>}
          {busy && <div className="p-5 text-center">Running lifecycle…</div>}
          {error && <pre className="alert alert-danger m-3 text-wrap">{error}</pre>}
        </div>
      </main>
      <aside className="bg-white border-start overflow-auto p-2" style={{ width: 270 }}>
        <strong className="small">Lifecycle trace</strong>
        {trace.map((event, index) => <div className="small border-start border-primary ps-2 py-1" key={`${event.requestId}:${event.phase}:${index}`}><code>{event.phase}</code><div className="text-muted text-truncate">{event.pageId ?? event.screenId}</div></div>)}
      </aside>
    </div>
  </div>;
}
