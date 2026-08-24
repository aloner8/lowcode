import { ComponentNode, TenantOverrides } from '@/types';

/**
 * Merges Master Platform Layout AST with Tenant App specific Overrides.
 * Cascades updates from Platform Master while respecting Tenant filters & prop overrides.
 */
export function mergePlatformMasterWithTenantOverrides(
  masterComponentTree: ComponentNode[],
  tenantOverrides?: TenantOverrides
): ComponentNode[] {
  if (!tenantOverrides) {
    return masterComponentTree;
  }

  const disabledFeatures = tenantOverrides.disabledFeatures || [];
  const propsOverrides = tenantOverrides.componentPropsOverrides || {};

  // Recursive merge helper
  function processNode(node: ComponentNode): ComponentNode | null {
    // Check if component ID or Type is disabled for this Tenant App
    if (disabledFeatures.includes(node.id) || disabledFeatures.includes(node.type)) {
      return null;
    }

    // Apply specific prop/style overrides if configured for this component ID
    const override = propsOverrides[node.id];
    let updatedNode: ComponentNode = { ...node };

    if (override) {
      updatedNode = {
        ...updatedNode,
        props: { ...updatedNode.props, ...(override.props || {}) },
        style: { ...updatedNode.style, ...(override.style || {}) },
      };
    }

    // Process children recursively if any
    if (node.children && node.children.length > 0) {
      const processedChildren = node.children
        .map((child) => processNode(child))
        .filter((child): child is ComponentNode => child !== null);

      updatedNode = {
        ...updatedNode,
        children: processedChildren,
      };
    }

    return updatedNode;
  }

  return masterComponentTree
    .map((node) => processNode(node))
    .filter((node): node is ComponentNode => node !== null);
}

