import { describe, expect, it } from 'vitest';
import { authenticateDirectory, escapeLdapFilterValue } from '@/lib/services/directoryAuth';

describe('directory Auth adapter', () => {
  it('escapes every RFC4515 control character in user input', () => {
    expect(escapeLdapFilterValue('a*)(uid=*)\\\0')).toBe('a\\2a\\29\\28uid=\\2a\\29\\5c\\00');
  });

  it('refuses plaintext LDAP before opening a connection', async () => {
    await expect(authenticateDirectory({
      config: { provider: 'ldap', url: 'ldap://directory.internal:389', baseDn: 'dc=example,dc=test', userFilter: '(uid={{username}})' },
      bindDn: 'cn=service,dc=example,dc=test', bindPassword: 'not-used', username: 'member', password: 'not-used',
    })).rejects.toMatchObject({ code: 'SERVICE_INPUT_INVALID' });
  });
});
