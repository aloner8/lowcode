import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db/coreDb', () => ({ getCoreDb: () => ({ query: mocks.query }) }));

import { loadAppRuntimeState, registerAppRuntimeOperation } from '@/lib/runtime/appRuntimeState';

describe('P6 App runtime state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps unavailable health and metrics explicit instead of inventing zeroes', async () => {
    mocks.query.mockResolvedValue({ rowCount: 1, rows: [{
      id: 'app-a', desired_state: 'RUNNING', observed_state: 'STARTING',
      runtime_error_detail: null, health_checked_at: null, runtime_started_at: null,
      runtime_stopped_at: null, runtime_metrics: null, runtime_metrics_at: null,
      operation_id: 'operation-a', operation_type: 'START', operation_status: 'RUNNING',
      operation_checkpoint: 'REGISTERED', operation_error: null,
      operation_created_at: new Date('2026-09-13T00:00:00.000Z'), operation_finished_at: null,
    }] });
    await expect(loadAppRuntimeState('app-a')).resolves.toEqual(expect.objectContaining({
      observedState: 'STARTING', healthCheckedAt: null, metrics: null, metricsAt: null,
      lastOperation: expect.objectContaining({ id: 'operation-a', checkpoint: 'REGISTERED' }),
    }));
  });

  it('registers desired state through the atomic quota function', async () => {
    mocks.query.mockResolvedValue({ rows: [{ registered_operation_id: 'operation-a', reused: false }] });
    await expect(registerAppRuntimeOperation({
      actorId: 'user-a', appId: 'app-a', desiredState: 'RUNNING', operationKey: 'start-a',
    })).resolves.toEqual({ operationId: 'operation-a', reused: false });
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('register_app_runtime_operation'),
      ['user-a', 'app-a', 'RUNNING', 'start-a'],
    );
  });
});
