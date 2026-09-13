import 'server-only';
import { getCoreDb } from '@/lib/db/coreDb';

export type AppDesiredState = 'RUNNING' | 'STOPPED';
export type AppObservedState = 'UNPROVISIONED' | 'PROVISIONING' | 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAILED';

export interface AppRuntimeState {
  appId: string;
  desiredState: AppDesiredState;
  observedState: AppObservedState;
  error: string | null;
  healthCheckedAt: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  metrics: { cpuPercent?: number | null; memoryRssBytes?: number; uptimeSeconds?: number } | null;
  metricsAt: string | null;
  lastOperation: {
    id: string;
    type: 'START' | 'STOP';
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    checkpoint: string;
    error: string | null;
    createdAt: string;
    finishedAt: string | null;
  } | null;
}

interface StateRow {
  id: string; desired_state: AppDesiredState; observed_state: AppObservedState;
  runtime_error_detail: string | null; health_checked_at: Date | null;
  runtime_started_at: Date | null; runtime_stopped_at: Date | null;
  runtime_metrics: AppRuntimeState['metrics']; runtime_metrics_at: Date | null;
  operation_id: string | null; operation_type: 'START' | 'STOP' | null;
  operation_status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | null;
  operation_checkpoint: string | null; operation_error: string | null;
  operation_created_at: Date | null; operation_finished_at: Date | null;
}

export async function loadAppRuntimeState(appId: string): Promise<AppRuntimeState | null> {
  const result = await getCoreDb().query<StateRow>(`
    SELECT app.id, app.desired_state, app.observed_state, app.runtime_error_detail,
           app.health_checked_at, app.runtime_started_at, app.runtime_stopped_at,
           app.runtime_metrics, app.runtime_metrics_at,
           operation.id AS operation_id, operation.operation_type,
           operation.status AS operation_status, operation.checkpoint AS operation_checkpoint,
           operation.error_detail AS operation_error, operation.created_at AS operation_created_at,
           operation.finished_at AS operation_finished_at
    FROM public.apps app
    LEFT JOIN LATERAL (
      SELECT id, operation_type, status, checkpoint, error_detail, created_at, finished_at
      FROM public.app_operations
      WHERE app_id = app.id AND operation_type IN ('START', 'STOP')
      ORDER BY created_at DESC LIMIT 1
    ) operation ON TRUE
    WHERE app.id = $1
  `, [appId]);
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    appId: row.id,
    desiredState: row.desired_state,
    observedState: row.observed_state,
    error: row.runtime_error_detail,
    healthCheckedAt: row.health_checked_at?.toISOString() ?? null,
    startedAt: row.runtime_started_at?.toISOString() ?? null,
    stoppedAt: row.runtime_stopped_at?.toISOString() ?? null,
    metrics: row.runtime_metrics,
    metricsAt: row.runtime_metrics_at?.toISOString() ?? null,
    lastOperation: row.operation_id ? {
      id: row.operation_id,
      type: row.operation_type!,
      status: row.operation_status!,
      checkpoint: row.operation_checkpoint!,
      error: row.operation_error,
      createdAt: row.operation_created_at!.toISOString(),
      finishedAt: row.operation_finished_at?.toISOString() ?? null,
    } : null,
  };
}

export async function registerAppRuntimeOperation(input: {
  actorId: string; appId: string; desiredState: AppDesiredState; operationKey: string;
}): Promise<{ operationId: string; reused: boolean }> {
  const result = await getCoreDb().query<{ registered_operation_id: string; reused: boolean }>(
    'SELECT * FROM public.register_app_runtime_operation($1, $2, $3, $4)',
    [input.actorId, input.appId, input.desiredState, input.operationKey],
  );
  return { operationId: result.rows[0].registered_operation_id, reused: result.rows[0].reused };
}
