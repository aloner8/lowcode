'use client';

import React from 'react';
import { ComponentNode, ThemeConfig } from '@/types';
import { COMPONENT_REGISTRY } from '@/lib/engine/ComponentRegistry';
import { ThemeEngine } from '@/components/shared/ThemeEngine';

export interface DynamicPageRendererProps {
  nodes: ComponentNode[];
  themeConfig?: ThemeConfig;
  onActionTrigger?: (actionId: string, payload?: any) => void;
  isDesignMode?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
}

export const DynamicNodeItem: React.FC<{
  node: ComponentNode;
  onActionTrigger?: (actionId: string, payload?: any) => void;
  isDesignMode?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
}> = ({ node, onActionTrigger, isDesignMode, selectedNodeId, onSelectNode }) => {
  const TargetComponent = COMPONENT_REGISTRY[node.type];
  const configuredPreset = typeof node.props?.stylePreset === 'string' ? node.props.stylePreset : '';
  const legacyMunicipalPreset = node.id.startsWith('municipal_') && typeof node.props?.__sectionId === 'string'
    ? `municipal-${node.props.__sectionId}`
    : '';
  const candidatePreset = configuredPreset || legacyMunicipalPreset;
  const stylePreset = /^municipal-[a-z0-9-]+$/.test(candidatePreset) ? candidatePreset : '';

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
    onSubmit: (data: any) => {
      if (node.props?.onSubmit) node.props.onSubmit(data);
      if (node.actionTriggerId && onActionTrigger) {
        onActionTrigger(node.actionTriggerId, data);
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
      if (onActionTrigger) onActionTrigger(actionId, { row, componentId: node.id, collectionId: node.props?.collectionId, formId: node.props?.formId });
    },
    onSelect: (item: any) => {
      if (node.props?.onSelect) node.props.onSelect(item);
      if (onActionTrigger) onActionTrigger('menu.select', item);
    },
  };

  return (
    <div
      id={node.id}
      className={`dynamic-node-wrapper position-relative ${stylePreset ? `municipal-component ${stylePreset}` : ''} ${
        isDesignMode ? 'cursor-pointer hover-outline transition' : ''
      } ${isSelected ? 'border border-2 border-primary rounded p-1 shadow-sm' : ''}`}
      style={node.style || {}}
      onClick={handleClick}
    >
      {isDesignMode && (
        <div
          className={`badge position-absolute top-0 end-0 m-1 z-3 ${
            isSelected ? 'bg-primary text-white' : 'bg-dark text-white opacity-75'
          }`}
          style={{ fontSize: '10px' }}
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
    </div>
  );
};

export const DynamicPageRenderer: React.FC<DynamicPageRendererProps> = ({
  nodes = [],
  themeConfig,
  onActionTrigger,
  isDesignMode = false,
  selectedNodeId,
  onSelectNode,
}) => {
  const isMunicipalPage = nodes.some((node) =>
    (typeof node.props?.stylePreset === 'string' && node.props.stylePreset.startsWith('municipal-'))
    || node.id.startsWith('municipal_')
  );

  return (
    <ThemeEngine themeConfig={themeConfig}>
      <div className={`dynamic-page-root container-fluid py-3 ${isMunicipalPage ? 'municipal-page' : ''}`}>
        {nodes.length > 0 ? (
          <div className="d-flex flex-column gap-4">
            {nodes.map((node) => (
              <DynamicNodeItem
                key={node.id}
                node={node}
                onActionTrigger={onActionTrigger}
                isDesignMode={isDesignMode}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-5 border border-2 border-dashed rounded bg-white text-muted">
            {isDesignMode ? (
              <p className="mb-0">Canvas is empty. Drag & drop components from the palette to start building!</p>
            ) : (
              <p className="mb-0">No components configured for this page layout.</p>
            )}
          </div>
        )}
      </div>
    </ThemeEngine>
  );
};
