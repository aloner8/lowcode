'use client';
import React from 'react';
import type { ComponentNode, ThemeConfig } from '@/types';
import { DynamicPageRenderer } from './DynamicPageRenderer';
interface Props { mode: 'content' | 'page'; content: ComponentNode[]; shellNodes: ComponentNode[]; label: string; themeConfig?: ThemeConfig; onActionTrigger: (actionId: string, payload?: any) => void; }
export const RuntimeContentOutlet: React.FC<Props> = ({ mode, content, shellNodes, label, themeConfig, onActionTrigger }) => mode === 'page'
  ? <DynamicPageRenderer nodes={content} themeConfig={themeConfig} onActionTrigger={onActionTrigger}/>
  : <div className="municipal-admin-layout d-flex align-items-start gap-0"><div className="flex-shrink-0"><DynamicPageRenderer nodes={shellNodes} themeConfig={themeConfig} onActionTrigger={onActionTrigger}/></div><main className="municipal-admin-content flex-grow-1 min-w-0"><div className="municipal-admin-breadcrumb">หน้าหลัก <span>›</span> {label}</div><DynamicPageRenderer nodes={content} themeConfig={themeConfig} onActionTrigger={onActionTrigger}/></main></div>;
