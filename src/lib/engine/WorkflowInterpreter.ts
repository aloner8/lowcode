import { WorkflowTree, WorkflowNode } from '@/types';

export interface ExecutionContext {
  payload?: any;
  appId?: string;
  appSlug?: string;
  results?: Record<string, unknown>;
  navigate?: (path: string) => void;
  showAlert?: (msg: string) => void;
}

export class WorkflowInterpreter {
  private flow: WorkflowTree;

  constructor(flow: WorkflowTree) {
    this.flow = flow;
  }

  // Execute workflow starting from a trigger node
  async executeTrigger(triggerId: string, ctx: ExecutionContext = {}): Promise<void> {
    const triggerNode = this.flow.nodes.find((n) => n.id === triggerId || n.data?.label === triggerId);
    if (!triggerNode) {
      console.warn(`[WorkflowInterpreter] Trigger node '${triggerId}' not found in flow.`);
      return;
    }

    console.log(`[WorkflowInterpreter] Executing Trigger: ${triggerNode.data.label}`, ctx.payload);
    await this.processNextNodes(triggerNode.id, ctx);
  }

  private async processNextNodes(currentNodeId: string, ctx: ExecutionContext): Promise<void> {
    // Find outgoing edges from currentNodeId
    const outgoingEdges = this.flow.edges.filter((e) => e.source === currentNodeId);

    for (const edge of outgoingEdges) {
      const nextNode = this.flow.nodes.find((n) => n.id === edge.target);
      if (!nextNode) continue;

      // Handle Condition Nodes
      if (nextNode.data.nodeType === 'condition') {
        const conditionPass = this.evaluateCondition(nextNode, ctx);
        console.log(`[WorkflowInterpreter] Condition '${nextNode.data.label}' evaluated to: ${conditionPass}`);

        // Match edges based on condition pass/fail
        const targetEdges = this.flow.edges.filter(
          (e) => e.source === nextNode.id && e.conditionValue === conditionPass
        );
        for (const targetEdge of targetEdges) {
          const actionNode = this.flow.nodes.find((n) => n.id === targetEdge.target);
          if (actionNode) {
            await this.executeActionNode(actionNode, ctx);
          }
        }
      } else {
        // Direct Action Node execution
        await this.executeActionNode(nextNode, ctx);
      }
    }
  }

  private async executeActionNode(node: WorkflowNode, ctx: ExecutionContext): Promise<void> {
    console.log(`[WorkflowInterpreter] Executing Action Node: ${node.data.label}`, node.data);

    const actionType = node.data.actionType;
    const config = node.data.config || {};

    switch (actionType) {
      case 'showAlert': {
        const msg = config.message || `Action Executed: ${node.data.label}`;
        if (ctx.showAlert) {
          ctx.showAlert(msg);
        } else {
          alert(`[Workflow Alert] ${msg}`);
        }
        break;
      }

      case 'navigate': {
        const url = config.url || '/';
        if (ctx.navigate) {
          ctx.navigate(url);
        } else {
          window.location.href = url;
        }
        break;
      }

      case 'apiCall': {
        const endpoint = config.endpoint || 'https://jsonplaceholder.typicode.com/posts';
        const method = config.method || 'GET';
        try {
          const res = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: method !== 'GET' ? JSON.stringify(ctx.payload) : undefined,
          });
          const resData = await res.json();
          console.log('[WorkflowInterpreter] API Response:', resData);
          if (ctx.showAlert) ctx.showAlert(`API Call Success: ${res.status}`);
        } catch (err) {
          console.error('[WorkflowInterpreter] API Call Error:', err);
        }
        break;
      }

      case 'serviceCall':
      case 'service': {
        const bindingId = String(config.bindingId || node.data.serviceId || '');
        const operation = String(config.operation || node.data.operation || '');
        if (!bindingId || !operation || !ctx.appSlug) throw new Error(`Service node '${node.id}' is missing bindingId, operation or appSlug`);
        const body = config.input && typeof config.input === 'object' ? config.input : (ctx.payload || {});
        const response = await fetch(`/api/runtime/${encodeURIComponent(ctx.appSlug)}/services/${encodeURIComponent(bindingId)}/${encodeURIComponent(operation)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.idempotencyKey || operation === 'sendTemplate' ? { 'Idempotency-Key': String(config.idempotencyKey || crypto.randomUUID()) } : {}) }, body: JSON.stringify(body),
        });
        const result = await response.json() as { ok?: boolean; data?: unknown; error?: { message?: string } };
        if (!response.ok || !result.ok) throw new Error(result.error?.message || `Service returned ${response.status}`);
        ctx.results = { ...(ctx.results || {}), [String(config.saveResultAs || node.id)]: result.data };
        break;
      }

      default:
        console.log(`[WorkflowInterpreter] Unhandled Action Type: ${actionType}`);
    }

    // Continue flow execution recursively
    await this.processNextNodes(node.id, ctx);
  }

  private evaluateCondition(node: WorkflowNode, ctx: ExecutionContext): boolean {
    const field = node.data.config?.field;
    const value = node.data.config?.value;

    if (!field || !ctx.payload) return true;
    return String(ctx.payload[field]) === String(value);
  }
}
