import React from 'react';
import { ComponentType } from '@/types';
import {
  FieldInputComponent,
  FormComponent,
  TableDataComponent,
  ListComponent,
  PostListComponent,
  GalleryComponent,
  FileManagerComponent,
  FileManagerPopupComponent,
  DynamicHtmlComponent,
  HtmlEditorComponent,
  HtmlTemplateComponent,
  NavMenuComponent,
  SlideMenuComponent,
  EditMenuComponent,
  CardComponent,
  ChartComponent,
  SiteTopbarComponent,
  SiteHeaderComponent,
  SiteSidebarMenuComponent,
  SiteFooterComponent,
  HeroCarouselComponent,
  ServiceLinksComponent,
  StatCounterComponent,
  PeopleGridComponent,
  FloatingDockComponent,
  SiteTickerComponent,
  SiteSearchComponent,
  ExecutiveCardComponent,
  NoticeListComponent,
  PartnerStripComponent,
  MediaFeatureComponent,
  CookieConsentComponent,
  PagerComponent,
  LanguageSwitchComponent,
  FloatingNoticeComponent,
  EventCalendarComponent,
  VisitCounterComponent,
  TabbedSectionComponent,
} from '@/components/shared';

// Registry mapping string ComponentType to React Component Implementation
export const COMPONENT_REGISTRY: Record<ComponentType, React.FC<any>> = {
  FieldInputComponent,
  FormComponent,
  TableDataComponent,
  DataTableComponent: TableDataComponent,
  ListComponent,
  PostListComponent,
  GalleryComponent,
  FileManagerComponent,
  FileManagerPopupComponent,
  DynamicHtmlComponent,
  HtmlEditorComponent,
  HtmlTemplateComponent,
  NavMenuComponent,
  SlideMenuComponent,
  EditMenuComponent,
  CardComponent,
  ChartComponent,
  TabsContainerComponent: CardComponent, // Fallback container
  AccordionComponent: CardComponent, // Fallback container
  ModalDialogComponent: CardComponent, // Fallback container
  SiteTopbarComponent,
  SiteHeaderComponent,
  SiteSidebarMenuComponent,
  SiteFooterComponent,
  HeroCarouselComponent,
  ServiceLinksComponent,
  StatCounterComponent,
  PeopleGridComponent,
  FloatingDockComponent,
  SiteTickerComponent,
  SiteSearchComponent,
  ExecutiveCardComponent,
  NoticeListComponent,
  PartnerStripComponent,
  MediaFeatureComponent,
  CookieConsentComponent,
  PagerComponent,
  LanguageSwitchComponent,
  FloatingNoticeComponent,
  EventCalendarComponent,
  VisitCounterComponent,
  TabbedSectionComponent,
};

// Metadata for available components in DesignMode Studio Palette
export interface ComponentPaletteItem {
  type: ComponentType;
  label: string;
  category: 'Layout' | 'Form Controls' | 'Data Display' | 'Media & Files' | 'Navigation';
  description: string;
  defaultProps: Record<string, any>;
}

export const COMPONENT_PALETTE: ComponentPaletteItem[] = [
  {
    type: 'NavMenuComponent',
    label: 'Top Nav Menu',
    category: 'Navigation',
    description: 'Header navigation bar with brand logo and menu links.',
    defaultProps: {
      brandName: 'My Web Application',
      items: [
        { label: 'Home', href: '#', active: true },
        { label: 'Services', href: '#' },
        { label: 'Contact', href: '#' },
      ],
    },
  },
  {
    type: 'SlideMenuComponent',
    label: 'Sidebar Menu',
    category: 'Navigation',
    description: 'Collapsible side navigation menu.',
    defaultProps: {
      title: 'App Navigation',
      dataSourceMode: 'fixed-json',
      items: [
        { id: 'm1', label: 'Dashboard', active: true },
        { id: 'm2', label: 'Reports', badge: '5' },
        { id: 'm3', label: 'Settings' },
      ],
    },
  },
  {
    type: 'EditMenuComponent',
    label: 'Menu Tree Editor',
    category: 'Navigation',
    description: 'Shared menu manager and menu-reference field with hierarchy, ordering, position and status controls.',
    defaultProps: {
      title: 'จัดการเมนู', mode: 'manager', maxDepth: 3, allowedPositions: ['top', 'side'], valueField: 'id',
      items: [
        { id: 1, parentId: null, label: 'หน้าหลัก', url: '/site/index', icon: 'fa-solid fa-house', position: 'top', sortOrder: 1, status: 1 },
        { id: 2, parentId: null, label: 'ข้อมูลพื้นฐาน', url: '#', position: 'top', sortOrder: 2, status: 1 },
        { id: 3, parentId: 2, label: 'เกี่ยวกับเรา', url: '/page/view?id=1', position: 'top', sortOrder: 1, status: 1 },
      ],
    },
  },
  {
    type: 'CardComponent',
    label: 'Metric Summary Card',
    category: 'Data Display',
    description: 'Stat card for KPIs, active metrics, and growth badges.',
    defaultProps: {
      title: 'Total Active Revenue',
      subtitle: 'Tenant Child App B',
      value: '$48,250',
      badge: '+18.4%',
      variant: 'primary',
      footerText: 'Realtime updated',
    },
  },
  {
    type: 'ChartComponent',
    label: 'Performance Bar Chart',
    category: 'Data Display',
    description: 'Dynamic bar chart for monthly or weekly performance metrics.',
    defaultProps: {
      title: 'Monthly Performance Trends',
      chartType: 'bar',
      dataPoints: [45, 75, 60, 95, 80, 110],
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      colorPreset: 'indigo',
    },
  },
  {
    type: 'FormComponent',
    label: 'Dynamic Form',
    category: 'Form Controls',
    description: 'Grouped form container with inputs and submit action.',
    defaultProps: {
      title: 'Contact Form',
      description: 'Please fill out your information below.',
      submitText: 'Submit Request',
      fields: [
        { name: 'fullname', label: 'Full Name', placeholder: 'Enter your name...', required: true },
        { name: 'email', label: 'Email Address', type: 'email', placeholder: 'name@example.com' },
        { name: 'message', label: 'Message', type: 'textarea', placeholder: 'Enter message...' },
      ],
    },
  },
  {
    type: 'FieldInputComponent',
    label: 'Single Input Field',
    category: 'Form Controls',
    description: 'Text, Select, Checkbox or Date input field.',
    defaultProps: {
      name: 'input_field',
      label: 'Sample Label',
      placeholder: 'Enter value...',
      type: 'text',
    },
  },
  {
    type: 'TableDataComponent',
    label: 'Data Table',
    category: 'Data Display',
    description: 'Interactive data grid table with search, sorting, and pagination.',
    defaultProps: {
      title: 'Users Directory',
      columns: [
        { key: 'id', label: 'ID', sortable: true },
        { key: 'name', label: 'Name', sortable: true },
        { key: 'role', label: 'Role' },
      ],
      data: [
        { id: '1', name: 'John Doe', role: 'Admin' },
        { id: '2', name: 'Jane Smith', role: 'Editor' },
      ],
    },
  },
  {
    type: 'ListComponent', label: 'Collection List', category: 'Data Display', description: 'Reusable list view bound to a project Collection.',
    defaultProps: { title: 'Collection List', collectionId: '', primaryField: 'name', secondaryField: 'description', items: [] },
  },
  {
    type: 'GalleryComponent',
    label: 'Media Gallery',
    category: 'Media & Files',
    description: 'Image grid with lightbox preview modal.',
    defaultProps: {
      title: 'Featured Products',
      columns: 3,
      items: [
        { id: 'i1', title: 'Analytics App', imageUrl: 'https://picsum.photos/400/250?random=10' },
        { id: 'i2', title: 'Mobile App', imageUrl: 'https://picsum.photos/400/250?random=11' },
      ],
    },
  },
  {
    type: 'FileManagerComponent',
    label: 'File Manager',
    category: 'Media & Files',
    description: 'File upload zone and uploaded file table.',
    defaultProps: {
      title: 'Document Attachments',
      maxSizeMb: 10,
    },
  },
  {
    type: 'FileManagerPopupComponent',
    label: 'File Manager Popup',
    category: 'Media & Files',
    description: 'Reusable file picker popup with directory tree, gallery, lazy loading and single/multiple selection.',
    defaultProps: {
      open: false,
      title: 'คลังสื่อและไฟล์',
      rootPath: '/uploads',
      currentPath: '/uploads',
      selectionMode: 'single',
      pageSize: 40,
      allowUpload: true,
      allowDirectoryMutation: true,
      allowDelete: true,
    },
  },
  {
    type: 'DynamicHtmlComponent',
    label: 'HTML Content',
    category: 'Data Display',
    description: 'Renders custom raw or sanitized HTML markup.',
    defaultProps: {
      content: '<div class="alert alert-info">Hello World! Custom HTML Block</div>',
    },
  },
  {
    type: 'HtmlEditorComponent',
    label: 'HTML Editor',
    category: 'Data Display',
    description: 'Rich text code editor with live HTML preview.',
    defaultProps: {
      initialHtml: '<h3>Dynamic Rich Text</h3><p>Edit rich HTML here...</p>',
    },
  },
  {
    type: 'HtmlTemplateComponent',
    label: 'HTML Studio Template',
    category: 'Data Display',
    description: 'Production-safe HTML Studio document with scoped CSS and stable references.',
    defaultProps: {
      document: {
        id: 'template_starter', scope: 'app', kind: 'section', name: 'Starter Section', version: 1, schemaVersion: 1,
        root: [{ id: 'section_root', kind: 'element', tag: 'section', classList: ['p-4'], children: [{ id: 'heading', kind: 'element', tag: 'h2', children: [{ id: 'heading_text', kind: 'text', text: 'HTML Studio Template' }] }, { id: 'body', kind: 'element', tag: 'p', children: [{ id: 'body_text', kind: 'text', text: 'Edit this document in HTML Studio.' }] }] }],
        styleSheet: { scopeId: 'template-starter', rules: [] }, dependencies: [],
        settings: { cssScope: 'component', dataPolicy: 'mock-only', scriptPolicy: 'none' },
        createdAt: '2026-08-23T00:00:00.000Z', updatedAt: '2026-08-23T00:00:00.000Z',
      },
    },
  },
];
