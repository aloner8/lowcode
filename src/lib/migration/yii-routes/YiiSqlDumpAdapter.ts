import type { YiiNormalizedSource, YiiSourceMenu } from './types';

const decodeSqlString = (value: string) => value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');

function splitSqlValues(input: string): string[] {
  const values: string[] = []; let current = ''; let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "'" && input[index - 1] !== '\\') quoted = !quoted;
    if (char === ',' && !quoted) { values.push(current.trim()); current = ''; } else current += char;
  }
  values.push(current.trim());
  return values.map((value) => value === 'NULL' ? '' : value.startsWith("'") && value.endsWith("'") ? decodeSqlString(value.slice(1, -1)) : value);
}

export function extractYiiSqlDump(sqlText: string): YiiNormalizedSource {
  const menus: YiiSourceMenu[] = [];
  const insertPattern = /INSERT\s+INTO\s+[`"]?cms_menu[`"]?\s+VALUES\s*\((.*)\);\s*$/gim;
  for (const match of sqlText.matchAll(insertPattern)) {
    const values = splitSqlValues(match[1]);
    if (values.length < 4) continue;
    const [id, parentId, label, href, icon, location] = values;
    menus.push({ sourceKey: `cms_menu:${id}`, id, parentId: parentId || undefined, label, href: href.trim(), icon: icon || undefined, location: location || undefined });
  }
  return { menus, metadata: { adapterId: 'yii2-sql-dump', menuTable: 'cms_menu', extractedAt: new Date().toISOString() } };
}
