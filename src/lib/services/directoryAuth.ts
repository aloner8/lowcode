import 'server-only';
import { Client, type Entry } from 'ldapts';
import { ServiceError } from './errors';

export type DirectoryProvider = 'ldap' | 'ad-ds';

export interface DirectoryAuthConfig {
  provider: DirectoryProvider;
  url: string;
  baseDn: string;
  userFilter: string;
  groupBaseDn?: string;
  groupFilter?: string;
  emailAttribute?: string;
  displayNameAttribute?: string;
  rejectUnauthorized?: boolean;
}

export interface DirectoryIdentityProfile {
  provider: DirectoryProvider;
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  groups: string[];
}

export function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (character) => `\\${character.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

const stringValue = (entry: Entry, key: string): string | undefined => {
  const value = entry[key];
  if (Array.isArray(value)) return value.length ? String(value[0]) : undefined;
  return value === undefined ? undefined : String(value);
};

export async function authenticateDirectory(input: {
  config: DirectoryAuthConfig;
  bindDn: string;
  bindPassword: string;
  username: string;
  password: string;
}): Promise<DirectoryIdentityProfile> {
  if (!input.config.url.startsWith('ldaps://')) throw new ServiceError('SERVICE_INPUT_INVALID', 'Directory authentication requires an ldaps:// connection', 400);
  if (!input.password) throw new ServiceError('AUTH_REQUIRED', 'Username or password is incorrect', 401);
  const options = { url: input.config.url, timeout: 10_000, connectTimeout: 5_000, tlsOptions: { rejectUnauthorized: input.config.rejectUnauthorized !== false } };
  const serviceClient = new Client(options);
  const userClient = new Client(options);
  try {
    await serviceClient.bind(input.bindDn, input.bindPassword);
    const username = escapeLdapFilterValue(input.username);
    const filter = input.config.userFilter.replace(/\{\{username\}\}/g, username);
    const emailAttribute = input.config.emailAttribute || 'mail';
    const displayNameAttribute = input.config.displayNameAttribute || 'displayName';
    const result = await serviceClient.search(input.config.baseDn, { scope: 'sub', filter, sizeLimit: 2, timeLimit: 8, attributes: [emailAttribute, displayNameAttribute, 'cn'] });
    if (result.searchEntries.length !== 1) throw new ServiceError('AUTH_REQUIRED', 'Username or password is incorrect', 401);
    const entry = result.searchEntries[0];
    await userClient.bind(entry.dn, input.password);
    let groups: string[] = [];
    if (input.config.groupBaseDn && input.config.groupFilter) {
      const groupFilter = input.config.groupFilter.replace(/\{\{dn\}\}/g, escapeLdapFilterValue(entry.dn)).replace(/\{\{username\}\}/g, username);
      const groupResult = await serviceClient.search(input.config.groupBaseDn, { scope: 'sub', filter: groupFilter, sizeLimit: 200, timeLimit: 8, attributes: ['cn'] });
      groups = groupResult.searchEntries.map((group) => stringValue(group, 'cn')).filter((value): value is string => Boolean(value));
    }
    const email = stringValue(entry, emailAttribute)?.trim().toLowerCase();
    return { provider: input.config.provider, subject: entry.dn, email, emailVerified: Boolean(email), displayName: stringValue(entry, displayNameAttribute) || stringValue(entry, 'cn'), groups };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('AUTH_REQUIRED', 'Username or password is incorrect', 401);
  } finally {
    await Promise.allSettled([serviceClient.unbind(), userClient.unbind()]);
  }
}
