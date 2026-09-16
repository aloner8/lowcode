import 'server-only';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { ServiceError } from './errors';
import type { SocialAuthProvider } from './oauthProviders';

const stateHash = (state: string) => createHash('sha256').update(state).digest('hex');

export async function ensureFederatedAuthSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS sys;
    ALTER TABLE public.auth_users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
    CREATE TABLE IF NOT EXISTS sys.auth_oauth_states (
      state_hash char(64) PRIMARY KEY,
      provider varchar(20) NOT NULL,
      binding_id varchar(160) NOT NULL,
      verifier text NOT NULL,
      nonce text NOT NULL,
      redirect_uri text NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS sys.auth_external_identities (
      provider varchar(20) NOT NULL,
      subject varchar(500) NOT NULL,
      user_id bigint NOT NULL,
      email varchar(320),
      profile jsonb NOT NULL DEFAULT '{}'::jsonb,
      linked_at timestamptz NOT NULL DEFAULT now(),
      last_login_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(provider, subject),
      UNIQUE(provider, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_auth_oauth_states_expiry ON sys.auth_oauth_states(expires_at);
  `);
}

export async function storeOAuthState(pool: Pool, input: { state: string; provider: SocialAuthProvider; bindingId: string; verifier: string; nonce: string; redirectUri: string }): Promise<void> {
  await ensureFederatedAuthSchema(pool);
  await pool.query('DELETE FROM sys.auth_oauth_states WHERE expires_at < now() OR consumed_at < now() - interval \'10 minutes\'');
  await pool.query(
    `INSERT INTO sys.auth_oauth_states(state_hash,provider,binding_id,verifier,nonce,redirect_uri,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')`,
    [stateHash(input.state), input.provider, input.bindingId, input.verifier, input.nonce, input.redirectUri],
  );
}

export async function consumeOAuthState(pool: Pool, input: { state: string; provider: SocialAuthProvider; bindingId: string; redirectUri: string }): Promise<{ verifier: string; nonce: string }> {
  await ensureFederatedAuthSchema(pool);
  const result = await pool.query<{ verifier: string; nonce: string }>(
    `UPDATE sys.auth_oauth_states SET consumed_at=now()
     WHERE state_hash=$1 AND provider=$2 AND binding_id=$3 AND redirect_uri=$4
       AND consumed_at IS NULL AND expires_at>now()
     RETURNING verifier,nonce`,
    [stateHash(input.state), input.provider, input.bindingId, input.redirectUri],
  );
  if (!result.rowCount) throw new ServiceError('PROVIDER_AUTH_FAILED', 'The login state is invalid or expired', 401);
  return result.rows[0];
}
