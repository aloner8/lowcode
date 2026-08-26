'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StudioMenuBar } from '@/components/studio/StudioMenuBar';
import { PageFlowDesigner } from '@/components/studio/PageFlowDesigner';
import { StudioToolBar } from '@/components/studio/StudioToolBar';
import { StudioTreeviewOutline } from '@/components/studio/StudioTreeviewOutline';
import { RawTableWorkspace } from '@/components/studio/RawTableWorkspace';
import { ComponentPropertyModal } from '@/components/studio/ComponentPropertyModal';
import { AppWorkflowDesigner } from '@/components/studio/AppWorkflowDesigner';
import { DbSchemaExplorer } from '@/components/studio/DbSchemaExplorer';
import { PageManagerModal } from '@/components/studio/PageManagerModal';
import { BottomDock } from '@/components/studio/BottomDock';
import { ThemeCustomizerPanel } from '@/components/studio/ThemeCustomizerPanel';
import { ComponentWorkshop } from '@/components/studio/ComponentWorkshop';
import { PageSettingsWorkspace } from '@/components/studio/PageSettingsWorkspace';
import type { PageSettingsValue } from '@/components/studio/PageSettingsWorkspace';
import type { GenPageFromImageRequest } from '@/components/studio/GenPageFromImageWizard';
import { GenAppComponentFromImageWizard, type GenAppComponentFromImageRequest } from '@/components/studio/GenAppComponentFromImageWizard';
import { DynamicPageRenderer } from '@/components/engine/DynamicPageRenderer';
import { ComponentNode, AppConfig, AppRoute, AppWorkFlowManifest } from '@/types';
import { ComponentPaletteItem } from '@/lib/engine/ComponentRegistry';
import { HistoryStackManager } from '@/lib/engine/HistoryStackService';
import { createAdminPageTemplate } from '@/lib/studio/adminMenuTemplate';
import type { StudioCollectionDefinition, StudioFormDefinition } from '@/lib/studio/backendFormDefinitions';
import { FileText, Workflow, Database, RefreshCw } from 'lucide-react';
import { HtmlStudioShell } from '@/components/html-studio';
import type { HtmlStudioDocument, StudioNode } from '@/lib/html-studio';

interface StudioPageDefinition {
  id: string; name: string; title: string;
  containerName?: string;
  routePath?: string;
  templateType?: string;
  isDefaultPage?: boolean;
  componentTree?: ComponentNode[];
  settings?: PageSettingsValue;
  layoutHistory?: Array<{ templateType: string; componentTree: ComponentNode[]; savedAt: string }>;
}

const componentNodesToStudioNodes = (componentNodes: ComponentNode[]): StudioNode[] => componentNodes.map((node) => ({
  id: node.id,
  kind: 'component',
  componentRef: { id: (node.templateRef || `component://${node.type}`).replace(/^component:\/\//, ''), scope: 'platform', displayName: node.label || node.type },
  attributes: { ...JSON.parse(JSON.stringify(node.props || {})), ...(node.htmlId ? { id: node.htmlId } : {}), 'data-component-instance-id': node.id },
  children: node.children ? componentNodesToStudioNodes(node.children) : [],
}));

const createPageStudioDocument = (page: StudioPageDefinition, componentNodes: ComponentNode[]): HtmlStudioDocument => {
  const existing = componentNodes.find((node) => node.type === 'HtmlTemplateComponent' && node.props?.document)?.props.document as HtmlStudioDocument | undefined;
  if (existing) return existing;
  const now = new Date().toISOString();
  return {
    id: `page_template_${page.id}`, scope: 'app', kind: 'page-template', name: `${page.title} (${page.id}.page)`, version: 1, schemaVersion: 1,
    root: componentNodesToStudioNodes(componentNodes), styleSheet: { scopeId: `page-${page.id.replace(/[^A-Za-z0-9_-]/g, '-')}`, rules: [] }, dependencies: [],
    settings: { cssScope: 'page', dataPolicy: 'mock-only', scriptPolicy: 'none' }, createdAt: now, updatedAt: now,
  };
};

const DEFAULT_STUDIO_PAGES: StudioPageDefinition[] = [
  { id: 'index', name: 'Home (index.page)', title: 'Home', isDefaultPage: true },
  { id: 'about', name: 'AboutUs (about.page)', title: 'AboutUs', isDefaultPage: false },
  { id: 'services', name: 'Services (services.page)', title: 'Services', isDefaultPage: false },
];

const createPageTemplate = (type: string, appName: string, title: string): ComponentNode[] => {
  if (type === 'admin_backend') return createAdminPageTemplate(appName);
  const section = (id: string, name: string, extra: Record<string, unknown>) => ({
    __sectionId: id,
    __sectionName: name,
    stylePreset: `municipal-${id}`,
    ...extra,
  });
  const content: ComponentNode = { id: `content_${Date.now()}`, type: 'DynamicHtmlComponent', props: { __sectionId: 'main', __sectionName: 'Main Content', content: `<section class="p-4"><h1>${title}</h1><p>Start building your ${title} page content here.</p></section>` } };
  if (type === 'municipal_home') return [
    { id: `municipal_nav_${Date.now()}`, type: 'NavMenuComponent', props: section('header', '01. Header & Main Navigation', { brandName: appName, dataSource: { tables: ['cms_menu', 'menu', 'menu_group'] }, items: [{ label: 'หน้าหลัก', href: '/', active: true }, { label: 'ข้อมูลพื้นฐาน', href: '/about' }, { label: 'ข่าวสาร', href: '/news' }, { label: 'บริการประชาชน', href: '/services' }, { label: 'ติดต่อเรา', href: '/contact' }] }) },
    { id: `municipal_hero_${Date.now()}`, type: 'GalleryComponent', props: section('hero', '02. Hero, PR & Executive Highlights', { title: 'ข่าวเด่นและประชาสัมพันธ์', columns: 3, showFilters: false, dataSource: { tables: ['cms_slide', 'cms_post'], filters: { cms_category_id: 1, status: 1 }, limit: 3 }, items: [] }) },
    { id: `municipal_services_${Date.now()}`, type: 'DynamicHtmlComponent', props: section('eservice', '03. Citizen e-Service', { componentRole: 'CitizenServiceGrid', dataSource: { routes: ['/smartreport', '/complaint', '/corrupt', '/forum', '/onlinequeue'] }, content: '<section class="p-4 bg-light rounded-3"><h2>ศูนย์บริการประชาชน e-Service</h2><p>ร้องเรียน ร้องเรียนทุจริต รับฟังความคิดเห็น Q&A และแบบประเมินบริการ</p></section>' }) },
    { id: `municipal_news_${Date.now()}`, type: 'GalleryComponent', props: section('news', '04. Public Relations News', { title: 'ข่าวประชาสัมพันธ์', columns: 3, showFilters: false, dataSource: { table: 'cms_post', filters: { cms_category_id: 1, status: 1 }, orderBy: 'publish_at DESC', limit: 6 }, items: [] }) },
    { id: `municipal_activity_${Date.now()}`, type: 'GalleryComponent', props: section('activities', '05. Activity Gallery', { title: 'ภาพข่าวกิจกรรม', columns: 3, showFilters: false, dataSource: { table: 'cms_post', filters: { cms_category_id: 2, status: 1 }, orderBy: 'publish_at DESC', limit: 6 }, items: [] }) },
    { id: `municipal_ita_${Date.now()}`, type: 'DynamicHtmlComponent', props: section('transparency', '06. Transparency & ITA', { componentRole: 'TransparencyPortal', dataSource: { tables: ['cms_page', 'cms_post', 'cms_file'] }, content: '<section class="p-4 border rounded-3"><h2>ศูนย์ข้อมูลความโปร่งใสและ ITA</h2><p>No Gift Policy, อำนาจหน้าที่, คู่มือบริการ, แผนพัฒนา, งบประมาณ และการจัดซื้อจัดจ้าง</p></section>' }) },
    { id: `municipal_procurement_${Date.now()}`, type: 'TableDataComponent', props: section('procurement', '07. Procurement & e-GP', { title: 'ประกาศจัดซื้อจัดจ้างและ e-GP', columns: [{ key: 'title', label: 'รายการ' }, { key: 'type', label: 'ประเภท' }, { key: 'publishDate', label: 'วันที่' }], data: [], searchable: true, pageSize: 5, dataSource: { tables: ['cms_post', 'cms_egp'], postCategoryIds: [3, 4, 5], egpTypes: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'] } }) },
    { id: `municipal_stats_${Date.now()}`, type: 'CardComponent', props: section('statistics', '08. Community Statistics', { title: 'ข้อมูลสถิติสำคัญ', subtitle: 'ครัวเรือน · หมู่บ้าน · พื้นที่ · ประชากร', value: 'ข้อมูลชุมชน', badge: 'ล่าสุด', variant: 'success', footerText: 'เชื่อมต่อข้อมูลสถิติ อบต.', dataSource: { source: 'organization_settings_or_statistics_api' } }) },
    { id: `municipal_places_${Date.now()}`, type: 'GalleryComponent', props: section('places', '09. Places & Attractions', { title: 'แหล่งท่องเที่ยวและสถานที่สำคัญ', columns: 3, showFilters: false, dataSource: { table: 'cms_post', filters: { cms_category_id: 36, status: 1 }, limit: 3 }, items: [] }) },
    { id: `municipal_otop_${Date.now()}`, type: 'GalleryComponent', props: section('otop', '10. Local Products (OTOP)', { title: 'ผลิตภัณฑ์ในตำบล', columns: 3, showFilters: false, dataSource: { table: 'cms_post', filters: { cms_category_id: 35, status: 1 }, limit: 3 }, items: [] }) },
    { id: `municipal_files_${Date.now()}`, type: 'TableDataComponent', props: section('downloads', '11. Citizen Documents & Downloads', { title: 'บริการประชาชนและแบบฟอร์มดาวน์โหลด', columns: [{ key: 'title', label: 'เอกสาร' }, { key: 'category', label: 'หมวดหมู่' }, { key: 'download', label: 'ดาวน์โหลด' }], data: [], searchable: true, pageSize: 5, dataSource: { tables: ['cms_file', 'cms_file_category'] } }) },
    { id: `municipal_ebooks_${Date.now()}`, type: 'GalleryComponent', props: section('ebooks', '12. E-Book Library', { title: 'หนังสือ วารสาร และเอกสารอิเล็กทรอนิกส์', columns: 4, showFilters: true, dataSource: { tables: ['ebook', 'ebook_category'], orderBy: 'id DESC', limitPerCategory: 8 }, items: [] }) },
    { id: `municipal_links_${Date.now()}`, type: 'DynamicHtmlComponent', props: section('links', '13. Related Agencies & Useful Links', { componentRole: 'AgencyLinkDirectory', dataSource: { tables: ['cms_page', 'cms_menu'] }, content: '<section class="p-4 bg-light rounded-3"><h2>ลิงก์ที่น่าสนใจและหน่วยงานที่เกี่ยวข้อง</h2><p>เว็บไซต์ภาครัฐ ระบบสารสนเทศ และหน่วยงานเครือข่าย</p></section>' }) },
    { id: `municipal_map_${Date.now()}`, type: 'DynamicHtmlComponent', props: section('location', '14. Contact & Map', { componentRole: 'ContactMap', dataSource: { table: 'cms_page', pageId: 66 }, content: '<section class="p-4 border rounded-3"><h2>แผนที่และการเดินทาง</h2><p>ข้อมูลติดต่อ ที่อยู่ โทรศัพท์ อีเมล และ Google Maps</p></section>' }) },
  ];
  if (type === 'top_nav_content') return [
    { id: `nav_${Date.now()}`, type: 'NavMenuComponent', props: { __sectionId: 'header', __sectionName: 'Header Section', brandName: appName, items: [{ label: 'Home', href: '/' }, { label: 'About', href: '/about' }, { label: 'Services', href: '/services' }] } }, content,
  ];
  if (type === 'sidebar_content') return [
    { id: `side_${Date.now()}`, type: 'SlideMenuComponent', props: { __sectionId: 'sidebar', __sectionName: 'Sidebar Section', title: appName, items: [{ id: 'home', label: 'Home', href: '/', active: true }, { id: 'about', label: 'About', href: '/about' }, { id: 'services', label: 'Services', href: '/services' }] } }, content,
  ];
  if (type === 'dashboard') return [
    { id: `nav_${Date.now()}`, type: 'NavMenuComponent', props: { __sectionId: 'header', __sectionName: 'Header Section', brandName: appName, items: [{ label: 'Dashboard', href: '/', active: true }] } },
    { id: `card_${Date.now()}`, type: 'CardComponent', props: { __sectionId: 'summary', __sectionName: 'Dashboard Summary', title: 'Overview', subtitle: title, value: '0', badge: 'Ready', variant: 'primary', footerText: 'Connect your data source' } }, content,
  ];
  return [content];
};

const createImageDashboardDraft = (request: Pick<GenPageFromImageRequest, 'image' | 'viewport' | 'analysis'>): ComponentNode[] => {
  const uid = Date.now();
  const metrics = [['ข่าวสาร / เนื้อหา','728','เผยแพร่แล้ว 716 รายการ'],['หน้าเว็บไซต์','38',''],['ไฟล์ดาวน์โหลด','5',''],['E-Book','0',''],['บุคลากร','49',''],['ภาพสไลด์','10',''],['ร้องเรียน / ร้องทุกข์','0','ดำเนินการครบแล้ว'],['ผู้ใช้งานระบบ','11','']];
  const news = [['ประกาศรายชื่อผู้มีสิทธิเข้ารับการสรรหาและเลือกสรรเป็นพนักงานจ้าง','21/08/2026 11:09 · ข่าวสารประชาสัมพันธ์'],['สรุปผลการจัดซื้อจัดจ้าง ประจำเดือนกรกฎาคม พ.ศ. 2569','14/08/2026 10:59 · สรุปผลการดำเนินการจัดซื้อจัดจ้าง'],['ประกาศรับสมัครบุคคลเพื่อการสรรหาและการเลือกสรรเป็นพนักงานจ้าง','27/07/2026 10:16 · ข่าวสารประชาสัมพันธ์'],['สรุปผลการจัดซื้อจัดจ้าง ประจำเดือนมิถุนายน 2569','14/07/2026 15:31 · สรุปผลการดำเนินการจัดซื้อจัดจ้าง'],['สรุปผลการจัดซื้อจัดจ้าง ประจำเดือนพฤษภาคม 2569','14/07/2026 15:31 · สรุปผลการดำเนินการจัดซื้อจัดจ้าง'],['ประกาศจัดตั้งศูนย์ปฏิบัติการฉุกเฉินองค์การบริหารส่วนตำบลยาง','13/07/2026 21:03 · ข่าวสารประชาสัมพันธ์'],['กิจกรรมพัฒนาวัดบ้านโคก ตามโครงการ วัด ประชารัฐ สร้างสุข','01/07/2026 09:58 · กิจกรรม']];
  const metricHtml = metrics.map(([label,value,note]) => `<div class="col-12 col-md-6 col-xl-3"><article class="gpfi-card gpfi-metric"><span class="gpfi-icon">▣</span><div><strong>${value}</strong><div>${label}</div>${note ? `<small>${note}</small>` : ''}</div></article></div>`).join('');
  const newsHtml = news.map(([title,meta]) => `<li><i></i><div><b>${title}</b><small>${meta}</small></div><span>เผยแพร่</span></li>`).join('');
  const actions = ['เพิ่มข่าวสาร','เพิ่มหน้าเว็บ','จัดการเมนู','ภาพสไลด์','อัปโหลดไฟล์','บุคลากร','ร้องเรียน','ผู้ใช้งาน'];
  const content = `<style>.gpfi{--g:#0b641d;background:#f8faf4;color:#071b0a;min-height:100%;font-family:Sarabun,Arial,sans-serif}.gpfi-card{background:#fff;border:1px solid #dbe6bd;border-radius:16px;box-shadow:0 6px 18px rgba(31,65,14,.04);padding:16px}.gpfi-metric{min-height:90px;display:flex;align-items:center;gap:15px}.gpfi-metric strong{font-size:24px}.gpfi-metric small,.gpfi-news small{display:block;color:#94a3b8}.gpfi-icon{width:44px;height:44px;border-radius:14px;background:#edf5fa;display:grid;place-items:center;color:var(--g);font-size:20px}.gpfi-head{background:#f4f7fa;border-bottom:1px solid #dbe6bd;padding:14px 18px;display:flex;justify-content:space-between}.gpfi-news{list-style:none;padding:8px 16px;margin:0}.gpfi-news li{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #edf1f5}.gpfi-news li>div{flex:1}.gpfi-news i{width:8px;height:8px;border-radius:50%;background:#11a34a}.gpfi-news span{background:#11863e;color:#fff;padding:3px 9px;border-radius:20px;font-size:11px}.gpfi-stat{background:#f2f6fa;border-radius:14px;padding:12px}.gpfi-stat b,.gpfi-stat small{display:block}.gpfi-stat b{font-size:22px;color:var(--g)}</style><div class="gpfi container-fluid py-3"><div class="d-flex justify-content-between border-bottom border-warning border-3 pb-3 mb-4"><b>แผงควบคุม</b><button class="btn btn-sm btn-light border">อบต.ยาง ▾</button></div><div class="small mb-5">⌂ หน้าหลัก　›　แผงควบคุม</div><div class="row g-3 mb-4">${metricHtml}</div><div class="row g-3"><div class="col-12 col-xl-9"><section class="gpfi-card p-0 overflow-hidden h-100"><header class="gpfi-head"><b>◷ ข่าวสารล่าสุด</b><span>ดูทั้งหมด →</span></header><ul class="gpfi-news">${newsHtml}</ul></section></div><div class="col-12 col-xl-3 d-flex flex-column gap-3"><section class="gpfi-card p-0 overflow-hidden"><header class="gpfi-head"><b>สถิติผู้เข้าชม (14 วัน)</b></header><div class="row g-2 p-3 text-center"><div class="col-6"><div class="gpfi-stat"><b>0</b><small>วันนี้</small></div></div><div class="col-6"><div class="gpfi-stat"><b>0</b><small>7 วันที่ผ่านมา</small></div></div></div></section><section class="gpfi-card p-0 overflow-hidden"><header class="gpfi-head"><b>ϟ ทางลัด</b></header><div class="row g-2 p-3">${actions.map((item) => `<div class="col-6"><button class="btn btn-light border w-100 text-start small">＋ ${item}</button></div>`).join('')}</div></section></div></div></div>`;
  return [{ id: `gen_image_dashboard_${uid}`, type: 'DynamicHtmlComponent', templateRef: 'component://DynamicHtmlComponent', htmlId: `cmp-gen-image-${uid}`, label: 'Generated Dashboard from Image', props: { __sectionId: 'generated-dashboard', __sectionName: 'Generated Dashboard', componentRole: 'GenPageFromImageDraft', sourceImageUrl: request.image.url, sourceImagePath: request.image.path, viewport: request.viewport, analysis: request.analysis, fixedCollections: { metrics, news, actions }, content } }];
};

export default function StudioPage() {
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [activePage, setActivePage] = useState<string>('index');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isPageManagerOpen, setIsPageManagerOpen] = useState<boolean>(false);
  const [pageManagerContainer, setPageManagerContainer] = useState<string | null>(null);

  // Active App Configuration & Layout AST
  const [appInfo, setAppInfo] = useState<AppConfig>({
    id: 'demo-app-01',
    appSlug: 'client-a',
    appName: 'Siam Enterprise Portal',
    port: 3001,
    subdomain: 'client-a.localhost',
    tenantDbName: 'app_db_client_a',
    themeConfig: {
      preset: 'modern-indigo',
      mode: 'light',
      primaryColor: '#4f46e5',
      borderRadius: '0.5rem',
      fontFamily: 'Inter, sans-serif',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [nodes, setNodes] = useState<ComponentNode[]>([
    {
      id: 'nav_header',
      type: 'NavMenuComponent',
      props: {
        brandName: 'Siam Enterprise Portal',
        items: [
          { label: 'Home', href: '#', active: true },
          { label: 'Services', href: '#' },
          { label: 'Contact', href: '#' },
        ],
      },
    },
    {
      id: 'metric_card',
      type: 'CardComponent',
      props: {
        title: 'Total Active Revenue',
        subtitle: 'Tenant Child App B',
        value: '$48,250',
        badge: '+18.4%',
        variant: 'primary',
        footerText: 'Realtime updated',
      },
    },
    {
      id: 'form_lead',
      type: 'FormComponent',
      props: {
        title: 'New Client Registration',
        description: 'Visual Studio 2022 Low-Code Form Designer',
        submitText: 'Create Account',
        fields: [
          { name: 'fullName', label: 'Full Name', placeholder: 'Enter name...', required: true },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'email@domain.com' },
        ],
      },
    },
  ]);

  // History Stack Manager for Undo / Redo
  const historyRef = useRef<HistoryStackManager | null>(null);
  if (!historyRef.current) {
    historyRef.current = new HistoryStackManager(nodes);
  }

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [platformId, setPlatformId] = useState<string | null>(null);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [isLoadingPlatform, setIsLoadingPlatform] = useState(true);
  const [studioPages, setStudioPages] = useState(DEFAULT_STUDIO_PAGES);
  const [studioRoutes, setStudioRoutes] = useState<AppRoute[]>([]);
  const [studioForms, setStudioForms] = useState<StudioFormDefinition[]>([]);
  const [studioCollections, setStudioCollections] = useState<StudioCollectionDefinition[]>([]);
  const [showAppComponentImageWizard, setShowAppComponentImageWizard] = useState(false);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [activeFormMode, setActiveFormMode] = useState<'insert' | 'update' | 'readOnly'>('insert');
  const [activeCollectionView, setActiveCollectionView] = useState<{ collectionId: string; viewId: string; variant: string } | null>(null);
  const [showInitializeModal, setShowInitializeModal] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedPageFlow, setSelectedPageFlow] = useState<{ path: string; label: string; type: 'public_page' | 'form_crud' } | null>(null);
  const [selectedRawTable, setSelectedRawTable] = useState<string | null>(null);
  const [activeSurface, setActiveSurface] = useState<'frontend' | 'backend'>('frontend');
  const [pageTemplateTarget, setPageTemplateTarget] = useState<StudioPageDefinition | null>(null);
  const [isCreatingPageLayout, setIsCreatingPageLayout] = useState(false);
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isPageDirty, setIsPageDirty] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [workshopNodeId, setWorkshopNodeId] = useState<string | null>(null);
  const [pageSettingsId, setPageSettingsId] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const activeStudioPage = !activeFormId && !activeCollectionView ? studioPages.find((page) => page.id === activePage) : undefined;
  const pageStudioDocument = useMemo(() => activeStudioPage ? createPageStudioDocument(activeStudioPage, nodes) : null, [activeStudioPage, nodes]);
  const activeStudioForm = activeFormId ? studioForms.find((form) => form.id === activeFormId) : undefined;
  const formStudioDocument = useMemo(() => activeStudioForm ? createPageStudioDocument({ id: `${activeStudioForm.id}-${activeFormMode}`, name: activeStudioForm.name, title: `${activeStudioForm.name} · ${activeFormMode}` }, activeStudioForm.modeComponentTrees?.[activeFormMode] || activeStudioForm.componentTree) : null, [activeStudioForm, activeFormMode]);
  const activeCollectionDefinition = activeCollectionView ? studioCollections.find((collection) => collection.id === activeCollectionView.collectionId) : undefined;
  const activeCollectionComponent = activeCollectionDefinition?.components.find((component) => component.id === activeCollectionView?.viewId);
  const collectionStudioDocument = useMemo(() => activeCollectionView && activeCollectionComponent ? createPageStudioDocument({ id: `${activeCollectionComponent.id}-${activeCollectionView.variant}`, name: activeCollectionComponent.label, title: `${activeCollectionComponent.label} · ${activeCollectionView.variant}` }, activeCollectionComponent.variantComponentTrees?.[activeCollectionView.variant] || activeCollectionComponent.componentTree) : null, [activeCollectionView, activeCollectionComponent]);

  useEffect(() => {
    if (!isPageDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isPageDirty]);

  const handleSavePageStudioDocument = async (document: HtmlStudioDocument) => {
    if (!activeStudioPage || !platformId) return;
    const templateNode: ComponentNode = { id: `html_page_${activeStudioPage.id}`, type: 'HtmlTemplateComponent', label: `${activeStudioPage.title} HTML Studio`, props: { document } };
    const nextPages = studioPages.map((page) => page.id === activeStudioPage.id ? { ...page, templateType: 'html-studio', componentTree: [templateNode] } : page);
    setSaveStatus('Saving Page to database...'); setStudioError(null);
    try {
      const response = await fetch(`/api/platforms/${platformId}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: [templateNode], studioPages: nextPages, studioForms, studioCollections }) });
      const data = (await response.json()) as { platform?: { studioPages?: StudioPageDefinition[] }; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to save Page to database');
      updateNodesWithHistory([templateNode], `Update HTML Studio Page (${activeStudioPage.id})`);
      setStudioPages(data.platform?.studioPages || nextPages); setIsPageDirty(false); setSaveStatus('Page saved to database');
    } catch (error) { setStudioError(error instanceof Error ? error.message : 'Unable to save Page to database'); setIsPageDirty(true); setSaveStatus('Save Page failed'); }
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSaveFormStudioDocument = async (document: HtmlStudioDocument) => {
    if (!activeStudioForm || !platformId) return;
    const templateNode: ComponentNode = { id: `html_form_${activeStudioForm.id}_${activeFormMode}`, type: 'HtmlTemplateComponent', label: `${activeStudioForm.name} ${activeFormMode}`, props: { document, formId: activeStudioForm.id, collectionId: activeStudioForm.collectionId, mode: activeFormMode } };
    const nextForms = studioForms.map((form) => form.id === activeStudioForm.id ? { ...form, modeComponentTrees: { ...(form.modeComponentTrees || {}), [activeFormMode]: [templateNode] }, version: form.version + 1 } : form);
    setSaveStatus('Saving Form design...');
    try {
      const response = await fetch(`/api/platforms/${platformId}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: nodes, studioPages, studioForms: nextForms, studioCollections }) });
      if (!response.ok) throw new Error('Unable to save Form design');
      setStudioForms(nextForms); setNodes([templateNode]); setIsPageDirty(false); setSaveStatus('Form design saved');
    } catch (error) { setStudioError(error instanceof Error ? error.message : 'Unable to save Form design'); setIsPageDirty(true); }
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSaveCollectionStudioDocument = async (document: HtmlStudioDocument) => {
    if (!activeCollectionView || !activeCollectionDefinition || !activeCollectionComponent || !platformId) return;
    const templateNode: ComponentNode = { id: `html_collection_${activeCollectionComponent.id}_${activeCollectionView.variant}`, type: 'HtmlTemplateComponent', label: `${activeCollectionComponent.label} ${activeCollectionView.variant}`, props: { document, collectionId: activeCollectionDefinition.id, componentId: activeCollectionComponent.id, variant: activeCollectionView.variant } };
    const nextCollections = studioCollections.map((collection) => collection.id !== activeCollectionDefinition.id ? collection : { ...collection, components: collection.components.map((component) => component.id !== activeCollectionComponent.id ? component : { ...component, variantComponentTrees: { ...(component.variantComponentTrees || {}), [activeCollectionView.variant]: [templateNode] } }) });
    setSaveStatus('Saving Collection Component...');
    try {
      const response = await fetch(`/api/platforms/${platformId}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: nodes, studioPages, studioForms, studioCollections: nextCollections }) });
      if (!response.ok) throw new Error('Unable to save Collection Component');
      setStudioCollections(nextCollections); setNodes([templateNode]); setIsPageDirty(false); setSaveStatus('Collection Component saved');
    } catch (error) { setStudioError(error instanceof Error ? error.message : 'Unable to save Collection Component'); setIsPageDirty(true); }
    setTimeout(() => setSaveStatus(null), 3000);
  };

  useEffect(() => {
    const selectedPlatformId = new URLSearchParams(window.location.search).get('platformId');
    setPlatformId(selectedPlatformId);

    if (!selectedPlatformId) {
      setStudioError('ไม่พบ platformId กรุณาเข้า Studio จากหน้า Platforms');
      setIsLoadingPlatform(false);
      return;
    }

    const loadPlatform = async () => {
      try {
        const response = await fetch(`/api/platforms/${selectedPlatformId}/studio`, { cache: 'no-store' });
        const data = (await response.json()) as {
          platform?: {
            id: string;
            platformSlug: string;
            platformName: string;
            masterThemeConfig: AppConfig['themeConfig'];
            studioLayout: ComponentNode[];
            studioPages: StudioPageDefinition[];
            studioForms: StudioFormDefinition[];
            studioCollections: StudioCollectionDefinition[];
            studioRoutes: AppRoute[];
            studioInitialized: boolean;
          };
          error?: string;
        };
        if (!response.ok || !data.platform) throw new Error(data.error || 'ไม่สามารถโหลด Platform ได้');

        const platform = data.platform;
        setAppInfo((current) => ({
          ...current,
          id: platform.id,
          appSlug: platform.platformSlug,
          appName: platform.platformName,
          tenantDbName: `platform_${platform.platformSlug.replace(/-/g, '_')}`,
          themeConfig: platform.masterThemeConfig,
        }));
        if (platform.studioPages.length > 0) {
          const databasePages = platform.studioPages;
          const initialPage = databasePages.find((page) => page.id === activePage) || databasePages.find((page) => page.isDefaultPage) || databasePages[0];
          const initialTree = initialPage.componentTree || [];
          setStudioPages(databasePages); setActivePage(initialPage.id); setNodes(initialTree);
          historyRef.current = new HistoryStackManager(initialTree);
        } else if (platform.studioLayout.length > 0) {
          setNodes(platform.studioLayout); historyRef.current = new HistoryStackManager(platform.studioLayout);
        }
        setStudioForms(Array.isArray(platform.studioForms) ? platform.studioForms : []);
        setStudioCollections(Array.isArray(platform.studioCollections) ? platform.studioCollections : []);
        setStudioRoutes(Array.isArray(platform.studioRoutes) ? platform.studioRoutes : []);
        if (!platform.studioInitialized) setShowInitializeModal(true);
      } catch (error) {
        setStudioError(error instanceof Error ? error.message : 'ไม่สามารถโหลด Platform ได้');
      } finally {
        setIsLoadingPlatform(false);
      }
    };

    void loadPlatform();
  }, []);

  const handleSelectDesignPage = async (pageId: string) => {
    if (pageId === activePage && !activeFormId && !activeCollectionView) return;
    if (isPageDirty && !window.confirm('หน้าปัจจุบันมีการแก้ไขที่ยังไม่ได้ Save Page\n\nกด OK เพื่อทิ้งการแก้ไขและเปิดหน้าใหม่ หรือ Cancel เพื่อกลับไปบันทึกก่อน')) return;
    if (!platformId) return;
    setIsLoadingPage(true); setStudioError(null);
    try {
      const response = await fetch(`/api/platforms/${platformId}/studio?selectedPageId=${encodeURIComponent(pageId)}&t=${Date.now()}`, { cache: 'no-store' });
      const data = (await response.json()) as { platform?: { studioPages: StudioPageDefinition[] }; error?: string };
      if (!response.ok || !data.platform) throw new Error(data.error || 'Unable to load Page from database');
      const databasePages = Array.isArray(data.platform.studioPages) ? data.platform.studioPages : [];
      const page = databasePages.find((item) => item.id === pageId);
      if (!page) throw new Error(`Page '${pageId}' was not found in database`);
      setStudioPages(databasePages);
      setSelectedPageFlow(null); setActiveFormId(null); setActiveCollectionView(null); setActivePage(pageId); setSelectedNodeId(null);
      const componentTree = Array.isArray(page.componentTree) ? page.componentTree : [];
      setNodes(componentTree); historyRef.current = new HistoryStackManager(componentTree); setIsPageDirty(false);
      if (!page.templateType || !Array.isArray(page.componentTree)) setPageTemplateTarget(page);
    } catch (error) { setStudioError(error instanceof Error ? error.message : 'Unable to load Page from database'); }
    finally { setIsLoadingPage(false); }
  };

  const openComponentWorkshop = async (pageId: string, nodeId: string) => {
    if (pageId !== activePage || activeFormId || activeCollectionView) await handleSelectDesignPage(pageId);
    setSelectedPageFlow(null); setSelectedRawTable(null); setPageSettingsId(null); setSelectedNodeId(nodeId); setWorkshopNodeId(nodeId);
  };

  const openPageSettings = async (pageId: string) => {
    if (pageId !== activePage || activeFormId || activeCollectionView) await handleSelectDesignPage(pageId);
    setSelectedPageFlow(null); setSelectedRawTable(null); setWorkshopNodeId(null); setSelectedNodeId(null); setPageSettingsId(pageId);
  };

  const handleSaveWorkshopComponent = (component: ComponentNode) => {
    if (component.htmlId && nodes.some((node) => node.id !== component.id && node.htmlId === component.htmlId)) {
      window.alert(`HTML ID '${component.htmlId}' ถูกใช้โดย Component อื่นใน Page นี้แล้ว`);
      return;
    }
    const updated = nodes.map((node) => node.id === component.id ? component : node);
    updateNodesWithHistory(updated, `Update Component Workshop (${component.id})`);
    setSelectedNodeId(component.id); setIsPageDirty(true);
  };

  const handleAddPageSection = (name: string) => {
    const sectionId = name.toLowerCase().trim().replace(/[^a-z0-9ก-๙]+/g, '-').replace(/^-|-$/g, '') || `section-${Date.now()}`;
    const instanceId = `section_${Date.now()}`;
    const node: ComponentNode = { id: instanceId, type: 'DynamicHtmlComponent', templateRef: 'component://DynamicHtmlComponent', htmlId: `cmp-${instanceId}`, label: name, props: { __sectionId: sectionId, __sectionName: name, content: `<section class="p-4"><h2>${name}</h2></section>` } };
    updateNodesWithHistory([...nodes, node], `Add Section (${name})`); setIsPageDirty(true);
  };

  const handleSavePageSettings = async (settings: PageSettingsValue) => {
    if (!platformId || !pageSettingsId) return;
    const nextPages = studioPages.map((page) => page.id === pageSettingsId ? { ...page, settings, templateType: settings.layoutType || page.templateType, componentTree: page.id === activePage ? nodes : page.componentTree } : page);
    setSaveStatus('Saving Page settings...');
    try {
      const response = await fetch(`/api/platforms/${platformId}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: nodes, studioPages: nextPages, studioForms, studioCollections }) });
      if (!response.ok) throw new Error('Unable to save Page settings');
      setStudioPages(nextPages); setIsPageDirty(false); setSaveStatus('Page settings saved');
    } catch (error) { setStudioError(error instanceof Error ? error.message : 'Unable to save Page settings'); setSaveStatus('Save settings failed'); }
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleGeneratePageFromImage = async (request: GenPageFromImageRequest) => {
    if (!platformId || !pageSettingsId) return;
    const targetPage = studioPages.find((page) => page.id === pageSettingsId);
    if (!targetPage) return;
    const generatedAt = new Date().toISOString();
    const generatedNodes = createImageDashboardDraft(request);
    const nextTree = request.mode === 'append' ? [...nodes, ...generatedNodes] : generatedNodes;
    const settings: PageSettingsValue = {
      ...(targetPage.settings || {}), layoutType: 'dashboard-grid',
      collectionSources: ['generated.dashboard.metrics', 'generated.dashboard.latest-news', 'generated.visitor', 'generated.quick-actions'],
      generatedFromImage: { sourceImageUrl: request.image.url, sourceImagePath: request.image.path, viewport: request.viewport, mode: request.mode, generatedAt, sections: request.analysis.sections },
    };
    const nextPages = studioPages.map((page) => {
      if (page.id !== pageSettingsId) return page;
      const layoutHistory = page.componentTree?.length ? [...(page.layoutHistory || []), { templateType: page.templateType || 'custom', componentTree: page.componentTree, savedAt: generatedAt }].slice(-10) : page.layoutHistory || [];
      return { ...page, title: request.pageTitle || page.title, templateType: 'generated-from-image', settings, componentTree: nextTree, layoutHistory };
    });
    setSaveStatus('Generating page from image...'); setStudioError(null);
    try {
      const response = await fetch(`/api/platforms/${platformId}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: nextTree, studioPages: nextPages, studioForms, studioCollections }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to generate Page from image');
      setStudioPages(nextPages); setNodes(nextTree); historyRef.current = new HistoryStackManager(nextTree); setIsPageDirty(false); setPageSettingsId(null); setSaveStatus('Page generated and saved');
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : 'Unable to generate Page from image'); setSaveStatus('Generation failed'); throw error;
    } finally { setTimeout(() => setSaveStatus(null), 3000); }
  };

  const handleSelectDesignForm = (formId: string, mode: 'insert' | 'update' | 'readOnly') => {
    const form = studioForms.find((item) => item.id === formId);
    if (!form) return;
    const modeTree = form.modeComponentTrees?.[mode] || form.componentTree;
    setSelectedPageFlow(null); setActiveFormId(formId); setActiveFormMode(mode); setActiveCollectionView(null); setSelectedNodeId(null);
    setNodes(modeTree); historyRef.current = new HistoryStackManager(modeTree); setIsPageDirty(false);
  };

  const handleAddCollectionForm = async (collectionId: string) => {
    if (!platformId) return;
    const collection = studioCollections.find((item) => item.id === collectionId);
    if (!collection) return;
    const base = studioForms.find((form) => form.collectionId === collectionId);
    const suffix = studioForms.filter((form) => form.collectionId === collectionId).length + 1;
    const id = `${collectionId.replace(/\.collection$/, '')}.form-${suffix}`;
    const componentTree: ComponentNode[] = base ? JSON.parse(JSON.stringify(base.componentTree)) as ComponentNode[] : [{ id: `${id}_form`, type: 'FormComponent', props: { title: `${collection.name} Form ${suffix}`, formId: id, collectionId, fields: [], submitText: 'Save' } }];
    const nextForm: StudioFormDefinition = { id, moduleId: collection.moduleId, name: `${collection.name} Form ${suffix}`, permission: base?.permission || collection.moduleId, collectionId, source: base?.source || { routeCreate: '', routeUpdate: '', formView: '', model: '' }, componentTree, version: 1 };
    const nextForms = [...studioForms, nextForm];
    const response = await fetch(`/api/platforms/${platformId}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: nodes, studioPages, studioForms: nextForms, studioCollections }) });
    if (!response.ok) { setStudioError('Unable to add Form to Collection'); return; }
    setStudioForms(nextForms); handleSelectDesignForm(id, 'insert');
  };

  const handleSelectCollectionView = (collectionId: string, viewId: string, variant = 'default') => {
    const collection = studioCollections.find((item) => item.id === collectionId);
    const view = collection?.components.find((item) => item.id === viewId);
    if (!collection || !view) return;
    const variantTree = view.variantComponentTrees?.[variant] || view.componentTree;
    setSelectedPageFlow(null); setActiveFormId(null); setActiveCollectionView({ collectionId, viewId, variant }); setSelectedNodeId(null);
    setNodes(variantTree); historyRef.current = new HistoryStackManager(variantTree); setIsPageDirty(false);
  };

  const handleAddCollectionComponent = async (collectionId: string, sourceComponentId: string) => {
    if (!platformId) return;
    const collection = studioCollections.find((item) => item.id === collectionId); if (!collection) return;
    const base = collection.components.find((item) => item.id === sourceComponentId); if (!base) return;
    const sameType = collection.components.filter((item) => item.type === base.type && item.label.replace(/ \d+$/, '') === base.label.replace(/ \d+$/, ''));
    const copy = JSON.parse(JSON.stringify(base)) as typeof base;
    copy.id = `${base.id}-${sameType.length + 1}`; copy.label = `${base.label} ${sameType.length + 1}`; copy.recommended = false;
    const nextCollections = studioCollections.map((item) => item.id === collectionId ? { ...item, components: [...item.components, copy] } : item);
    const response = await fetch(`/api/platforms/${platformId}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: nodes, studioPages, studioForms, studioCollections: nextCollections }) });
    if (!response.ok) { setStudioError('Unable to add Collection Component'); return; }
    setStudioCollections(nextCollections); handleSelectCollectionView(collectionId, copy.id, 'default');
  };

  const handleGenerateAppComponentFromImage = async (request: GenAppComponentFromImageRequest) => {
    if (!platformId) return;
    const slugBase = request.name.toLowerCase().trim().replace(/[^a-z0-9ก-๙]+/g, '-').replace(/^-|-$/g, '') || `image-component-${Date.now()}`;
    let slug = slugBase;
    let suffix = 2;
    while (studioCollections.some((collection) => collection.id === `generated.${slug}.collection`)) slug = `${slugBase}-${suffix++}`;
    const collectionId = `generated.${slug}.collection`;
    const componentId = `${collectionId}.app-component`;
    const componentTree = createImageDashboardDraft(request).map((node) => ({ ...node, label: request.name, props: { ...node.props, collectionId, generatedAppComponent: true } }));
    const generatedCollection: StudioCollectionDefinition = {
      id: collectionId, moduleId: 'generated', name: request.name, table: `fixed_${slug.replace(/[^a-z0-9]+/g, '_')}`, primaryKey: ['id'], operations: ['list', 'get'], scope: 'project', tenantTarget: true,
      standardFlows: {
        create: { trigger: 'create', target: 'FormComponent', formId: `${collectionId}.form`, params: { mode: 'insert' } },
        edit: { trigger: 'edit', source: 'DataTableComponent', target: 'FormComponent', formId: `${collectionId}.form`, rowIdField: 'id', params: { mode: 'update' } },
        view: { trigger: 'view', source: 'DataTableComponent', target: 'DynamicHtmlComponent', componentId, rowIdField: 'id', params: { mode: 'preview' } },
      },
      components: [{ id: componentId, type: 'DynamicHtmlComponent', label: request.name, recommended: true, componentTree, variantComponentTrees: { default: componentTree, preview: componentTree, full: componentTree } }],
    };
    const nextCollections = [...studioCollections, generatedCollection];
    setSaveStatus('Generating reusable AppComponent...'); setStudioError(null);
    try {
      const response = await fetch(`/api/platforms/${platformId}/studio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studioLayout: nodes, studioPages, studioForms, studioCollections: nextCollections }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to save generated AppComponent');
      setStudioCollections(nextCollections); setActiveFormId(null); setActiveCollectionView({ collectionId, viewId: componentId, variant: 'default' }); setNodes(componentTree); historyRef.current = new HistoryStackManager(componentTree); setSaveStatus('Reusable AppComponent created');
    } catch (error) { setStudioError(error instanceof Error ? error.message : 'Unable to generate AppComponent'); setSaveStatus('Generation failed'); throw error; }
    finally { setTimeout(() => setSaveStatus(null), 3000); }
  };

  const handleCreatePageLayout = async (templateType: string) => {
    if (!platformId || !pageTemplateTarget || isCreatingPageLayout) return;
    setIsCreatingPageLayout(true);
    setStudioError(null);
    const componentTree = createPageTemplate(templateType, appInfo.appName, pageTemplateTarget.title);
    const nextPages = studioPages.map((page) => {
      if (page.id !== pageTemplateTarget.id) return page;
      const layoutHistory = Array.isArray(page.componentTree) && page.componentTree.length > 0
        ? [...(page.layoutHistory || []), { templateType: page.templateType || 'custom', componentTree: page.componentTree, savedAt: new Date().toISOString() }].slice(-10)
        : page.layoutHistory || [];
      return { ...page, templateType, componentTree, layoutHistory };
    });
    try {
      const response = await fetch(`/api/platforms/${platformId}/studio`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioLayout: componentTree, studioPages: nextPages }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'สร้าง Page Layout ไม่สำเร็จ');
      setStudioPages(nextPages);
      setNodes(componentTree);
      historyRef.current = new HistoryStackManager(componentTree);
      setPageTemplateTarget(null);
      setSaveStatus('Page layout created in database');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : 'สร้าง Page Layout ไม่สำเร็จ');
    } finally {
      setIsCreatingPageLayout(false);
    }
  };

  const pagesWithCurrentDesign = () => studioPages.map((page) => page.id === activePage
    ? { ...page, componentTree: nodes, templateType: page.templateType || 'custom' }
    : page);

  const persistManagedPages = async (nextPages: StudioPageDefinition[], layout: ComponentNode[] = nodes) => {
    if (!platformId) throw new Error('ไม่พบ Platform สำหรับบันทึก Page Layout');
    const response = await fetch(`/api/platforms/${platformId}/studio`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studioLayout: layout, studioPages: nextPages }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error || 'บันทึก Page Layout ไม่สำเร็จ');
    setStudioPages(nextPages);
    setSaveStatus('Page layouts saved to database');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleCreateManagedPage = async ({ slug, title, templateType, containerName }: { slug: string; title: string; templateType: string; containerName: string }) => {
    const currentPages = pagesWithCurrentDesign();
    if (currentPages.some((page) => page.id.toLowerCase() === slug.toLowerCase())) throw new Error(`Page /${slug} มีอยู่แล้ว`);
    const componentTree = createPageTemplate(templateType, appInfo.appName, title);
    const nextPage: StudioPageDefinition = { id: slug, name: `${title} (${slug}.page)`, title, containerName, templateType, componentTree, isDefaultPage: currentPages.length === 0 };
    await persistManagedPages([...currentPages, nextPage], componentTree);
    setActivePage(slug); setSelectedPageFlow(null); setSelectedNodeId(null); setNodes(componentTree);
    historyRef.current = new HistoryStackManager(componentTree);
  };

  const handleCloneManagedPage = async (pageId: string, containerName: string) => {
    const currentPages = pagesWithCurrentDesign(); const source = currentPages.find((page) => page.id === pageId);
    if (!source) throw new Error('ไม่พบหน้าที่ต้องการ Clone');
    let slug = `${source.id}_copy`; let suffix = 2;
    while (currentPages.some((page) => page.id === slug)) slug = `${source.id}_copy_${suffix++}`;
    const componentTree = structuredClone(source.componentTree || []);
    const cloned = { ...source, id: slug, name: `${source.title} Copy (${slug}.page)`, title: `${source.title} Copy`, containerName, componentTree, isDefaultPage: false };
    await persistManagedPages([...currentPages, cloned], componentTree);
    setActivePage(slug); setNodes(componentTree); setSelectedPageFlow(null); setSelectedNodeId(null);
    historyRef.current = new HistoryStackManager(componentTree);
  };

  const handleMoveManagedPage = async (pageId: string, containerName: string) => {
    const currentPages = pagesWithCurrentDesign();
    const target = currentPages.find((page) => page.id === pageId);
    if (!target) throw new Error('ไม่พบหน้าที่ต้องการย้าย');
    if (target.containerName === containerName) return;
    const nextPages = currentPages.map((page) => page.id === pageId ? { ...page, containerName } : page);
    await persistManagedPages(nextPages, target.componentTree || nodes);
  };

  const handleDeleteManagedPage = async (pageId: string) => {
    const currentPages = pagesWithCurrentDesign(); const target = currentPages.find((page) => page.id === pageId);
    if (!target) throw new Error('ไม่พบหน้าที่ต้องการลบ');
    if (target.isDefaultPage) throw new Error('กรุณาตั้งหน้าอื่นเป็น Start Page ก่อนลบ');
    const nextPages = currentPages.filter((page) => page.id !== pageId);
    const nextActive = pageId === activePage ? (nextPages.find((page) => page.isDefaultPage) || nextPages[0]) : nextPages.find((page) => page.id === activePage);
    const nextLayout = nextActive?.componentTree || nodes;
    await persistManagedPages(nextPages, nextLayout);
    if (pageId === activePage && nextActive) { setActivePage(nextActive.id); setNodes(nextLayout); historyRef.current = new HistoryStackManager(nextLayout); }
  };

  const handleSetDefaultManagedPage = async (pageId: string) => {
    const nextPages = pagesWithCurrentDesign().map((page) => ({ ...page, isDefaultPage: page.id === pageId }));
    await persistManagedPages(nextPages);
  };

  const handleInitializeStudio = async () => {
    if (!platformId || isInitializing) return;
    setIsInitializing(true);
    setStudioError(null);
    try {
      const response = await fetch(`/api/platforms/${platformId}/studio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioLayout: nodes, studioPages: DEFAULT_STUDIO_PAGES }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'สร้างข้อมูล Studio ไม่สำเร็จ');
      setStudioPages(DEFAULT_STUDIO_PAGES);
      setShowInitializeModal(false);
      setSaveStatus('Default Studio data created');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : 'สร้างข้อมูล Studio ไม่สำเร็จ');
    } finally {
      setIsInitializing(false);
    }
  };

  // Helper to update nodes and record state in history stack
  const updateNodesWithHistory = (newNodes: ComponentNode[], description: string = 'Update AST') => {
    setNodes(newNodes);
    historyRef.current?.pushState(newNodes, description);
  };

  const handleUndo = () => {
    const prev = historyRef.current?.undo();
    if (prev) setNodes(prev);
  };

  const handleRedo = () => {
    const next = historyRef.current?.redo();
    if (next) setNodes(next);
  };

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveToDatabase();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, platformId]);

  // Add component to canvas
  const handleAddComponent = (paletteItem: ComponentPaletteItem) => {
    if (!activeFormId && !activeCollectionView && activePage !== 'app_workflow') {
      window.dispatchEvent(new CustomEvent('lowcode:add-html-studio-component', { detail: { componentType: paletteItem.type, label: paletteItem.label, defaultProps: paletteItem.defaultProps } }));
      return;
    }
    const instanceId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newNode: ComponentNode = {
      id: instanceId,
      type: paletteItem.type,
      templateRef: `component://${paletteItem.type}`,
      htmlId: `cmp-${instanceId}`,
      props: { __sectionId: 'main', __sectionName: 'Main Section', ...JSON.parse(JSON.stringify(paletteItem.defaultProps)) },
    };
    const updated = [...nodes, newNode];
    updateNodesWithHistory(updated, `Add ${paletteItem.label}`);
    setSelectedNodeId(newNode.id);
  };

  // Update properties of selected component
  const handleUpdateNodeProps = (nodeId: string, updatedProps: Record<string, any>) => {
    const updated = nodes.map((n) => (n.id === nodeId ? { ...n, props: updatedProps } : n));
    updateNodesWithHistory(updated, `Update Props (${nodeId})`);
  };

  // Delete component
  const handleDeleteNode = (nodeId: string) => {
    const updated = nodes.filter((n) => n.id !== nodeId);
    updateNodesWithHistory(updated, `Delete (${nodeId})`);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  // Duplicate component
  const handleDuplicateNode = (nodeId: string) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return;
    const duplicatedId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const duplicated: ComponentNode = {
      ...JSON.parse(JSON.stringify(target)),
      id: duplicatedId,
      htmlId: target.htmlId ? `${target.htmlId}-copy-${duplicatedId.slice(-4)}` : `cmp-${duplicatedId}`,
    };
    const updated = [...nodes, duplicated];
    updateNodesWithHistory(updated, `Duplicate (${nodeId})`);
    setSelectedNodeId(duplicated.id);
  };

  // Move component up/down
  const handleMoveNode = (nodeId: string, direction: 'up' | 'down') => {
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= nodes.length) return;

    const newNodes = [...nodes];
    const temp = newNodes[idx];
    newNodes[idx] = newNodes[targetIdx];
    newNodes[targetIdx] = temp;
    updateNodesWithHistory(newNodes, `Move ${direction} (${nodeId})`);
  };

  // Save the selected Platform layout to the Core PostgreSQL database.
  const handleSaveToDatabase = async () => {
    if (!platformId) {
      setSaveStatus('ไม่พบ Platform ที่เลือก');
      return;
    }
    setSaveStatus('Saving...');
    setStudioError(null);
    try {
      const nextPages = studioPages.map((page) => !activeFormId && !activeCollectionView && page.id === activePage
        ? { ...page, componentTree: nodes, templateType: page.templateType || 'custom' }
        : page);
      const nextForms = studioForms.map((form) => form.id === activeFormId ? { ...form, componentTree: nodes, version: form.version + 1 } : form);
      const nextCollections = studioCollections.map((collection) => collection.id === activeCollectionView?.collectionId ? { ...collection, components: collection.components.map((view) => view.id === activeCollectionView.viewId ? { ...view, componentTree: nodes } : view) } : collection);
      const response = await fetch(`/api/platforms/${platformId}/studio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioLayout: nodes, studioPages: nextPages, studioForms: nextForms, studioCollections: nextCollections }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      setStudioPages(nextPages);
      setStudioForms(nextForms);
      setStudioCollections(nextCollections);
      setSaveStatus('Saved to database');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ';
      setStudioError(message);
      setSaveStatus('Save failed');
    }

    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Download JSON AST
  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(nodes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${appInfo.appSlug}_${activePage}_layout.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Save Master App WorkFlow Manifest
  const handleSaveManifest = (manifest: AppWorkFlowManifest) => {
    setSaveStatus('App WorkFlow Manifest Saved!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Viewport width styling
  const getCanvasViewportWidth = () => {
    if (viewportMode === 'tablet') return '768px';
    if (viewportMode === 'mobile') return '375px';
    return '100%';
  };

  return (
    <div className="d-flex flex-column min-vh-100 bg-light select-none position-relative">
      {studioError && <div className="alert alert-danger rounded-0 py-2 mb-0 small">{studioError}</div>}
      {isLoadingPlatform && <div className="alert alert-info rounded-0 py-2 mb-0 small">Loading platform from database...</div>}
      {/* 1. Visual Studio Top Menu Bar */}
      <StudioMenuBar
        appInfo={appInfo}
        onSave={handleSaveToDatabase}
        onDownloadJson={handleDownloadJson}
        isPreviewMode={isPreviewMode}
        setIsPreviewMode={setIsPreviewMode}
        saveStatus={saveStatus}
      >
        <StudioToolBar
          compactTop
          appInfo={appInfo}
          onSave={handleSaveToDatabase}
          onDownloadJson={handleDownloadJson}
          isPreviewMode={isPreviewMode}
          setIsPreviewMode={setIsPreviewMode}
          viewportMode={viewportMode}
          setViewportMode={setViewportMode}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyRef.current?.canUndo() || false}
          canRedo={historyRef.current?.canRedo() || false}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          activePageSlug={activePage}
          onOpenPageManager={() => setIsPageManagerOpen(true)}
          platformId={platformId}
          activeSurface={activeSurface}
          setActiveSurface={(surface) => { setActiveSurface(surface); setSelectedRawTable(null); setSelectedPageFlow(null); }}
        />
      </StudioMenuBar>

      {/* 3. Main Studio Workspace Layout */}
      <div className="flex-grow-1 p-2 bg-light">
        <div className="d-flex gap-2 h-100 flex-nowrap align-items-stretch">
          {/* Left Column: DevStudio Treeview Outline Panel (Hidden in Preview Mode) */}
          {!isPreviewMode && (
            <div className="flex-shrink-0" style={{ width: isExplorerCollapsed ? 52 : 360, minWidth: isExplorerCollapsed ? 52 : 280, transition: 'width .2s ease' }}>
              <StudioTreeviewOutline
                appInfo={appInfo}
                platformId={platformId}
                activePage={activePage}
                setActivePage={handleSelectDesignPage}
                onAddComponent={handleAddComponent}
                pages={studioPages}
                routes={studioRoutes}
                forms={studioForms}
                activeFormId={activeFormId}
                onSelectForm={handleSelectDesignForm}
                onAddCollectionForm={(collectionId) => void handleAddCollectionForm(collectionId)}
                collections={studioCollections}
                activeCollectionViewId={activeCollectionView?.viewId || null}
                onSelectCollectionView={handleSelectCollectionView}
                onAddCollectionComponent={(collectionId, componentType) => void handleAddCollectionComponent(collectionId, componentType)}
                onGenerateAppComponentFromImage={() => setShowAppComponentImageWizard(true)}
                onSelectPageComponent={(pageId, nodeId) => void openComponentWorkshop(pageId, nodeId)}
                onOpenPageSettings={(pageId) => void openPageSettings(pageId)}
                onSelectPageFlow={(route) => setSelectedPageFlow(route)}
                onSelectRawTable={(tableName) => { setSelectedPageFlow(null); setSelectedRawTable(tableName); }}
                onOpenPageManager={(containerName) => { setPageManagerContainer(containerName || null); setIsPageManagerOpen(true); }}
                collapsed={isExplorerCollapsed}
                onToggleCollapsed={() => setIsExplorerCollapsed((current) => !current)}
              />
            </div>
          )}

          {/* Center Stage: App WorkFlow Designer OR Form Designer Canvas */}
          <div className="flex-grow-1 min-w-0" style={{ minWidth: 0 }}>
            {pageSettingsId && studioPages.find((page) => page.id === pageSettingsId) ? (
              <PageSettingsWorkspace
                key={pageSettingsId}
                page={studioPages.find((page) => page.id === pageSettingsId)!}
                collections={studioCollections}
                onBack={() => setPageSettingsId(null)}
                onAddSection={handleAddPageSection}
                onSave={(settings) => void handleSavePageSettings(settings)}
                onGenerateFromImage={handleGeneratePageFromImage}
              />
            ) : workshopNodeId && nodes.find((node) => node.id === workshopNodeId) ? (
              <ComponentWorkshop
                key={workshopNodeId}
                pageName={activeStudioPage?.name || activePage}
                component={nodes.find((node) => node.id === workshopNodeId)!}
                collections={studioCollections}
                pages={studioPages}
                onBack={() => { setWorkshopNodeId(null); setSelectedNodeId(null); }}
                onSave={handleSaveWorkshopComponent}
              />
            ) : selectedRawTable && platformId ? (
              <RawTableWorkspace platformId={platformId} databaseName={appInfo.tenantDbName} tableName={selectedRawTable} onClose={() => setSelectedRawTable(null)} />
            ) : selectedPageFlow && platformId ? (
              <PageFlowDesigner
                key={selectedPageFlow.path}
                platformId={platformId}
                routePath={selectedPageFlow.path}
                routeLabel={selectedPageFlow.label}
                suggestedType={selectedPageFlow.type}
                pages={studioPages}
              />
            ) : activePage === 'app_workflow' ? (
              <AppWorkflowDesigner appInfo={appInfo} onSaveManifest={handleSaveManifest} />
            ) : (
              <div className="card shadow-sm border-0 rounded-3 bg-white d-flex flex-column h-100 overflow-hidden">
                {/* Form Designer Tabbed Header */}
                <div className="card-header bg-light border-bottom p-0 px-2 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-1 overflow-auto">
                    <div className="bg-white text-primary border-top border-primary border-2 px-3 py-1.5 extra-small fw-bold d-flex align-items-center gap-1.5 shadow-xs">
                      <FileText size={13} className="text-primary" />
                      <span>{activeCollectionView ? `${studioCollections.find((item) => item.id === activeCollectionView.collectionId)?.name || 'Collection'} (${activeCollectionView.viewId}) [${activeCollectionView.variant}]` : activeFormId ? `${studioForms.find((form) => form.id === activeFormId)?.name || 'Form'} (${activeFormId}) [${activeFormMode}]` : `${studioPages.find((page) => page.id === activePage)?.title || 'Page'} (${activePage}.page) [Design]`}</span>
                    </div>
                    {!activeFormId && !activeCollectionView && <button
                      type="button"
                      className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1.5 ms-2 text-nowrap"
                      onClick={() => {
                        const page = studioPages.find((item) => item.id === activePage);
                        if (page) setPageTemplateTarget(page);
                      }}
                      title="Replace this page design with a new template"
                    >
                      <RefreshCw size={13} />
                      <span>Recreate from Template</span>
                    </button>}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <ThemeCustomizerPanel
                      themeConfig={appInfo.themeConfig}
                      onChangeTheme={(newTheme) => setAppInfo({ ...appInfo, themeConfig: newTheme })}
                    />
                  </div>
                </div>

                {/* A selected Page owns the Page Detail surface and is edited by HTML Studio IDE. */}
                {activeCollectionView && activeCollectionComponent && collectionStudioDocument && !isPreviewMode ? (
                  <div className="card-body p-0 overflow-hidden bg-dark" style={{ minHeight: 'calc(100vh - 300px)', maxHeight: 'calc(100vh - 220px)' }}>
                    <HtmlStudioShell key={`${activeCollectionComponent.id}:${activeCollectionView.variant}`} embedded document={collectionStudioDocument} onSave={(document) => void handleSaveCollectionStudioDocument(document)} onDirtyChange={setIsPageDirty}/>
                  </div>
                ) : activeStudioForm && formStudioDocument && !isPreviewMode ? (
                  <div className="card-body p-0 overflow-hidden bg-dark" style={{ minHeight: 'calc(100vh - 300px)', maxHeight: 'calc(100vh - 220px)' }}>
                    <HtmlStudioShell key={`${activeStudioForm.id}:${activeFormMode}`} embedded document={formStudioDocument} onSave={(document) => void handleSaveFormStudioDocument(document)} onDirtyChange={setIsPageDirty}/>
                  </div>
                ) : activeStudioPage && pageStudioDocument && !isPreviewMode ? (
                  <div className="card-body p-0 overflow-hidden bg-dark" style={{ minHeight: 'calc(100vh - 340px)', maxHeight: 'calc(100vh - 260px)' }}>
                    {isLoadingPage ? <div className="h-100 d-flex align-items-center justify-content-center text-white"><div className="spinner-border spinner-border-sm me-2"/>Loading Page from database...</div> : <HtmlStudioShell key={`${activePage}:${pageStudioDocument.id}`} embedded document={pageStudioDocument} onSave={(document) => void handleSavePageStudioDocument(document)} onDirtyChange={setIsPageDirty} />}
                  </div>
                ) : <div
                  className="card-body p-3 overflow-auto bg-light d-flex justify-content-center position-relative"
                  style={{
                    minHeight: 'calc(100vh - 340px)',
                    maxHeight: 'calc(100vh - 340px)',
                    backgroundImage: showGrid
                      ? 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)'
                      : 'none',
                    backgroundSize: '16px 16px',
                  }}
                >
                  <div
                    className="w-100 transition-all bg-white rounded-3 shadow-sm p-3 border"
                    style={{
                      maxWidth: getCanvasViewportWidth(),
                      transform: `scale(${zoomLevel / 100})`,
                      transformOrigin: 'top center',
                      transition: 'transform 0.2s ease, max-width 0.25s ease',
                      minHeight: '100%',
                    }}
                  >
                    <DynamicPageRenderer
                      nodes={nodes}
                      themeConfig={appInfo.themeConfig}
                      isDesignMode={!isPreviewMode}
                      selectedNodeId={selectedNodeId}
                      onSelectNode={(id) => setSelectedNodeId(id)}
                    />
                  </div>
                </div>}
              </div>
            )}
          </div>
        </div>
      </div>
      {showAppComponentImageWizard && <GenAppComponentFromImageWizard onClose={() => setShowAppComponentImageWizard(false)} onGenerate={handleGenerateAppComponentFromImage}/>}

      {/* 4. Component Property Modal Popup (Appears when a component on canvas is selected) */}
      {!isPreviewMode && selectedNode && !workshopNodeId && activePage !== 'app_workflow' && (
        <ComponentPropertyModal
          selectedNode={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onUpdateNodeProps={handleUpdateNodeProps}
          onDeleteNode={handleDeleteNode}
          onMoveNode={handleMoveNode}
          onDuplicateNode={handleDuplicateNode}
        />
      )}

      {/* 5. Page Layout Manager Modal */}
      <PageManagerModal
        isOpen={isPageManagerOpen}
        onClose={() => setIsPageManagerOpen(false)}
        activePageSlug={activePage}
        pages={studioPages}
        containers={Array.from(new Set([`${appInfo.appSlug}-frontend`, `${appInfo.appSlug}-backend`, ...studioPages.map((page) => page.containerName).filter((name): name is string => Boolean(name))]))}
        initialContainerName={pageManagerContainer || `${appInfo.appSlug}-${activeSurface}`}
        onSelectPage={handleSelectDesignPage}
        onCreatePage={handleCreateManagedPage}
        onClonePage={handleCloneManagedPage}
        onMovePage={handleMoveManagedPage}
        onDeletePage={handleDeleteManagedPage}
        onSetDefaultPage={handleSetDefaultManagedPage}
      />

      {/* 6. Visual Studio Bottom Output & Diagnostic Dock */}
      <BottomDock appInfo={appInfo} nodes={nodes} />

      {pageTemplateTarget && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2050, background: 'rgba(15,23,42,.64)', backdropFilter: 'blur(4px)' }}>
          <div className="card border-0 shadow-lg rounded-4" style={{ width: 'min(94vw, 820px)' }}><div className="card-body p-4">
            <div className="mb-3"><div className="text-primary fw-bold small">PAGE LAYOUT TEMPLATE</div><h4 className="fw-bold mb-1">{pageTemplateTarget.componentTree?.length ? 'Recreate' : 'Create'} {pageTemplateTarget.title} Design</h4><p className="text-secondary mb-0">{pageTemplateTarget.componentTree?.length ? 'เลือก Template ใหม่เพื่อแทนที่ Design ของหน้าปัจจุบัน' : 'หน้านี้ยังไม่มี Component Layout ในฐานข้อมูล กรุณาเลือกโครงสร้างเริ่มต้น'}</p></div>
            {pageTemplateTarget.componentTree?.length ? <div className="alert alert-warning py-2 small"><strong>Current template:</strong> <code>{pageTemplateTarget.templateType || 'custom'}</code><br />Layout ปัจจุบันจะถูกสำรองไว้ในประวัติ ก่อนแทนที่ด้วย Template ใหม่</div> : null}
            <div className="row g-3">
              {[
                { id: 'admin_backend', title: 'Admin Backend', desc: 'Complete backend sidebar with routes, RBAC and Form/DataTable/Collection metadata', icon: '▤' },
                { id: 'municipal_home', title: 'Municipal Portal Home', desc: 'แม่แบบเว็บไซต์ อบต. จากโครงสร้าง YII เดิม: ข่าว บริการ ITA e-GP เอกสาร และข้อมูลชุมชน', icon: '🏛' },
                { id: 'top_nav_content', title: 'Top Navigation + Content', desc: 'เมนูแนวนอนด้านบน ตามด้วยพื้นที่เนื้อหา เหมาะกับเว็บไซต์ทั่วไป', icon: '▰' },
                { id: 'sidebar_content', title: 'Sidebar + Content', desc: 'เมนูด้านซ้ายและพื้นที่เนื้อหาหลัก เหมาะกับระบบหลังบ้าน', icon: '◧' },
                { id: 'dashboard', title: 'Dashboard Starter', desc: 'เมนูด้านบน การ์ดสรุป และพื้นที่เนื้อหา', icon: '▦' },
                { id: 'blank_content', title: 'Blank Content', desc: 'พื้นที่ว่างพร้อมหัวข้อ สำหรับออกแบบเองทั้งหมด', icon: '□' },
              ].map((template) => <div className="col-md-6" key={template.id}><button className="card w-100 h-100 text-start p-3 bg-white border hover-border-primary" onClick={() => void handleCreatePageLayout(template.id)} disabled={isCreatingPageLayout}>
                <div className="d-flex gap-3"><div className="text-primary fs-2 lh-1">{template.icon}</div><div><h6 className="fw-bold mb-1">{template.title}</h6><div className="small text-secondary">{template.desc}</div></div></div>
              </button></div>)}
            </div>
            {studioError && <div className="alert alert-danger py-2 small mt-3 mb-0">{studioError}</div>}
            <div className="d-flex justify-content-between align-items-center mt-4"><div className="small text-muted">Template ใหม่สามารถเพิ่มได้ในอนาคต</div><a href="/admin/platforms" className="btn btn-light">Back to Platforms</a></div>
          </div></div>
        </div>
      )}

      {showInitializeModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2000, background: 'rgba(15, 23, 42, 0.62)', backdropFilter: 'blur(4px)' }}>
          <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ width: 'min(92vw, 540px)' }}>
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="rounded-3 bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                  <Database size={24} />
                </div>
                <div>
                  <h5 className="fw-bold mb-1">Initialize Platform Studio</h5>
                  <div className="text-secondary small">Platform นี้ยังไม่มีข้อมูล Studio ในฐานข้อมูล</div>
                </div>
              </div>
              <p className="text-secondary small">ระบบกำลังจะสร้าง Default Pages Layouts จำนวน 3 หน้า ลง PostgreSQL:</p>
              <div className="list-group mb-4">
                {DEFAULT_STUDIO_PAGES.map((page, index) => (
                  <div key={page.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <span className="fw-medium">{index + 1}. {page.title}</span>
                    <code>{page.id}.page</code>
                  </div>
                ))}
              </div>
              {studioError && <div className="alert alert-danger py-2 small">{studioError}</div>}
              <div className="d-flex justify-content-end gap-2">
                <a href="/admin/platforms" className="btn btn-light">Back to Platforms</a>
                <button className="btn btn-primary" onClick={() => void handleInitializeStudio()} disabled={isInitializing}>
                  {isInitializing ? 'Creating...' : 'Create Default Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
