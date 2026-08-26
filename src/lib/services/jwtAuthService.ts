import { createHmac, timingSafeEqual } from 'node:crypto';
import type { StudioServiceDefinition } from '@/types';

export interface JwtClaims { sub: string; roles?: string[]; [key: string]: unknown }
interface JwtPayload extends JwtClaims { iss: string; aud: string; iat: number; exp: number }

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const signature = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');

export function issueJwt(claims: JwtClaims, config: StudioServiceDefinition['config'], secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!claims.sub) throw new Error('JWT subject is required');
  if (!secret) throw new Error(`JWT secret '${config.secretEnvKey}' is not configured`);
  const unsigned = `${encode({ alg: config.algorithm, typ: 'JWT' })}.${encode({ ...claims, iss: config.issuer, aud: config.audience, iat: nowSeconds, exp: nowSeconds + config.accessTokenTtlSeconds })}`;
  return `${unsigned}.${signature(unsigned, secret)}`;
}

export function verifyJwt(token: string, config: StudioServiceDefinition['config'], secret: string, nowSeconds = Math.floor(Date.now() / 1000)): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3 || !secret) throw new Error('Invalid JWT');
  const unsigned = `${parts[0]}.${parts[1]}`;
  const actual = Buffer.from(parts[2]);
  const expected = Buffer.from(signature(unsigned, secret));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid JWT signature');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { alg?: string };
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as JwtPayload;
  if (header.alg !== config.algorithm || payload.iss !== config.issuer || payload.aud !== config.audience || payload.exp <= nowSeconds) throw new Error('JWT claims are invalid or expired');
  return payload;
}

export function resolveContainerJwtConfig(service: StudioServiceDefinition, containerName: string) {
  const binding = service.containerBindings.find((item) => item.containerName === containerName);
  return { enabled: service.enabled && (binding?.enabled ?? true), config: { ...service.config, ...(binding?.configOverrides || {}) } };
}
