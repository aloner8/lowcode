import { supabase } from '@/lib/supabase/client';
import { AppConfig, AppRoute, PageLayout, WorkflowTree, ComponentNode, StudioServiceDefinition } from '@/types';

export interface AppRuntimeData {
  appConfig: AppConfig;
  pageLayout: PageLayout;
  workflowTree?: WorkflowTree;
  forms?: Array<{ id: string; componentTree: ComponentNode[] }>;
  collections?: Array<{ id: string; name?: string; standardFlows?: Record<string, any>; components: Array<{ id: string; type: string; componentTree: ComponentNode[] }> }>;
  routes?: AppRoute[];
  pages?: Array<{ id: string; title?: string; componentTree: ComponentNode[] }>;
  services?: StudioServiceDefinition[];
  flows?: Array<{ routePath: string; nodes: Array<{ id: string; data?: Record<string, any> }>; edges: Array<Record<string, any>> }>;
}

export async function fetchAppRuntimeData(appSlug: string): Promise<AppRuntimeData> {
  try {
    const platformResponse = await fetch(`/api/runtime/${encodeURIComponent(appSlug)}`, { cache: 'no-store' });
    if (platformResponse.ok) return await platformResponse.json() as AppRuntimeData;

    // 1. Fetch App Metadata
    const { data: appData, error: appError } = await supabase
      .from('apps')
      .select('*')
      .eq('app_slug', appSlug)
      .single();

    if (appError || !appData) {
      return getFallbackRuntimeData(appSlug);
    }

    const appConfig: AppConfig = {
      id: appData.id,
      appSlug: appData.app_slug,
      appName: appData.app_name,
      description: appData.description,
      port: appData.port,
      subdomain: appData.subdomain,
      tenantDbName: appData.tenant_db_name,
      themeConfig: appData.theme_config,
      createdAt: appData.created_at,
      updatedAt: appData.updated_at,
    };

    // 2. Fetch Page Layout
    const { data: pageData } = await supabase
      .from('page_layouts')
      .select('*')
      .eq('app_id', appConfig.id)
      .eq('is_default_page', true)
      .single();

    const pageLayout: PageLayout = pageData
      ? {
          id: pageData.id,
          appId: pageData.app_id,
          pageSlug: pageData.page_slug,
          title: pageData.title,
          isDefaultPage: pageData.is_default_page,
          componentTree: pageData.component_tree,
          createdAt: pageData.created_at,
          updatedAt: pageData.updated_at,
        }
      : getFallbackPageLayout(appConfig.id);

    // 3. Fetch Workflow Tree
    const { data: flowData } = await supabase
      .from('workflow_trees')
      .select('*')
      .eq('app_id', appConfig.id)
      .limit(1)
      .single();

    const workflowTree: WorkflowTree | undefined = flowData
      ? {
          id: flowData.id,
          appId: flowData.app_id,
          flowName: flowData.flow_name,
          nodes: flowData.nodes,
          edges: flowData.edges,
          createdAt: flowData.created_at,
          updatedAt: flowData.updated_at,
        }
      : undefined;

    return { appConfig, pageLayout, workflowTree };
  } catch (err) {
    console.warn(`[AppRuntimeFetcher] Using fallback runtime data for app '${appSlug}'`);
    return getFallbackRuntimeData(appSlug);
  }
}

function getFallbackRuntimeData(appSlug: string): AppRuntimeData {
  const appId = `app_${appSlug}`;
  const appConfig: AppConfig = {
    id: appId,
    appSlug: appSlug,
    appName: `${appSlug.toUpperCase()} Runtime App`,
    description: 'Thin Dynamic Player Child Application',
    port: 3001,
    subdomain: `${appSlug}.localhost`,
    tenantDbName: `app_db_${appSlug}`,
    themeConfig: {
      preset: 'corporate-emerald',
      mode: 'light',
      primaryColor: '#10b981',
      borderRadius: '0.5rem',
      fontFamily: 'Inter, sans-serif',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    appConfig,
    pageLayout: getFallbackPageLayout(appId),
  };
}

function getFallbackPageLayout(appId: string): PageLayout {
  const sampleNodes: ComponentNode[] = [
    {
      id: 'n_header',
      type: 'NavMenuComponent',
      props: {
        brandName: 'Child App Dynamic Runtime Player',
        items: [
          { label: 'Overview', href: '#', active: true },
          { label: 'My Submissions', href: '#' },
        ],
      },
    },
    {
      id: 'n_hero',
      type: 'DynamicHtmlComponent',
      props: {
        content: `
          <div class="alert alert-success border-0 shadow-sm p-4">
            <h4 class="fw-bold mb-1">✅ App ลูก Dynamic Player (Runtime Execution)</h4>
            <p class="mb-0 text-muted">
              App ลูกตัวนี้ดึง Layout JSON, Theme Variables และ Workflow Logic จาก DB ของ App แม่มาแสดงผลสดๆ 
              ผ่าน Port Binding และสลับการเชื่อมต่อ DB ไปยัง Tenant DB ประจำตัวเรียบร้อยแล้ว
            </p>
          </div>
        `,
      },
    },
    {
      id: 'n_form',
      type: 'FormComponent',
      actionTriggerId: 't1',
      props: {
        title: 'Customer Feedback Submission',
        description: 'Submit your message directly to the isolated Tenant Database',
        submitText: 'Send Message',
        fields: [
          { name: 'senderName', label: 'Your Name', placeholder: 'Enter name...', required: true },
          { name: 'messageText', label: 'Feedback Message', type: 'textarea', placeholder: 'Enter message...' },
        ],
      },
    },
    {
      id: 'n_table',
      type: 'TableDataComponent',
      props: {
        title: 'Recent Database Records (Tenant DB)',
        columns: [
          { key: 'id', label: 'Ticket ID', sortable: true },
          { key: 'sender', label: 'Sender', sortable: true },
          { key: 'created', label: 'Created At' },
        ],
        data: [
          { id: 'TKT-101', sender: 'Siam Tech Admin', created: '2026-08-08' },
          { id: 'TKT-102', sender: 'Logistics Manager', created: '2026-08-08' },
        ],
      },
    },
  ];

  return {
    id: `layout_${appId}`,
    appId: appId,
    pageSlug: 'index',
    title: 'Home Page',
    isDefaultPage: true,
    componentTree: sampleNodes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
