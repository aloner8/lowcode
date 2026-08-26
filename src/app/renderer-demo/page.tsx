'use client';

import React, { useState } from 'react';
import { DynamicPageRenderer } from '@/components/engine/DynamicPageRenderer';
import { ComponentNode, ThemeConfig } from '@/types';
import { Code, Palette } from 'lucide-react';

export default function RendererDemoPage() {
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>({
    preset: 'corporate-emerald',
    mode: 'light',
    primaryColor: '#10b981',
    borderRadius: '0.5rem',
    fontFamily: 'Inter, sans-serif',
  });

  const [showJsonModal, setShowJsonModal] = useState(false);

  // Sample JSON Layout AST representing a full Page Layout stored in Database
  const samplePageAST: ComponentNode[] = [
    {
      id: 'nav_01',
      type: 'NavMenuComponent',
      props: {
        brandName: 'Siam Enterprise Portal',
        items: [
          { label: 'Dashboard', href: '#', active: true },
          { label: 'Customer Portal', href: '#' },
          { label: 'System Analytics', href: '#' },
        ],
      },
    },
    {
      id: 'html_hero',
      type: 'DynamicHtmlComponent',
      props: {
        content: `
          <div class="p-4 mb-4 bg-white rounded shadow-sm border">
            <h2 class="fw-bold text-dark mb-2">🚀 Pure JSON-Driven Dynamic Web Application</h2>
            <p class="text-muted mb-0">
              หน้าเว็บนี้ทั้งหน้าประกอบขึ้นจาก <strong>JSON Component Tree</strong> ในฐานข้อมูลแบบ 100% 
              โดยไม่ได้ฮาร์ดโค้ด JSX ของหน้าเว็บแม้แต่บรรทัดเดียว!
            </p>
          </div>
        `,
      },
    },
    {
      id: 'form_user_reg',
      type: 'FormComponent',
      actionTriggerId: 'act_on_form_submit',
      props: {
        title: 'Register New Enterprise Customer',
        description: 'Fill in client credentials to generate tenant account.',
        submitText: 'Create Client Account',
        fields: [
          { name: 'companyName', label: 'Company Name', placeholder: 'e.g. Siam Technology Ltd.', required: true },
          { name: 'contactEmail', label: 'Business Email', type: 'email', placeholder: 'admin@siamtech.com' },
          {
            name: 'planType',
            label: 'Subscription Plan',
            type: 'select',
            options: [
              { label: 'Basic Tenant ($29/mo)', value: 'basic' },
              { label: 'Enterprise Dedicated ($199/mo)', value: 'enterprise' },
            ],
          },
        ],
      },
    },
    {
      id: 'table_clients',
      type: 'TableDataComponent',
      actionTriggerId: 'act_on_table_row_click',
      props: {
        title: 'Active Registered Clients',
        columns: [
          { key: 'tenantDb', label: 'Database Name', sortable: true },
          { key: 'company', label: 'Company Name', sortable: true },
          { key: 'plan', label: 'Plan', sortable: true },
          { key: 'status', label: 'Status' },
        ],
        data: [
          { tenantDb: 'app_db_client_a', company: 'Siam Technology Ltd.', plan: 'Enterprise', status: 'Active' },
          { tenantDb: 'app_db_client_b', company: 'Bangkok Logistics Co.', plan: 'Basic', status: 'Active' },
          { tenantDb: 'app_db_client_c', company: 'Chiang Mai Foods', plan: 'Basic', status: 'Active' },
        ],
        actions: [{ label: 'View DB Log', variant: 'outline-secondary', onClick: () => {} }],
      },
    },
    {
      id: 'gallery_showcase',
      type: 'GalleryComponent',
      props: {
        title: 'Child App Templates',
        columns: 3,
        items: [
          { id: 't1', title: 'Hospital LIS Connector', category: 'Medical', imageUrl: 'https://picsum.photos/400/250?random=30' },
          { id: 't2', title: 'Smart Retail POS Engine', category: 'Retail', imageUrl: 'https://picsum.photos/400/250?random=31' },
          { id: 't3', title: 'Factory Logistics Workflow', category: 'Industry', imageUrl: 'https://picsum.photos/400/250?random=32' },
        ],
      },
    },
  ];

  const handleActionTrigger = (actionId: string, payload: any) => {
    alert(`[Action Trigger Executed]\nAction ID: ${actionId}\nPayload: ${JSON.stringify(payload, null, 2)}`);
  };

  return (
    <div className="min-vh-100 bg-light py-4">
      <div className="container">
        {/* Top Control Bar */}
        <div className="card shadow-sm border-0 p-3 mb-4 bg-white">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <span className="badge bg-success me-2">Phase 3 Ready</span>
              <h5 className="fw-bold d-inline align-middle">DynamicPageRenderer Engine Demo</h5>
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm btn-outline-dark d-flex align-items-center"
                onClick={() => setShowJsonModal(!showJsonModal)}
              >
                <Code size={16} className="me-1" /> View JSON AST Source
              </button>
              <button
                className={`btn btn-sm ${activeTheme.mode === 'dark' ? 'btn-dark' : 'btn-outline-primary'}`}
                onClick={() =>
                  setActiveTheme((prev) => ({
                    ...prev,
                    mode: prev.mode === 'light' ? 'dark' : 'light',
                  }))
                }
              >
                <Palette size={16} className="me-1" /> Toggle {activeTheme.mode === 'light' ? 'Dark' : 'Light'} Mode
              </button>
            </div>
          </div>
        </div>

        {/* JSON AST Source Modal View */}
        {showJsonModal && (
          <div className="card shadow-sm border-0 p-4 mb-4 bg-dark text-white font-monospace">
            <h6 className="text-info fw-bold mb-2">Dynamic Page Layout AST (PostgreSQL JSONB Representation):</h6>
            <pre className="mb-0 overflow-auto" style={{ maxHeight: '300px', fontSize: '13px' }}>
              {JSON.stringify(samplePageAST, null, 2)}
            </pre>
          </div>
        )}

        {/* Live Dynamic Page Render Engine */}
        <DynamicPageRenderer
          nodes={samplePageAST}
          themeConfig={activeTheme}
          onActionTrigger={handleActionTrigger}
        />
      </div>
    </div>
  );
}
