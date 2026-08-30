"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  ArrowLeft,
  Box,
  Braces,
  ChevronDown,
  Edit3,
  FileText,
  FolderOpen,
  Layers,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { DynamicPageRenderer } from "@/components/engine/DynamicPageRenderer";
import {
  GenPageFromImageWizard,
  type GenPageFromImageRequest,
} from "@/components/studio/GenPageFromImageWizard";
import { StorageScopeProvider } from "@/components/shared/StorageScopeContext";
import { FileManagerPopupComponent } from "@/components/shared/FileManagerPopupComponent";
import {
  COMPONENT_PALETTE,
  type ComponentPaletteItem,
} from "@/lib/engine/ComponentRegistry";
import { compilePageStyleSheet } from "@/lib/engine/pageStyleSheet";
import type {
  AppConfig,
  ComponentNode,
  PageStyleBreakpoint,
  PageStyleSheet,
  PageStyleState,
} from "@/types";

type Page = {
  id: string;
  name: string;
  title: string;
  routePath?: string;
  templateType?: string;
  containerName?: string;
  isDefaultPage?: boolean;
  componentTree?: ComponentNode[];
  layoutRegions?: Record<string, boolean>;
  styleSheet?: PageStyleSheet;
};
type PlatformData = {
  id: string;
  platformName: string;
  platformSlug: string;
  masterThemeConfig: AppConfig["themeConfig"];
  studioLayout: ComponentNode[];
  studioPages: Page[];
};

const WORKSPACES: Record<string, { title: string; terms: string[] }> = {
  "public-home": {
    title: "Public Home",
    terms: ["public", "home", "landing", "index"],
  },
  dashboard: { title: "Dashboard", terms: ["dashboard", "summary", "metric"] },
  "master-detail": {
    title: "Form Master Detail",
    terms: ["master", "detail", "form", "crud"],
  },
  "admin-page": { title: "Admin Page", terms: ["admin", "backend", "manage"] },
  diagram: { title: "Diagram", terms: ["diagram", "flow", "chart"] },
  calendar: { title: "Calendar", terms: ["calendar", "schedule", "event"] },
};
const REGIONS = [
  ["top", "Top"],
  ["sidebar-left", "Sidebar Left"],
  ["content", "Content"],
  ["sidebar-right", "Sidebar Right"],
  ["footer", "Footer"],
] as const;
const PALETTE_GROUPS = [
  "Menu",
  "Container",
  "Form",
  "DynamicHTML",
  "Card",
  "Gallery",
  "Collection",
] as const;
const _STYLE_FIELDS = [
  ["Background", "backgroundColor", "background-color", "เช่น #ffffff"],
  ["Text color", "color", "color", "เช่น #212529"],
  ["Padding", "padding", "padding", "เช่น 24px"],
  ["Margin", "margin", "margin", "เช่น 0 auto"],
  ["Width", "width", "width", "เช่น 100%"],
  ["Border", "border", "border", "เช่น 1px solid #ddd"],
  ["Radius", "borderRadius", "border-radius", "เช่น 12px"],
  ["Shadow", "boxShadow", "box-shadow", "เช่น 0 8px 24px #0002"],
] as const;

type CssPropertyPreset = {
  property: string;
  label: string;
  examples: string[];
  kind?: "color" | "image";
};

const CSS_PROPERTY_PRESETS: CssPropertyPreset[] = [
  {
    property: "background-color",
    label: "Background color",
    examples: ["#FFFFFF", "transparent", "rgba(255, 255, 255, .8)"],
    kind: "color",
  },
  {
    property: "background-image",
    label: "Background image",
    examples: [
      "none",
      'url("/uploads/image.png")',
      "linear-gradient(135deg, #0d6efd, #6610f2)",
    ],
    kind: "image",
  },
  {
    property: "background-size",
    label: "Background size",
    examples: ["cover", "contain", "100% 100%"],
  },
  {
    property: "background-position",
    label: "Background position",
    examples: ["center", "top left", "50% 50%"],
  },
  {
    property: "color",
    label: "Text color",
    examples: ["#212529", "inherit", "currentColor"],
    kind: "color",
  },
  {
    property: "outline-color",
    label: "Outline color",
    examples: ["#0D6EFD", "transparent", "currentColor"],
    kind: "color",
  },
  {
    property: "accent-color",
    label: "Accent color",
    examples: ["#0D6EFD", "auto", "currentColor"],
    kind: "color",
  },
  {
    property: "caret-color",
    label: "Caret color",
    examples: ["auto", "#212529", "currentColor"],
    kind: "color",
  },
  {
    property: "fill",
    label: "SVG fill",
    examples: ["currentColor", "none", "#0D6EFD"],
    kind: "color",
  },
  {
    property: "stroke",
    label: "SVG stroke",
    examples: ["currentColor", "none", "#212529"],
    kind: "color",
  },
  { property: "opacity", label: "Opacity", examples: ["1", ".75", "0"] },
  {
    property: "padding",
    label: "Padding",
    examples: ["0", "16px", "12px 24px"],
  },
  { property: "margin", label: "Margin", examples: ["0", "0 auto", "16px"] },
  {
    property: "width",
    label: "Width",
    examples: ["100%", "320px", "fit-content"],
  },
  { property: "height", label: "Height", examples: ["auto", "100%", "240px"] },
  {
    property: "min-width",
    label: "Minimum width",
    examples: ["0", "240px", "100%"],
  },
  {
    property: "max-width",
    label: "Maximum width",
    examples: ["100%", "1200px", "none"],
  },
  {
    property: "display",
    label: "Display",
    examples: ["block", "flex", "grid", "none"],
  },
  {
    property: "position",
    label: "Position",
    examples: ["relative", "absolute", "sticky", "fixed"],
  },
  { property: "gap", label: "Gap", examples: ["8px", "1rem", "12px 24px"] },
  {
    property: "justify-content",
    label: "Justify content",
    examples: ["flex-start", "center", "space-between"],
  },
  {
    property: "align-items",
    label: "Align items",
    examples: ["stretch", "center", "flex-start"],
  },
  {
    property: "font-size",
    label: "Font size",
    examples: ["1rem", "16px", "clamp(1rem, 2vw, 2rem)"],
  },
  {
    property: "font-weight",
    label: "Font weight",
    examples: ["400", "600", "bold"],
  },
  {
    property: "text-align",
    label: "Text align",
    examples: ["left", "center", "right"],
  },
  {
    property: "border",
    label: "Border",
    examples: ["none", "1px solid #dee2e6", "2px dashed currentColor"],
  },
  {
    property: "border-color",
    label: "Border color",
    examples: ["#DEE2E6", "transparent", "currentColor"],
    kind: "color",
  },
  {
    property: "border-radius",
    label: "Border radius",
    examples: ["0", "8px", "999px"],
  },
  {
    property: "box-shadow",
    label: "Box shadow",
    examples: ["none", "0 8px 24px #00000022", "0 2px 8px rgba(0,0,0,.15)"],
  },
  {
    property: "overflow",
    label: "Overflow",
    examples: ["visible", "hidden", "auto", "clip"],
  },
  {
    property: "object-fit",
    label: "Object fit",
    examples: ["cover", "contain", "fill"],
  },
  {
    property: "object-position",
    label: "Object position",
    examples: ["center", "top", "50% 50%"],
  },
  {
    property: "border-image-source",
    label: "Border image",
    examples: ["none", 'url("/uploads/border.png")'],
    kind: "image",
  },
  {
    property: "list-style-image",
    label: "List marker image",
    examples: ["none", 'url("/uploads/marker.svg")'],
    kind: "image",
  },
  {
    property: "mask-image",
    label: "Mask image",
    examples: ["none", 'url("/uploads/mask.svg")'],
    kind: "image",
  },
  {
    property: "filter",
    label: "Filter",
    examples: ["none", "blur(4px)", "brightness(.8)"],
  },
  {
    property: "transform",
    label: "Transform",
    examples: ["none", "translateY(-2px)", "scale(1.05)"],
  },
  {
    property: "transition",
    label: "Transition",
    examples: ["none", "all .2s ease", "opacity .15s linear"],
  },
  { property: "z-index", label: "Z-index", examples: ["auto", "1", "1000"] },
];

const cssPropertyToReactProperty = (property: string) =>
  property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

const colorParts = (value: string) => {
  const hex = value.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex)
    return {
      rgb: `#${hex[1]}`,
      alpha: hex[2] ? Number.parseInt(hex[2], 16) : 255,
    };
  const short = value.trim().match(/^#([0-9a-f]{3})([0-9a-f])?$/i);
  if (short) {
    const rgb = short[1]
      .split("")
      .map((part) => part + part)
      .join("");
    return {
      rgb: `#${rgb}`,
      alpha: short[2] ? Number.parseInt(short[2] + short[2], 16) : 255,
    };
  }
  return { rgb: "#000000", alpha: 255 };
};

const cssColorValue = (rgb: string, alpha: number) =>
  alpha >= 255
    ? rgb.toUpperCase()
    : `${rgb.toUpperCase()}${alpha.toString(16).padStart(2, "0").toUpperCase()}`;

function CssColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const parts = colorParts(value);
  const argb =
    `#${parts.alpha.toString(16).padStart(2, "0")}${parts.rgb.slice(1)}`.toUpperCase();
  return (
    <div className="mt-1">
      <div className="d-flex align-items-center gap-2">
        <input
          type="color"
          className="form-control form-control-color form-control-sm flex-shrink-0"
          title="Color picker"
          value={parts.rgb}
          onChange={(event) =>
            onChange(cssColorValue(event.target.value, parts.alpha))
          }
        />
        <input
          type="range"
          className="form-range m-0"
          min="0"
          max="255"
          title={`Alpha ${parts.alpha}`}
          value={parts.alpha}
          onChange={(event) =>
            onChange(cssColorValue(parts.rgb, Number(event.target.value)))
          }
        />
        <span className="small text-secondary flex-shrink-0">
          A {parts.alpha}
        </span>
      </div>
      <div className="input-group input-group-sm mt-1">
        <span className="input-group-text">ARGB</span>
        <input
          className="form-control font-monospace"
          aria-label="ARGB color"
          title="ARGB: #AARRGGBB"
          key={argb}
          defaultValue={argb}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            const match = next.match(/^#([0-9A-F]{2})([0-9A-F]{6})$/);
            if (match)
              onChange(
                cssColorValue(`#${match[2]}`, Number.parseInt(match[1], 16)),
              );
          }}
        />
      </div>
    </div>
  );
}

function CssPropertyInput({
  property,
  listId,
  onCommit,
}: {
  property: string;
  listId: string;
  onCommit: (property: string) => void;
}) {
  const [draft, setDraft] = useState(property);
  const commit = () => {
    const next = draft.trim().toLowerCase();
    if (next && next !== property) onCommit(next);
    else setDraft(property);
  };
  return (
    <input
      list={listId}
      className="form-control form-control-sm font-monospace"
      aria-label="CSS property"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(property);
          event.currentTarget.blur();
        }
      }}
      placeholder="CSS property"
    />
  );
}

function CssDeclarationList({
  declarations,
  onChange,
}: {
  declarations: Record<string, string>;
  onChange: (
    property: string,
    value: string,
    previousProperty?: string,
  ) => void;
}) {
  const listId = useId().replace(/:/g, "");
  const [fileProperty, setFileProperty] = useState<string | null>(null);
  const [filePath, setFilePath] = useState("/uploads");
  const entries = Object.entries(declarations);
  const addDeclaration = () => {
    const preset = CSS_PROPERTY_PRESETS.find(
      ({ property }) => !(property in declarations),
    );
    let property = preset?.property || "custom-property";
    let index = 2;
    while (property in declarations) property = `custom-property-${index++}`;
    onChange(property, preset?.examples[0] || "initial");
  };

  return (
    <div className="css-declaration-list">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small fw-semibold">
          CSS Editor List{" "}
          <span className="badge text-bg-secondary">{entries.length}</span>
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={addDeclaration}
        >
          <Plus size={13} className="me-1" />
          Add CSS
        </button>
      </div>
      <datalist id={`${listId}-properties`}>
        {CSS_PROPERTY_PRESETS.map((preset) => (
          <option key={preset.property} value={preset.property}>
            {preset.label}
          </option>
        ))}
      </datalist>
      {entries.length === 0 && (
        <div className="border rounded bg-light text-secondary text-center small py-3 mb-2">
          No CSS declarations. Click “Add CSS”.
        </div>
      )}
      <div className="d-flex flex-column gap-2">
        {entries.map(([property, value], index) => {
          const preset = CSS_PROPERTY_PRESETS.find(
            (item) => item.property === property,
          );
          const valueKind =
            preset?.kind ||
            (/(?:^|-)color$|^(?:fill|stroke)$/.test(property)
              ? "color"
              : /image/.test(property)
                ? "image"
                : undefined);
          const valueListId = `${listId}-values-${index}`;
          return (
            <div key={index} className="border rounded-2 bg-light p-2">
              <div className="d-flex align-items-center gap-1 mb-1">
                <span className="badge text-bg-light border text-secondary">
                  {index + 1}
                </span>
                <CssPropertyInput
                  property={property}
                  listId={`${listId}-properties`}
                  onCommit={(nextProperty) =>
                    onChange(nextProperty, value, property)
                  }
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger flex-shrink-0"
                  title="Delete CSS"
                  onClick={() => onChange(property, "")}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <datalist id={valueListId}>
                {(preset?.examples || []).map((example) => (
                  <option key={example} value={example} />
                ))}
              </datalist>
              <div className="input-group input-group-sm">
                <input
                  list={valueListId}
                  className="form-control font-monospace"
                  aria-label={`${property} value`}
                  value={value}
                  onChange={(event) => onChange(property, event.target.value)}
                  placeholder={preset?.examples[0] || "CSS value"}
                />
                {valueKind === "image" && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    title="Select image from File Manager"
                    onClick={() => setFileProperty(property)}
                  >
                    <FolderOpen size={14} />
                  </button>
                )}
              </div>
              {valueKind === "color" && (
                <CssColorControl
                  value={value}
                  onChange={(next) => onChange(property, next)}
                />
              )}
              {preset?.examples?.length ? (
                <div
                  className="text-secondary mt-1"
                  style={{ fontSize: ".65rem" }}
                >
                  Examples: {preset.examples.join(" · ")}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <FileManagerPopupComponent
        open={Boolean(fileProperty)}
        title="Select CSS image"
        rootPath="/uploads"
        currentPath={filePath}
        onCurrentPathChange={setFilePath}
        accept="image/*"
        selectionMode="single"
        useButtonText="Use this image"
        onUse={(files) => {
          const asset = files[0];
          if (asset && fileProperty)
            onChange(fileProperty, `url(\"${asset.url}\")`);
          setFileProperty(null);
        }}
        onClose={() => setFileProperty(null)}
      />
    </div>
  );
}

const emptyPageStyleSheet = (pageId: string): PageStyleSheet => ({
  scopeId: `page-${pageId.replace(/[^A-Za-z0-9_-]/g, "-")}`,
  rules: [],
});

function ComponentStyleInspector({
  node,
  styleSheet,
  onUpdateNode,
  onUpdateStyleSheet,
}: {
  node: ComponentNode;
  styleSheet: PageStyleSheet;
  onUpdateNode: (changes: Partial<ComponentNode>) => void;
  onUpdateStyleSheet: Dispatch<SetStateAction<PageStyleSheet>>;
}) {
  const [selector, setSelector] = useState("");
  const [breakpoint, setBreakpoint] = useState<"" | PageStyleBreakpoint>("");
  const [state, setState] = useState<"" | PageStyleState>("");
  const isBaseWrapper = !selector.trim() && !breakpoint && !state;
  const activeRule = styleSheet.rules.find(
    (rule) =>
      rule.componentId === node.id &&
      (rule.selector || "") === selector.trim() &&
      (rule.breakpoint || "") === breakpoint &&
      (rule.state || "") === state,
  );

  const updateValue = (
    cssProperty: string,
    value: string,
    previousProperty?: string,
  ) => {
    if (isBaseWrapper) {
      const nextStyle = { ...(node.style || {}) };
      if (previousProperty && previousProperty !== cssProperty) {
        delete nextStyle[cssPropertyToReactProperty(previousProperty)];
      }
      const reactProperty = cssPropertyToReactProperty(cssProperty);
      if (cssProperty && value.trim()) nextStyle[reactProperty] = value;
      else delete nextStyle[reactProperty];
      onUpdateNode({ style: nextStyle });
      return;
    }

    onUpdateStyleSheet((current) => {
      const ruleIndex = current.rules.findIndex(
        (rule) =>
          rule.componentId === node.id &&
          (rule.selector || "") === selector.trim() &&
          (rule.breakpoint || "") === breakpoint &&
          (rule.state || "") === state,
      );
      const existing = ruleIndex >= 0 ? current.rules[ruleIndex] : undefined;
      const declarations = { ...(existing?.declarations || {}) };
      if (previousProperty && previousProperty !== cssProperty) {
        delete declarations[previousProperty];
      }
      if (cssProperty && value.trim()) declarations[cssProperty] = value;
      else delete declarations[cssProperty];
      const rules = [...current.rules];
      if (!Object.keys(declarations).length) {
        if (ruleIndex >= 0) rules.splice(ruleIndex, 1);
      } else {
        const nextRule = {
          id: existing?.id || `style-${node.id}-${Date.now().toString(36)}`,
          componentId: node.id,
          ...(selector.trim() ? { selector: selector.trim() } : {}),
          ...(breakpoint ? { breakpoint } : {}),
          ...(state ? { state } : {}),
          declarations,
        };
        if (ruleIndex >= 0) rules[ruleIndex] = nextRule;
        else rules.push(nextRule);
      }
      return { ...current, rules };
    });
  };

  return (
    <div className="border rounded-3 p-2 mb-3">
      <div className="fw-bold mb-2">Dynamic CSS</div>
      <div className="row g-2 mb-2">
        <div className="col-6">
          <label className="form-label small mb-1">Device</label>
          <select
            className="form-select form-select-sm"
            value={breakpoint}
            onChange={(event) =>
              setBreakpoint(event.target.value as "" | PageStyleBreakpoint)
            }
          >
            <option value="">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">State</label>
          <select
            className="form-select form-select-sm"
            value={state}
            onChange={(event) =>
              setState(event.target.value as "" | PageStyleState)
            }
          >
            <option value="">Default</option>
            <option value="hover">Hover</option>
            <option value="focus">Focus</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>
      <label className="form-label small mb-1">Child selector</label>
      <input
        className="form-control form-control-sm font-monospace mb-1"
        value={selector}
        placeholder="wrapper หรือ .form-control"
        onChange={(event) => setSelector(event.target.value)}
      />
      <div className="text-secondary mb-2" style={{ fontSize: ".68rem" }}>
        {isBaseWrapper
          ? "บันทึกที่ component_tree[].style"
          : "บันทึกเป็น scoped rule ใน page_config.styleSheet"}
      </div>
      <CssDeclarationList
        declarations={
          isBaseWrapper
            ? Object.fromEntries(
                Object.entries(node.style || {}).map(([property, value]) => [
                  property.replace(
                    /[A-Z]/g,
                    (letter) => `-${letter.toLowerCase()}`,
                  ),
                  String(value),
                ]),
              )
            : activeRule?.declarations || {}
        }
        onChange={updateValue}
      />
    </div>
  );
}

function PageStyleInspector({
  styleSheet,
  onUpdateStyleSheet,
}: {
  styleSheet: PageStyleSheet;
  onUpdateStyleSheet: Dispatch<SetStateAction<PageStyleSheet>>;
}) {
  const [selector, setSelector] = useState("");
  const [breakpoint, setBreakpoint] = useState<"" | PageStyleBreakpoint>("");
  const [state, setState] = useState<"" | PageStyleState>("");
  const cssText = useMemo(
    () =>
      compilePageStyleSheet({
        ...styleSheet,
        rules: styleSheet.rules.filter(
          (rule) => !rule.componentId && !rule.layoutRegion,
        ),
      }),
    [styleSheet],
  );
  const matchesTarget = (rule: PageStyleSheet["rules"][number]) =>
    !rule.componentId &&
    !rule.layoutRegion &&
    (rule.selector || "") === selector.trim() &&
    (rule.breakpoint || "") === breakpoint &&
    (rule.state || "") === state;
  const activeRule = styleSheet.rules.find(matchesTarget);

  const updateValue = (
    cssProperty: string,
    value: string,
    previousProperty?: string,
  ) =>
    onUpdateStyleSheet((current) => {
      const ruleIndex = current.rules.findIndex(matchesTarget);
      const existing = ruleIndex >= 0 ? current.rules[ruleIndex] : undefined;
      const declarations = { ...(existing?.declarations || {}) };
      if (previousProperty && previousProperty !== cssProperty) {
        delete declarations[previousProperty];
      }
      if (cssProperty && value.trim()) declarations[cssProperty] = value;
      else delete declarations[cssProperty];
      const rules = [...current.rules];
      if (!Object.keys(declarations).length) {
        if (ruleIndex >= 0) rules.splice(ruleIndex, 1);
      } else {
        const nextRule = {
          id: existing?.id || `style-page-root-${Date.now().toString(36)}`,
          ...(selector.trim() ? { selector: selector.trim() } : {}),
          ...(breakpoint ? { breakpoint } : {}),
          ...(state ? { state } : {}),
          declarations,
        };
        if (ruleIndex >= 0) rules[ruleIndex] = nextRule;
        else rules.push(nextRule);
      }
      return { ...current, rules };
    });

  return (
    <div>
      <div className="d-none">
        CSS ทั้ง Page, Layout และ Component ใช้ stylesheet เดียวกัน
      </div>
      <div className="small text-success fw-semibold mb-2">
        Page root CSS only
      </div>
      <div className="row g-1 mb-2">
        <div className="col-6">
          <select
            aria-label="Device"
            className="form-select form-select-sm"
            value={breakpoint}
            onChange={(event) =>
              setBreakpoint(event.target.value as "" | PageStyleBreakpoint)
            }
          >
            <option value="">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>
        <div className="col-6">
          <select
            aria-label="State"
            className="form-select form-select-sm"
            value={state}
            onChange={(event) =>
              setState(event.target.value as "" | PageStyleState)
            }
          >
            <option value="">Default</option>
            <option value="hover">Hover</option>
            <option value="focus">Focus</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>
      <input
        className="form-control form-control-sm font-monospace mb-2"
        value={selector}
        placeholder="Child selector (optional)"
        onChange={(event) => setSelector(event.target.value)}
      />
      <CssDeclarationList
        declarations={activeRule?.declarations || {}}
        onChange={updateValue}
      />
      <label className="form-label small fw-semibold mb-1">
        Compiled page CSS
      </label>
      <textarea
        className="form-control form-control-sm font-monospace bg-dark text-light"
        rows={12}
        readOnly
        value={cssText}
        placeholder="ยังไม่มี CSS ใน Page นี้"
      />
    </div>
  );
}

function LayoutStyleInspector({
  region,
  styleSheet,
  onUpdateStyleSheet,
}: {
  region: string;
  styleSheet: PageStyleSheet;
  onUpdateStyleSheet: Dispatch<SetStateAction<PageStyleSheet>>;
}) {
  const [selector, setSelector] = useState("");
  const [breakpoint, setBreakpoint] = useState<"" | PageStyleBreakpoint>("");
  const [state, setState] = useState<"" | PageStyleState>("");
  const matchesTarget = (rule: PageStyleSheet["rules"][number]) =>
    !rule.componentId &&
    rule.layoutRegion === region &&
    (rule.selector || "") === selector.trim() &&
    (rule.breakpoint || "") === breakpoint &&
    (rule.state || "") === state;
  const activeRule = styleSheet.rules.find(matchesTarget);

  const updateValue = (
    cssProperty: string,
    value: string,
    previousProperty?: string,
  ) =>
    onUpdateStyleSheet((current) => {
      const ruleIndex = current.rules.findIndex(matchesTarget);
      const existing = ruleIndex >= 0 ? current.rules[ruleIndex] : undefined;
      const declarations = { ...(existing?.declarations || {}) };
      if (previousProperty && previousProperty !== cssProperty) {
        delete declarations[previousProperty];
      }
      if (cssProperty && value.trim()) declarations[cssProperty] = value;
      else delete declarations[cssProperty];
      const rules = [...current.rules];
      if (!Object.keys(declarations).length) {
        if (ruleIndex >= 0) rules.splice(ruleIndex, 1);
      } else {
        const nextRule = {
          id:
            existing?.id || `style-layout-${region}-${Date.now().toString(36)}`,
          layoutRegion: region,
          ...(selector.trim() ? { selector: selector.trim() } : {}),
          ...(breakpoint ? { breakpoint } : {}),
          ...(state ? { state } : {}),
          declarations,
        };
        if (ruleIndex >= 0) rules[ruleIndex] = nextRule;
        else rules.push(nextRule);
      }
      return { ...current, rules };
    });

  return (
    <div>
      <div className="small text-primary mb-2">
        Scoped CSS for <code>{region}</code>
      </div>
      <div className="row g-2 mb-2">
        <div className="col-6">
          <label className="form-label small mb-1">Device</label>
          <select
            className="form-select form-select-sm"
            value={breakpoint}
            onChange={(event) =>
              setBreakpoint(event.target.value as "" | PageStyleBreakpoint)
            }
          >
            <option value="">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">State</label>
          <select
            className="form-select form-select-sm"
            value={state}
            onChange={(event) =>
              setState(event.target.value as "" | PageStyleState)
            }
          >
            <option value="">Default</option>
            <option value="hover">Hover</option>
            <option value="focus">Focus</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>
      <label className="form-label small mb-1">Child selector</label>
      <input
        className="form-control form-control-sm font-monospace mb-2"
        value={selector}
        placeholder="Optional, e.g. .form-control"
        onChange={(event) => setSelector(event.target.value)}
      />
      <CssDeclarationList
        declarations={activeRule?.declarations || {}}
        onChange={updateValue}
      />
    </div>
  );
}

function LayoutPropertiesEditor({
  region,
  enabled,
  componentCount,
  onEnabledChange,
}: {
  region: string;
  enabled: boolean;
  componentCount: number;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const label = REGIONS.find(([id]) => id === region)?.[1] || region;
  return (
    <div className="row g-3 align-items-end">
      <div className="col-md-4">
        <label className="form-label small mb-1">Layout name</label>
        <input
          className="form-control form-control-sm"
          value={label}
          readOnly
        />
      </div>
      <div className="col-md-4">
        <label className="form-label small mb-1">Region key</label>
        <input
          className="form-control form-control-sm font-monospace"
          value={region}
          readOnly
        />
      </div>
      <div className="col-md-2">
        <label className="form-label small mb-1">Components</label>
        <input
          className="form-control form-control-sm"
          value={componentCount}
          readOnly
        />
      </div>
      <div className="col-md-2">
        <div className="form-check form-switch mb-1">
          <input
            id={`layout-enabled-${region}`}
            type="checkbox"
            className="form-check-input"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <label
            className="form-check-label small"
            htmlFor={`layout-enabled-${region}`}
          >
            Enabled
          </label>
        </div>
      </div>
    </div>
  );
}

function ComponentPropertiesEditor({
  node,
  onUpdateNode,
  onUpdateProp,
}: {
  node: ComponentNode;
  onUpdateNode: (changes: Partial<ComponentNode>) => void;
  onUpdateProp: (key: string, value: unknown) => void;
}) {
  return (
    <div className="row g-2">
      <div className="col-md-5">
        <label className="form-label small mb-1">ชื่อ Object</label>
        <input
          className="form-control form-control-sm"
          value={node.label || node.type}
          onChange={(event) => onUpdateNode({ label: event.target.value })}
        />
      </div>
      <div className="col-md-4">
        <label className="form-label small mb-1">Component Type</label>
        <input
          className="form-control form-control-sm"
          value={node.type}
          readOnly
        />
      </div>
      <div className="col-md-3">
        <label className="form-label small mb-1">HTML ID</label>
        <input
          className="form-control form-control-sm"
          value={node.htmlId || ""}
          onChange={(event) => onUpdateNode({ htmlId: event.target.value })}
        />
      </div>
      {Object.entries(node.props || {})
        .filter(([key]) => !key.startsWith("__"))
        .map(([key, value]) => (
          <div
            key={key}
            className={typeof value === "object" ? "col-md-6" : "col-md-4"}
          >
            <label className="form-label small mb-1">{key}</label>
            {typeof value === "boolean" ? (
              <select
                className="form-select form-select-sm"
                value={String(value)}
                onChange={(event) =>
                  onUpdateProp(key, event.target.value === "true")
                }
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : typeof value === "object" ? (
              <textarea
                className="form-control form-control-sm font-monospace"
                rows={3}
                defaultValue={JSON.stringify(value, null, 2)}
                onBlur={(event) => {
                  try {
                    onUpdateProp(key, JSON.parse(event.target.value));
                  } catch {
                    event.target.value = JSON.stringify(value, null, 2);
                  }
                }}
              />
            ) : (
              <input
                className="form-control form-control-sm"
                type={typeof value === "number" ? "number" : "text"}
                value={String(value ?? "")}
                onChange={(event) =>
                  onUpdateProp(
                    key,
                    typeof value === "number"
                      ? Number(event.target.value)
                      : event.target.value,
                  )
                }
              />
            )}
          </div>
        ))}
    </div>
  );
}
const paletteGroup = (
  item: ComponentPaletteItem,
): (typeof PALETTE_GROUPS)[number] => {
  if (item.category === "Navigation") return "Menu";
  if (item.category === "Form Controls") return "Form";
  if (
    item.type === "DynamicHtmlComponent" ||
    item.type === "HtmlEditorComponent" ||
    item.type === "HtmlTemplateComponent"
  )
    return "DynamicHTML";
  if (
    item.type === "GalleryComponent" ||
    item.type === "FileManagerComponent" ||
    item.type === "FileManagerPopupComponent"
  )
    return "Gallery";
  if (item.type === "CardComponent" || item.type === "ChartComponent")
    return "Card";
  if (item.type === "ListComponent" || item.type === "TableDataComponent")
    return "Collection";
  return "Container";
};

export default function PageDesigner({
  workspace,
  platformId: requestedPlatformId,
  pageId: requestedPageId,
}: {
  readonly workspace: string;
  readonly platformId?: string;
  readonly pageId?: string;
}) {
  const isPlatformPage = Boolean(requestedPlatformId && requestedPageId);
  const definition = isPlatformPage
    ? { title: "Platform Page", terms: [] }
    : (WORKSPACES[workspace] ?? WORKSPACES["public-home"]);
  const [platform, setPlatform] = useState<PlatformData | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ComponentNode[]>([]);
  const [pageStyleSheet, setPageStyleSheet] = useState<PageStyleSheet>(() =>
    emptyPageStyleSheet("new-page"),
  );
  const [region, setRegion] = useState<string>("content");
  const [leftTab, setLeftTab] = useState<"layout" | "pageCss">("layout");
  const [bottomTab, setBottomTab] = useState<"properties" | "componentCss">(
    "properties",
  );
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [regionEnabled, setRegionEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(REGIONS.map(([id]) => [id, true])),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [componentSearch, setComponentSearch] = useState("");
  const [showImageWizard, setShowImageWizard] = useState(false);
  const [openPaletteGroups, setOpenPaletteGroups] = useState<
    Record<string, boolean>
  >(() => Object.fromEntries(PALETTE_GROUPS.map((group) => [group, true])));
  const [status, setStatus] = useState("กำลังโหลด Platform...");

  useEffect(() => {
    const load = async () => {
      try {
        if (requestedPlatformId && requestedPageId) {
          const response = await fetch(
            `/api/platforms/${encodeURIComponent(requestedPlatformId)}/pages/${encodeURIComponent(requestedPageId)}`,
            { cache: "no-store" },
          );
          const data = (await response.json()) as {
            platform?: PlatformData;
            page?: Page;
            error?: string;
          };
          if (!response.ok || !data.platform || !data.page)
            throw new Error(
              data.error || "โหลด Page จาก platform_pages ไม่สำเร็จ",
            );
          const loadedPlatform = {
            ...data.platform,
            studioLayout: [],
            studioPages: [data.page],
          } as PlatformData;
          setPlatform(loadedPlatform);
          setPages([data.page]);
          edit(data.page);
          setStatus("");
          return;
        }
        const listResponse = await fetch("/api/platforms", {
          cache: "no-store",
        });
        const listData = (await listResponse.json()) as {
          platforms?: Array<{ id: string }>;
          error?: string;
        };
        if (!listResponse.ok)
          throw new Error(listData.error || "อ่านรายการ Platform ไม่สำเร็จ");
        const last = localStorage.getItem("matchanu:last-studio-platform-id");
        const platformId =
          listData.platforms?.find((item) => item.id === last)?.id ??
          listData.platforms?.[0]?.id;
        if (!platformId) throw new Error("ไม่พบ Platform ที่มีสิทธิ์ใช้งาน");
        const response = await fetch(`/api/platforms/${platformId}/studio`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          platform?: PlatformData;
          error?: string;
        };
        if (!response.ok || !data.platform)
          throw new Error(data.error || "โหลดข้อมูล Page ไม่สำเร็จ");
        setPlatform(data.platform);
        setPages(data.platform.studioPages || []);
        const shareResponse = await fetch(
          `/api/file-manager?platformId=${encodeURIComponent(data.platform.id)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create-directory",
              path: "/uploads",
              name: "Share",
            }),
          },
        );
        if (!shareResponse.ok) {
          const shareData = (await shareResponse.json()) as { error?: string };
          throw new Error(shareData.error || "สร้างโฟลเดอร์ Share ไม่สำเร็จ");
        }
        setStatus("");
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
        );
      }
    };
    void load();
  }, [requestedPageId, requestedPlatformId]);

  const filteredPages = useMemo(
    () =>
      pages.filter((page) => {
        const text =
          `${page.id} ${page.name} ${page.title} ${page.routePath || ""} ${page.templateType || ""}`.toLowerCase();
        return (
          isPlatformPage || definition.terms.some((term) => text.includes(term))
        );
      }),
    [definition.terms, isPlatformPage, pages],
  );
  const palette = useMemo(
    () =>
      COMPONENT_PALETTE.filter((item) =>
        `${item.label} ${item.category} ${item.description}`
          .toLowerCase()
          .includes(componentSearch.toLowerCase()),
      ),
    [componentSearch],
  );
  const groupedPalette = useMemo(
    () =>
      PALETTE_GROUPS.map((group) => ({
        group,
        items: palette.filter((item) => paletteGroup(item) === group),
      })).filter((entry) => entry.items.length),
    [palette],
  );
  const pageCssText = useMemo(
    () => compilePageStyleSheet(pageStyleSheet),
    [pageStyleSheet],
  );

  const edit = (page: Page) => {
    setEditingId(page.id);
    setNodes(page.componentTree || []);
    setSelectedNodeId(null);
    setIsInspectorOpen(false);
    setPageStyleSheet(page.styleSheet || emptyPageStyleSheet(page.id));
    setRegionEnabled(
      Object.fromEntries(
        REGIONS.map(([id]) => [id, page.layoutRegions?.[id] !== false]),
      ),
    );
  };
  const createPage = () => {
    const id = `${workspace}-${Date.now().toString(36)}`;
    const page: Page = {
      id,
      name: `${definition.title} (${id}.page)`,
      title: `${definition.title} ใหม่`,
      routePath: `/${id}`,
      templateType: workspace,
      componentTree: [],
      layoutRegions: Object.fromEntries(
        REGIONS.map(([regionId]) => [regionId, true]),
      ),
      styleSheet: emptyPageStyleSheet(id),
    };
    setPages((current) => [...current, page]);
    edit(page);
  };
  const createPageFromImage = async (request: GenPageFromImageRequest) => {
    if (!platform) throw new Error("ยังโหลด Platform ไม่สำเร็จ");
    const createdAt = Date.now();
    const layoutFor = (sectionId: string) =>
      sectionId === "header" || sectionId === "breadcrumb"
        ? "top"
        : sectionId === "sidebar"
          ? "sidebar-right"
          : sectionId === "footer"
            ? "footer"
            : "content";
    const generatedNodes: ComponentNode[] = request.analysis.sections.map(
      (section, index) => {
        const layoutRegion = layoutFor(section.id);
        const crop = section.crop;
        const cropPreview = crop
          ? `<div class="border rounded overflow-hidden" style="height:240px;background-image:url('${request.image.url}');background-repeat:no-repeat;background-size:${10000 / crop.width}% ${10000 / crop.height}%;background-position:${(crop.x / Math.max(100 - crop.width, 1)) * 100}% ${(crop.y / Math.max(100 - crop.height, 1)) * 100}%"></div>`
          : "";
        return {
          id: `image_${section.id}_${createdAt}_${index}`,
          type: "DynamicHtmlComponent",
          label: `${section.label} · Generated from Image`,
          props: {
            __layoutRegion: layoutRegion,
            __sectionId: layoutRegion,
            __sectionName: REGIONS.find(([id]) => id === layoutRegion)?.[1],
            componentRole: "GeneratedFromImageSection",
            sourceImageUrl: request.image.url,
            sourceImagePath: request.image.path,
            viewport: request.viewport,
            detectedGrid: section.grid,
            suggestedComponent: section.component,
            collection: section.collection,
            sourceCrop: crop,
            content: `<section class="p-4 border rounded-3 bg-white"><div class="small text-primary fw-semibold">Generated from image${crop ? " · Custom Mark" : ""}</div><h2>${section.label}</h2>${cropPreview}<p class="text-secondary mt-2 mb-0">${section.grid} · ${section.component}</p></section>`,
          },
        };
      },
    );
    const id = `${workspace}-image-${createdAt.toString(36)}`;
    const usedRegions = new Set(
      generatedNodes.map((node) => String(node.props?.__layoutRegion)),
    );
    if (isPlatformPage && editingId) {
      setNodes(generatedNodes);
      setPageStyleSheet(emptyPageStyleSheet(editingId));
      setRegionEnabled(
        Object.fromEntries(
          REGIONS.map(([regionId]) => [regionId, usedRegions.has(regionId)]),
        ),
      );
      setStatus("นำเข้ารูปภาพลง Page ปัจจุบันแล้ว กรุณากดบันทึก");
      setShowImageWizard(false);
      return;
    }
    const page: Page = {
      id,
      name: `${request.pageTitle} (${id}.page)`,
      title: request.pageTitle,
      routePath: `/${id}`,
      templateType: `${workspace}-generated-from-image`,
      componentTree: generatedNodes,
      layoutRegions: Object.fromEntries(
        REGIONS.map(([regionId]) => [regionId, usedRegions.has(regionId)]),
      ),
      styleSheet: emptyPageStyleSheet(id),
    };
    const nextPages = [...pages, page];
    setStatus("กำลังสร้าง Page จากรูปภาพ...");
    const response = await fetch(`/api/platforms/${platform.id}/studio`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studioLayout: generatedNodes,
        studioPages: nextPages,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(data.error || "สร้าง Page จากรูปภาพไม่สำเร็จ");
      throw new Error(data.error || "สร้าง Page จากรูปภาพไม่สำเร็จ");
    }
    setPages(nextPages);
    setStatus("สร้าง Page จากรูปภาพและจัดวาง Layout แล้ว");
    edit(page);
  };
  const addComponent = (item: ComponentPaletteItem) => {
    const node: ComponentNode = {
      id: `${item.type}_${Date.now().toString(36)}`,
      type: item.type,
      label: item.label,
      props: {
        ...structuredClone(item.defaultProps),
        __layoutRegion: region,
        __sectionId: region,
        __sectionName: REGIONS.find(([id]) => id === region)?.[1] || region,
      },
    };
    setNodes((current) => [...current, node]);
    setSelectedNodeId(node.id);
    setIsInspectorOpen(true);
  };
  const updateSelectedNode = (changes: Partial<ComponentNode>) => {
    if (!selectedNodeId) return;
    setNodes((items) =>
      items.map((item) =>
        item.id === selectedNodeId ? { ...item, ...changes } : item,
      ),
    );
  };
  const updateSelectedProp = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    setNodes((items) =>
      items.map((item) =>
        item.id === selectedNodeId
          ? { ...item, props: { ...item.props, [key]: value } }
          : item,
      ),
    );
  };
  const save = async () => {
    if (!platform || !editingId) return;
    setStatus("กำลังบันทึก...");
    const nextPages = pages.map((page) =>
      page.id === editingId
        ? {
            ...page,
            componentTree: nodes,
            layoutRegions: regionEnabled,
            styleSheet: pageStyleSheet,
            templateType: page.templateType || workspace,
          }
        : page,
    );
    const editedPage = nextPages.find((page) => page.id === editingId);
    const response = isPlatformPage
      ? await fetch(
          `/api/platforms/${encodeURIComponent(platform.id)}/pages/${encodeURIComponent(editingId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ page: editedPage }),
          },
        )
      : await fetch(`/api/platforms/${platform.id}/studio`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studioLayout: nodes, studioPages: nextPages }),
        });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) return setStatus(data.error || "บันทึกไม่สำเร็จ");
    setPages(nextPages);
    setStatus("บันทึก Page แล้ว");
  };

  if (!editingId)
    return (
      <StorageScopeProvider scope={{ platformId: platform?.id }}>
        <>
          <div className="p-3 p-md-4 bg-light min-vh-100">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
              <div>
                <div className="text-primary small fw-semibold">
                  Page Designer ตัวใหม่
                </div>
                <h2>{definition.title}</h2>
                <p className="text-secondary mb-0">
                  เลือก Page เพื่อแก้ไขโดยไม่ผ่าน DevStudio Explorer
                </p>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-primary"
                  onClick={() => setShowImageWizard(true)}
                >
                  <Sparkles size={16} className="me-2" />
                  สร้าง Page ใหม่จากรูปภาพ
                </button>
                <button className="btn btn-primary" onClick={createPage}>
                  <Plus size={16} className="me-2" />
                  สร้าง Page
                </button>
              </div>
            </div>
            {status && (
              <div
                className={`alert ${platform ? "alert-info" : "alert-warning"}`}
              >
                {status}
              </div>
            )}
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Page</th>
                      <th>Route</th>
                      <th>Template</th>
                      <th className="text-end">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPages.map((page) => (
                      <tr key={page.id}>
                        <td>
                          <FileText size={16} className="text-primary me-2" />
                          <b>{page.title}</b>
                          <div>
                            <code>{page.id}</code>
                          </div>
                        </td>
                        <td>
                          <code>{page.routePath || `/${page.id}`}</code>
                        </td>
                        <td>{page.templateType || "custom"}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => edit(page)}
                          >
                            <Edit3 size={14} className="me-1" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!status && filteredPages.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center text-secondary py-5"
                        >
                          ยังไม่มี Page ประเภท {definition.title}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {showImageWizard && (
            <GenPageFromImageWizard
              pageTitle={`${definition.title} จากรูปภาพ`}
              initialPickerPath="/uploads/Share"
              onClose={() => setShowImageWizard(false)}
              onGenerate={createPageFromImage}
            />
          )}
        </>
      </StorageScopeProvider>
    );

  const currentPage = pages.find((page) => page.id === editingId);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  return (
    <StorageScopeProvider scope={{ platformId: platform?.id }}>
      <>
        <div
          className="platform-page-designer d-flex flex-column bg-light overflow-hidden"
          style={{ height: "calc(100vh - 64px)", minHeight: 0 }}
        >
          <div className="d-flex align-items-center gap-2 px-3 py-2 bg-white border-bottom">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                if (!isPlatformPage) {
                  setEditingId(null);
                  return;
                }
                if (!requestedPlatformId) return;
                const search = new URLSearchParams({
                  platformId: requestedPlatformId,
                });
                if (requestedPageId) search.set("pageId", requestedPageId);
                const appId = new URLSearchParams(window.location.search).get(
                  "appId",
                );
                if (appId) search.set("appId", appId);
                window.location.assign(`/studio?${search.toString()}`);
              }}
            >
              <ArrowLeft size={15} />{" "}
              {isPlatformPage ? "กลับ Studio" : "กลับรายการ"}
            </button>
            <div className="ms-2">
              <b>{currentPage?.title}</b>
              <div className="small text-secondary">
                Page Designer ·{" "}
                {isPlatformPage
                  ? `${platform?.platformName} · platform_pages`
                  : definition.title}
              </div>
            </div>
            <span className="ms-auto small text-success">{status}</span>
            <button
              className="btn btn-sm btn-outline-primary d-flex align-items-center"
              disabled={!platform}
              onClick={() => setShowImageWizard(true)}
            >
              <Sparkles size={15} className="me-1" />
              สร้างหน้าจากรูปภาพ
            </button>
            <button
              className="btn btn-sm btn-success"
              onClick={() => void save()}
            >
              <Save size={15} className="me-1" />
              บันทึก
            </button>
          </div>
          <div
            className="d-grid flex-grow-1 position-relative overflow-hidden"
            style={{
              gridTemplateColumns: "250px minmax(0,1fr) 300px",
              minHeight: 0,
            }}
          >
            <aside
              className="bg-white border-end p-3 overflow-auto"
              style={{ minHeight: 0 }}
            >
              <div className="btn-group btn-group-sm w-100 mb-3" role="tablist">
                <button
                  type="button"
                  className={`btn d-flex align-items-center justify-content-center gap-1 ${leftTab === "layout" ? "btn-success" : "btn-outline-secondary"}`}
                  onClick={() => setLeftTab("layout")}
                >
                  <Layers size={15} />
                  Layout Outline
                </button>
                <button
                  type="button"
                  className={`btn d-flex align-items-center justify-content-center gap-1 ${leftTab === "pageCss" ? "btn-success" : "btn-outline-success"}`}
                  onClick={() => setLeftTab("pageCss")}
                >
                  <Braces size={15} />
                  PageCss
                </button>
              </div>
              {leftTab === "layout" ? (
                <>
                  {REGIONS.map(([id, label], index) => {
                    const count = nodes.filter(
                      (node) =>
                        String(
                          node.props?.__layoutRegion ||
                            node.props?.__sectionId ||
                            "content",
                        ) === id,
                    ).length;
                    const enabled = regionEnabled[id] !== false;
                    const regionNodes = nodes.filter(
                      (node) =>
                        String(
                          node.props?.__layoutRegion ||
                            node.props?.__sectionId ||
                            "content",
                        ) === id,
                    );
                    return (
                      <div key={id} className="mb-1">
                        <div
                          className={`d-flex align-items-center rounded ${region === id ? "bg-primary text-white" : "bg-light"} ${enabled ? "" : "opacity-50"}`}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input ms-2 mt-0"
                            checked={enabled}
                            aria-label={`ใช้ Layout ${label}`}
                            onChange={(event) =>
                              setRegionEnabled((current) => ({
                                ...current,
                                [id]: event.target.checked,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className={`btn btn-sm border-0 flex-grow-1 d-flex text-start align-items-center ${region === id ? "text-white" : "text-dark"}`}
                            onClick={() => {
                              setRegion(id);
                              setSelectedNodeId(null);
                              setIsInspectorOpen(true);
                            }}
                          >
                            <Box size={12} className="me-2" />
                            {index + 1}. {label}
                            <span className="badge bg-white text-dark ms-auto">
                              {count}
                            </span>
                          </button>
                        </div>
                        {regionNodes.map((node) => (
                          <div
                            key={node.id}
                            className={`d-flex align-items-center rounded ms-4 mt-1 px-2 py-1 ${selectedNodeId === node.id ? "bg-primary text-white" : "bg-white border"}`}
                            role="button"
                            onClick={() => {
                              setRegion(id);
                              setSelectedNodeId(node.id);
                              setIsInspectorOpen(true);
                            }}
                          >
                            <span className="text-truncate small">
                              └ {node.label || node.type}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm border-0 text-danger ms-auto p-0"
                              aria-label={`ลบ ${node.label || node.type}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (
                                  window.confirm(
                                    `ลบ Component “${node.label || node.type}” หรือไม่?`,
                                  )
                                ) {
                                  setNodes((items) =>
                                    items.filter((item) => item.id !== node.id),
                                  );
                                  if (selectedNodeId === node.id)
                                    setSelectedNodeId(null);
                                }
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              ) : (
                <PageStyleInspector
                  styleSheet={pageStyleSheet}
                  onUpdateStyleSheet={setPageStyleSheet}
                />
              )}
            </aside>
            <main
              className="p-3 overflow-x-hidden overflow-y-auto"
              onClick={(event) => {
                if (event.target !== event.currentTarget) return;
                setSelectedNodeId(null);
                setIsInspectorOpen(false);
              }}
              style={{
                minHeight: 0,
                paddingBottom: 316,
                overscrollBehavior: "contain",
              }}
            >
              <div
                className="bg-white rounded shadow-sm mx-auto d-grid overflow-hidden w-100"
                data-page-style-scope={pageStyleSheet.scopeId}
                style={{
                  minHeight: 650,
                  maxWidth: 1200,
                  gridTemplateColumns: "180px minmax(0,1fr) 180px",
                  gridTemplateRows: "auto minmax(430px,1fr) auto",
                }}
              >
                {pageCssText && <style>{pageCssText}</style>}
                {REGIONS.map(([id, label]) => {
                  const enabled = regionEnabled[id] !== false;
                  const regionNodes = nodes.filter(
                    (node) =>
                      String(
                        node.props?.__layoutRegion ||
                          node.props?.__sectionId ||
                          "content",
                      ) === id,
                  );
                  const placement =
                    id === "top"
                      ? { gridColumn: "1 / 4", gridRow: "1" }
                      : id === "sidebar-left"
                        ? { gridColumn: "1", gridRow: "2" }
                        : id === "content"
                          ? { gridColumn: "2", gridRow: "2" }
                          : id === "sidebar-right"
                            ? { gridColumn: "3", gridRow: "2" }
                            : { gridColumn: "1 / 4", gridRow: "3" };
                  const focused = region === id;
                  const hovered = hoveredRegion === id;
                  return (
                    <section
                      key={id}
                      onMouseEnter={() => setHoveredRegion(id)}
                      onMouseLeave={() => setHoveredRegion(null)}
                      onClick={(event) => {
                        event.stopPropagation();
                        setRegion(id);
                        setSelectedNodeId(null);
                        setIsInspectorOpen(true);
                      }}
                      style={{
                        ...placement,
                        minHeight: id === "content" ? 430 : 90,
                        border: focused
                          ? "2px solid #0d6efd"
                          : hovered
                            ? "2px solid #6ea8fe"
                            : "1px dashed #adb5bd",
                        opacity: focused ? 1 : hovered ? 0.62 : 0.22,
                        cursor: "pointer",
                        filter: enabled ? undefined : "grayscale(1)",
                        transition:
                          "opacity .18s, border-color .18s, box-shadow .18s",
                        boxShadow:
                          hovered && !focused
                            ? "inset 0 0 0 2px rgba(13,110,253,.12)"
                            : undefined,
                        position: "relative",
                      }}
                    >
                      <span
                        className={`position-absolute badge ${focused ? "text-bg-primary" : "text-bg-secondary"}`}
                        style={{ zIndex: 3, top: 4, left: 4 }}
                      >
                        {label}
                        {enabled ? "" : " · ไม่ใช้"}
                      </span>
                      <div
                        style={{
                          pointerEvents: enabled ? "auto" : "none",
                        }}
                      >
                        {enabled && (
                          <DynamicPageRenderer
                            nodes={regionNodes}
                            themeConfig={platform?.masterThemeConfig}
                            layoutRegion={id}
                            isDesignMode
                            selectedNodeId={selectedNodeId}
                            onSelectNode={(nodeId) => {
                              setSelectedNodeId(nodeId);
                              setIsInspectorOpen(true);
                            }}
                            rootTag={
                              id.includes("sidebar")
                                ? "aside"
                                : id === "footer"
                                  ? "section"
                                  : "div"
                            }
                          />
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </main>
            {isInspectorOpen && !selectedNode && (
              <aside
                className="page-designer-layout-panel position-absolute bottom-0 bg-white border border-2 border-primary shadow-lg p-3 overflow-auto"
                style={{ zIndex: 6, left: 250, right: 300, height: 300 }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary position-absolute top-0 end-0 m-3 d-inline-flex align-items-center justify-content-center"
                  style={{ zIndex: 2, width: 32, height: 32 }}
                  aria-label="ปิดคุณสมบัติ Layout"
                  title="ปิด"
                  onClick={() => setIsInspectorOpen(false)}
                >
                  <X size={16} />
                </button>
                <div className="btn-group btn-group-sm mb-3" role="tablist">
                  <button
                    type="button"
                    className={`btn ${bottomTab === "properties" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setBottomTab("properties")}
                  >
                    คุณสมบัติ Layout
                  </button>
                  <button
                    type="button"
                    className={`btn ${bottomTab === "componentCss" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setBottomTab("componentCss")}
                  >
                    <Braces size={13} className="me-1" />
                    LayoutCss
                  </button>
                </div>
                {bottomTab === "properties" ? (
                  <LayoutPropertiesEditor
                    region={region}
                    enabled={regionEnabled[region] !== false}
                    componentCount={
                      nodes.filter(
                        (node) =>
                          String(
                            node.props?.__layoutRegion ||
                              node.props?.__sectionId ||
                              "content",
                          ) === region,
                      ).length
                    }
                    onEnabledChange={(enabled) =>
                      setRegionEnabled((current) => ({
                        ...current,
                        [region]: enabled,
                      }))
                    }
                  />
                ) : (
                  <LayoutStyleInspector
                    key={region}
                    region={region}
                    styleSheet={pageStyleSheet}
                    onUpdateStyleSheet={setPageStyleSheet}
                  />
                )}
              </aside>
            )}
            {isInspectorOpen && selectedNode && (
              <aside
                className="page-designer-component-panel position-absolute bottom-0 bg-white border border-2 border-primary shadow-lg p-3 overflow-auto"
                style={{ zIndex: 6, left: 250, right: 300, height: 300 }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary position-absolute top-0 end-0 m-3 d-inline-flex align-items-center justify-content-center"
                  style={{ zIndex: 2, width: 32, height: 32 }}
                  aria-label="ปิดคุณสมบัติ Component"
                  title="ปิด"
                  onClick={() => setIsInspectorOpen(false)}
                >
                  <X size={16} />
                </button>
                <div className="btn-group btn-group-sm mb-3" role="tablist">
                  <button
                    type="button"
                    className={`btn ${bottomTab === "properties" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setBottomTab("properties")}
                  >
                    คุณสมบัติ Component
                  </button>
                  <button
                    type="button"
                    className={`btn ${bottomTab === "componentCss" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setBottomTab("componentCss")}
                  >
                    <Braces size={13} className="me-1" />
                    ComponentCss
                  </button>
                </div>
                {bottomTab === "properties" ? (
                  <>
                    <ComponentPropertiesEditor
                      node={selectedNode}
                      onUpdateNode={updateSelectedNode}
                      onUpdateProp={updateSelectedProp}
                    />
                    <div className="d-none row g-2">
                      <div className="col-md-5">
                        <label className="form-label small mb-1">
                          ชื่อ Object
                        </label>
                        <input
                          className="form-control form-control-sm"
                          value={selectedNode.label || selectedNode.type}
                          onChange={(event) =>
                            updateSelectedNode({ label: event.target.value })
                          }
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small mb-1">
                          Component Type
                        </label>
                        <input
                          className="form-control form-control-sm"
                          value={selectedNode.type}
                          readOnly
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small mb-1">HTML ID</label>
                        <input
                          className="form-control form-control-sm"
                          value={selectedNode.htmlId || ""}
                          onChange={(event) =>
                            updateSelectedNode({ htmlId: event.target.value })
                          }
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="small text-primary mb-2">
                      เชื่อมกับ PageCss ผ่าน page_config.styleSheet และ
                      component instance <code>{selectedNode.id}</code>
                    </div>
                    <ComponentStyleInspector
                      key={selectedNode.id}
                      node={selectedNode}
                      styleSheet={pageStyleSheet}
                      onUpdateNode={updateSelectedNode}
                      onUpdateStyleSheet={setPageStyleSheet}
                    />
                  </>
                )}
              </aside>
            )}
            <aside className="bg-white border-start p-3 overflow-auto">
              {selectedNode && (
                <div
                  className="page-designer-legacy-component-properties border rounded-3 p-2 mb-3"
                  aria-hidden="true"
                >
                  <div className="fw-bold mb-2">คุณสมบัติ Component</div>
                  <label className="form-label small mb-1">ชื่อ Object</label>
                  <input
                    className="form-control form-control-sm mb-2"
                    value={selectedNode.label || selectedNode.type}
                    onChange={(event) =>
                      updateSelectedNode({ label: event.target.value })
                    }
                  />
                  <label className="form-label small mb-1">
                    Component Type
                  </label>
                  <input
                    className="form-control form-control-sm mb-2"
                    value={selectedNode.type}
                    readOnly
                  />
                  <label className="form-label small mb-1">HTML ID</label>
                  <input
                    className="form-control form-control-sm mb-2"
                    value={selectedNode.htmlId || ""}
                    onChange={(event) =>
                      updateSelectedNode({ htmlId: event.target.value })
                    }
                  />
                  {Object.entries(selectedNode.props || {})
                    .filter(([key]) => !key.startsWith("__"))
                    .map(([key, value]) => (
                      <div key={key} className="mb-2">
                        <label className="form-label small mb-1">{key}</label>
                        {typeof value === "boolean" ? (
                          <select
                            className="form-select form-select-sm"
                            value={String(value)}
                            onChange={(event) =>
                              updateSelectedProp(
                                key,
                                event.target.value === "true",
                              )
                            }
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : typeof value === "object" ? (
                          <textarea
                            className="form-control form-control-sm font-monospace"
                            rows={3}
                            defaultValue={JSON.stringify(value, null, 2)}
                            onBlur={(event) => {
                              try {
                                updateSelectedProp(
                                  key,
                                  JSON.parse(event.target.value),
                                );
                              } catch {
                                event.target.value = JSON.stringify(
                                  value,
                                  null,
                                  2,
                                );
                              }
                            }}
                          />
                        ) : (
                          <input
                            className="form-control form-control-sm"
                            type={typeof value === "number" ? "number" : "text"}
                            value={String(value ?? "")}
                            onChange={(event) =>
                              updateSelectedProp(
                                key,
                                typeof value === "number"
                                  ? Number(event.target.value)
                                  : event.target.value,
                              )
                            }
                          />
                        )}
                      </div>
                    ))}
                </div>
              )}
              <div className="fw-bold mb-2">Components</div>
              <div className="small text-secondary mb-3">
                เพิ่มลงใน {REGIONS.find(([id]) => id === region)?.[1]}
              </div>
              {regionEnabled[region] === false && (
                <div className="alert alert-warning py-2 small">
                  Layout นี้ถูกปิดใช้งาน กรุณาเลือก Checkbox ก่อนเพิ่ม Component
                </div>
              )}
              <div className="position-relative mb-3">
                <Search
                  size={14}
                  className="position-absolute"
                  style={{ left: 10, top: 10 }}
                />
                <input
                  className="form-control form-control-sm ps-4"
                  placeholder="ค้นหา Component"
                  value={componentSearch}
                  onChange={(event) => setComponentSearch(event.target.value)}
                />
              </div>
              {groupedPalette.map(({ group, items }) => (
                <div
                  key={group}
                  className="border rounded mb-2 overflow-hidden"
                >
                  <button
                    type="button"
                    className="btn btn-light w-100 d-flex align-items-center fw-semibold"
                    onClick={() =>
                      setOpenPaletteGroups((current) => ({
                        ...current,
                        [group]: !current[group],
                      }))
                    }
                  >
                    <ChevronDown
                      size={14}
                      className="me-2"
                      style={{
                        transform: openPaletteGroups[group]
                          ? undefined
                          : "rotate(-90deg)",
                      }}
                    />
                    {group}
                    <span className="badge bg-secondary ms-auto">
                      {items.length}
                    </span>
                  </button>
                  {openPaletteGroups[group] && (
                    <div className="p-2">
                      {items.map((item) => (
                        <button
                          key={item.type}
                          className="btn btn-light border w-100 text-start mb-2 p-2"
                          disabled={regionEnabled[region] === false}
                          onClick={() => addComponent(item)}
                        >
                          <div className="d-flex align-items-center">
                            <Box size={14} className="text-primary me-2" />
                            <b className="small">{item.label}</b>
                            <Plus size={13} className="ms-auto" />
                          </div>
                          <div
                            className="text-secondary mt-1"
                            style={{ fontSize: ".7rem" }}
                          >
                            {item.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </aside>
          </div>
        </div>
        {showImageWizard && (
          <GenPageFromImageWizard
            key={`new-image-page-${editingId}`}
            pageTitle={`${definition.title} จากรูปภาพ`}
            initialPickerPath="/uploads/Share"
            onClose={() => setShowImageWizard(false)}
            onGenerate={createPageFromImage}
          />
        )}
      </>
    </StorageScopeProvider>
  );
}
