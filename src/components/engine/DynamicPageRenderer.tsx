"use client";

import React, { useMemo } from "react";
import {
  ComponentNode,
  ComponentType,
  PageStyleSheet,
  ThemeConfig,
} from "@/types";
import { COMPONENT_REGISTRY } from "@/lib/engine/ComponentRegistry";
import { ThemeEngine } from "@/components/shared/ThemeEngine";
import { compilePageStyleSheet } from "@/lib/engine/pageStyleSheet";

/**
 * Semantic element used to wrap each component type.
 *
 * Crawlers and assistive technology rely on landmarks, so a nav renders inside
 * <nav> and body content inside <section> rather than a wall of <div>.
 * A node can override this with `props.semanticTag`.
 */
const SEMANTIC_TAG: Partial<
  Record<ComponentType, keyof React.JSX.IntrinsicElements>
> = {
  NavMenuComponent: "header",
  SlideMenuComponent: "nav",
  EditMenuComponent: "nav",
  DynamicHtmlComponent: "section",
  HtmlTemplateComponent: "section",
  HtmlEditorComponent: "section",
  GalleryComponent: "section",
  TableDataComponent: "section",
  DataTableComponent: "section",
  ListComponent: "section",
  PostListComponent: "section",
  CardComponent: "article",
  ChartComponent: "figure",
  FormComponent: "section",
  FileManagerComponent: "section",
};

const ALLOWED_SEMANTIC_TAGS = new Set([
  "header",
  "nav",
  "section",
  "article",
  "aside",
  "footer",
  "figure",
  "div",
  "main",
]);

function semanticTagFor(
  node: ComponentNode,
): keyof React.JSX.IntrinsicElements {
  const requested = node.props?.semanticTag;
  if (typeof requested === "string" && ALLOWED_SEMANTIC_TAGS.has(requested)) {
    return requested as keyof React.JSX.IntrinsicElements;
  }
  return SEMANTIC_TAG[node.type] ?? "div";
}

export interface DynamicPageRendererProps {
  nodes: ComponentNode[];
  themeConfig?: ThemeConfig;
  onActionTrigger?: (actionId: string, payload?: any) => void;
  isDesignMode?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  /**
   * Landmark used for the renderer root. A page renders one `main`; secondary
   * renders (a sidebar, a detail pane) must pass something else so the document
   * never contains nested or duplicate landmarks.
   */
  rootTag?: "main" | "div" | "nav" | "section" | "aside";
  styleSheet?: PageStyleSheet;
  layoutRegion?: string;
  layoutRegions?: Record<string, boolean>;
}

const PAGE_LAYOUT_REGIONS = [
  "top",
  "sidebar-left",
  "content",
  "sidebar-right",
  "footer",
] as const;
type PageLayoutRegion = (typeof PAGE_LAYOUT_REGIONS)[number];

function pageLayoutRegionFor(
  node: ComponentNode,
): PageLayoutRegion | undefined {
  const value =
    typeof node.props?.__layoutRegion === "string"
      ? node.props.__layoutRegion
      : typeof node.props?.__sectionId === "string"
        ? node.props.__sectionId
        : undefined;
  return PAGE_LAYOUT_REGIONS.includes(value as PageLayoutRegion)
    ? (value as PageLayoutRegion)
    : undefined;
}

export const DynamicNodeItem: React.FC<{
  node: ComponentNode;
  onActionTrigger?: (actionId: string, payload?: any) => void;
  isDesignMode?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
}> = ({
  node,
  onActionTrigger,
  isDesignMode,
  selectedNodeId,
  onSelectNode,
}) => {
  const TargetComponent = COMPONENT_REGISTRY[node.type];
  const configuredPreset =
    typeof node.props?.stylePreset === "string" ? node.props.stylePreset : "";
  const legacyMunicipalPreset =
    node.id.startsWith("municipal_") &&
    typeof node.props?.__sectionId === "string"
      ? `municipal-${node.props.__sectionId}`
      : "";
  const candidatePreset = configuredPreset || legacyMunicipalPreset;
  // `municipal-*` styles a section; `gov-band-*` gives it its own ground. Both
  // are allow-listed rather than passed through, so a page cannot inject a class.
  const stylePreset = /^(?:municipal|gov-band)-[a-z0-9-]+$/.test(
    candidatePreset,
  )
    ? candidatePreset
    : "";

  if (!TargetComponent) {
    return (
      <div className="alert alert-warning my-2">
        Unknown Component Type: <strong>{node.type}</strong>
      </div>
    );
  }

  const isSelected = isDesignMode && selectedNodeId === node.id;

  const handleClick = (e: React.MouseEvent) => {
    if (isDesignMode && onSelectNode) {
      e.stopPropagation();
      onSelectNode(node.id);
    }
  };

  // Merge callbacks with props
  const propsWithActions = {
    ...node.props,
    componentRegistry: COMPONENT_REGISTRY,
    onSubmit: async (data: any, requestValues?: Record<string, any>) => {
      const result = node.props?.onSubmit
        ? await node.props.onSubmit(data, requestValues)
        : undefined;
      if (node.actionTriggerId && onActionTrigger) {
        onActionTrigger(node.actionTriggerId, data);
      }
      return result;
    },
    onOperation: async (operationId: string, data: any, requestValues?: Record<string, any>) => {
      const result = node.props?.onOperation
        ? await node.props.onOperation(operationId, data, requestValues)
        : undefined;
      if (onActionTrigger) {
        onActionTrigger(operationId, {
          formData: data,
          requestValues,
          componentId: node.id,
          collectionId: node.props?.collectionId,
          formId: node.props?.formId,
        });
      }
      return result;
    },
    onResponse: (response: any) => {
      if (node.props?.onResponse) node.props.onResponse(response);
      if (onActionTrigger) {
        onActionTrigger(`${node.id}.response`, response);
      }
    },
    onRowClick: (row: any) => {
      if (node.props?.onRowClick) node.props.onRowClick(row);
      if (node.actionTriggerId && onActionTrigger) {
        onActionTrigger(node.actionTriggerId, row);
      }
    },
    onAction: (actionId: string, row?: any) => {
      if (node.props?.onAction) node.props.onAction(actionId, row);
      if (onActionTrigger)
        onActionTrigger(actionId, {
          row,
          componentId: node.id,
          collectionId: node.props?.collectionId,
          formId: node.props?.formId,
        });
    },
    onSelect: (item: any) => {
      if (node.props?.onSelect) node.props.onSelect(item);
      if (onActionTrigger) {
        onActionTrigger("menu.select", item);
        return;
      }
      if (
        !isDesignMode &&
        item?.action?.type === "openExternal" &&
        item.action.url
      ) {
        if (item.action.newTab !== false)
          window.open(item.action.url, "_blank", "noopener,noreferrer");
        else window.location.assign(item.action.url);
      } else if (
        !isDesignMode &&
        !item?.action &&
        typeof item?.href === "string" &&
        item.href.trim()
      ) {
        const href = item.href.trim();
        if (/^https?:\/\//i.test(href))
          window.open(href, "_blank", "noopener,noreferrer");
        else window.location.assign(href);
      }
    },
  };

  const Wrapper = semanticTagFor(node);
  const ariaLabel =
    typeof node.props?.ariaLabel === "string"
      ? node.props.ariaLabel
      : Wrapper === "nav" && typeof node.props?.title === "string"
        ? node.props.title
        : undefined;

  return (
    <Wrapper
      id={node.htmlId || node.id}
      data-component-instance-id={node.id}
      aria-label={ariaLabel}
      className={`dynamic-node-wrapper position-relative ${stylePreset ? (stylePreset.startsWith("gov-band-") ? `gov-band ${stylePreset}` : `municipal-component ${stylePreset}`) : ""} ${
        isDesignMode ? "cursor-pointer hover-outline transition" : ""
      } ${isSelected ? "border border-2 border-primary rounded p-1 shadow-sm" : ""}`}
      style={node.style || {}}
      onClick={handleClick}
    >
      {isDesignMode && (
        <div
          className={`badge position-absolute top-0 end-0 m-1 z-3 ${
            isSelected
              ? "bg-primary text-white"
              : "bg-dark text-white opacity-75"
          }`}
          style={{ fontSize: "10px" }}
        >
          {node.type}
        </div>
      )}

      {/* Render Component */}
      <TargetComponent {...propsWithActions}>
        {/* Recursive rendering of children if any */}
        {node.children && node.children.length > 0 && (
          <div className="dynamic-children-container d-flex flex-column gap-3 mt-3">
            {node.children.map((childNode) => (
              <DynamicNodeItem
                key={childNode.id}
                node={childNode}
                onActionTrigger={onActionTrigger}
                isDesignMode={isDesignMode}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
              />
            ))}
          </div>
        )}
      </TargetComponent>
    </Wrapper>
  );
};

export const DynamicPageRenderer: React.FC<DynamicPageRendererProps> = ({
  nodes = [],
  themeConfig,
  onActionTrigger,
  isDesignMode = false,
  selectedNodeId,
  onSelectNode,
  rootTag,
  styleSheet,
  layoutRegion,
  layoutRegions,
}) => {
  const cssText = useMemo(
    () => compilePageStyleSheet(styleSheet),
    [styleSheet],
  );
  // A page carrying the agency header is a government site page, whether or not
  // its individual sections opted into a municipal style preset.
  const isMunicipalPage = nodes.some(
    (node) =>
      node.type === "SiteHeaderComponent" ||
      (typeof node.props?.stylePreset === "string" &&
        node.props.stylePreset.startsWith("municipal-")) ||
      node.id.startsWith("municipal_"),
  );

  const Root = rootTag ?? (isDesignMode ? "div" : "main");
  const usesPageLayout =
    !layoutRegion && nodes.some((node) => pageLayoutRegionFor(node));
  const groupedNodes = usesPageLayout
    ? PAGE_LAYOUT_REGIONS.reduce<Record<PageLayoutRegion, ComponentNode[]>>(
        (groups, region) => {
          groups[region] = nodes.filter(
            (node) => (pageLayoutRegionFor(node) || "content") === region,
          );
          return groups;
        },
        {
          top: [],
          "sidebar-left": [],
          content: [],
          "sidebar-right": [],
          footer: [],
        },
      )
    : undefined;

  const renderNode = (node: ComponentNode) => (
    <DynamicNodeItem
      key={node.id}
      node={node}
      onActionTrigger={onActionTrigger}
      isDesignMode={isDesignMode}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
    />
  );

  const renderRegion = (region: PageLayoutRegion, className?: string) => {
    const regionNodes = groupedNodes?.[region] || [];
    if (layoutRegions?.[region] === false || !regionNodes.length) return null;
    return (
      <div className={className} data-layout-region={region}>
        {regionNodes.map(renderNode)}
      </div>
    );
  };

  return (
    <ThemeEngine themeConfig={themeConfig}>
      <Root
        className={`dynamic-page-root container-fluid py-3 d-flex flex-column ${isMunicipalPage ? "municipal-page" : ""}`}
        data-page-style-scope={styleSheet?.scopeId}
      >
        {cssText && <style>{cssText}</style>}
        {nodes.length > 0 && usesPageLayout ? (
          <div className="dynamic-page-layout d-flex flex-column gap-4 w-100">
            {renderRegion("top", "w-100")}
            <div className="dynamic-page-layout-middle d-flex flex-column flex-lg-row justify-content-center align-items-stretch gap-4 w-100">
              {renderRegion(
                "sidebar-left",
                "dynamic-page-layout-sidebar flex-shrink-0",
              )}
              {renderRegion(
                "content",
                "dynamic-page-layout-content d-flex flex-column align-items-center flex-grow-1 min-w-0",
              )}
              {renderRegion(
                "sidebar-right",
                "dynamic-page-layout-sidebar flex-shrink-0",
              )}
            </div>
            {renderRegion("footer", "w-100")}
          </div>
        ) : nodes.length > 0 ? (
          <div
            className="d-flex flex-column gap-4"
            data-layout-region={layoutRegion}
          >
            {nodes.map((node) => {
              const item = (
                <DynamicNodeItem
                  node={node}
                  onActionTrigger={onActionTrigger}
                  isDesignMode={isDesignMode}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={onSelectNode}
                />
              );
              if (layoutRegion)
                return <React.Fragment key={node.id}>{item}</React.Fragment>;
              const nodeRegion =
                typeof node.props?.__layoutRegion === "string"
                  ? node.props.__layoutRegion
                  : typeof node.props?.__sectionId === "string"
                    ? node.props.__sectionId
                    : undefined;
              return (
                <div key={node.id} data-layout-region={nodeRegion}>
                  {item}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-5 border border-2 border-dashed rounded bg-white text-muted">
            {isDesignMode ? (
              <p className="mb-0">
                Canvas is empty. Drag & drop components from the palette to
                start building!
              </p>
            ) : (
              <p className="mb-0">
                No components configured for this page layout.
              </p>
            )}
          </div>
        )}
      </Root>
    </ThemeEngine>
  );
};
