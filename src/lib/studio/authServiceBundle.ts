import type { AppRoute, ComponentNode, StudioServiceDefinition } from '@/types';
import type { StudioCollectionDefinition } from '@/lib/studio/backendFormDefinitions';

const collection = (id: string, name: string, table: string, fields: Array<Record<string, unknown>>, relations?: StudioCollectionDefinition['relations']): StudioCollectionDefinition => ({
  id, moduleId: 'auth', name, table, primaryKey: ['id'], operations: ['list', 'get', 'create', 'update', 'delete'], relations, scope: 'project', tenantTarget: true,
  standardFlows: {
    create: { trigger: 'create', target: 'FormComponent', formId: `${id}.form`, params: { mode: 'insert' } },
    edit: { trigger: 'edit', source: 'DataTableComponent', target: 'FormComponent', formId: `${id}.form`, rowIdField: 'id', params: { mode: 'update' } },
    view: { trigger: 'view', source: 'DataTableComponent', target: 'DynamicHtmlComponent', componentId: `${id}.view-detail`, rowIdField: 'id', params: { mode: 'preview' } },
  },
  components: [
    { id: `${id}.datatable`, type: 'DataTableComponent', label: `${name} Table`, recommended: true, componentTree: [{ id: `${id}.table`, type: 'DataTableComponent', props: { title: name, collectionId: id, dataSource: { kind: 'collection', table }, columns: fields, searchable: true, rowActions: ['view', 'edit', 'delete'] } }] },
    { id: `${id}.form`, type: 'FormComponent', label: `${name} Form`, componentTree: [{ id: `${id}.form.component`, type: 'FormComponent', props: { title: name, collectionId: id, fields, submitText: 'Save' } }] },
    { id: `${id}.view-detail`, type: 'DynamicHtmlComponent', label: `${name} Detail`, componentTree: [{ id: `${id}.detail`, type: 'DynamicHtmlComponent', props: { collectionId: id, content: `<article class="card p-4"><h2>${name}</h2><div>{{id}}</div><div>{{name}}</div></article>` } }] },
  ],
});

export const AUTH_COLLECTIONS: StudioCollectionDefinition[] = [
  collection('auth.user.collection', 'Users', 'auth_users', [{ key: 'email', name: 'email', label: 'Email', type: 'email', required: true }, { key: 'password_hash', name: 'password_hash', label: 'Password Hash', type: 'password', writeOnly: true }, { key: 'display_name', name: 'display_name', label: 'Display Name' }, { key: 'is_active', name: 'is_active', label: 'Active', type: 'switch' }, { key: 'role_id', name: 'role_id', label: 'Role', type: 'collection-select', collectionId: 'auth.role.collection' }], [{ field: 'role_id', collectionId: 'auth.role.collection', displayField: 'name' }]),
  collection('auth.role.collection', 'Roles', 'auth_roles', [{ key: 'name', name: 'name', label: 'Role Name', required: true }, { key: 'description', name: 'description', label: 'Description' }]),
  collection('auth.permission.collection', 'Permissions', 'auth_permissions', [{ key: 'code', name: 'code', label: 'Permission Code', required: true }, { key: 'name', name: 'name', label: 'Name', required: true }, { key: 'description', name: 'description', label: 'Description' }]),
];

export const createAuthLoginPage = (containerName: string) => ({
  id: 'auth.login', name: 'Login (auth.login.page)', title: 'Login', containerName, routePath: '/login', templateType: 'auth-login', siteMapMaterialized: true,
  componentTree: [{ id: 'auth.login.form', type: 'FormComponent', label: 'JWT Login Form', actionTriggerId: 'auth.login.submit', props: { title: 'Sign in', submitText: 'Login', fields: [{ name: 'email', label: 'Email', type: 'email', required: true }, { name: 'password', label: 'Password', type: 'password', required: true }], action: { type: 'service', serviceId: 'service.auth.jwt', flowPath: '/login' } } }] as ComponentNode[],
});

export const createAuthRoute = (platformId: string, containerName: string): AppRoute => ({ id: 'route.auth.login', platformId, containerName, path: '/login', label: 'Login', targetType: 'page', targetId: 'auth.login', metadata: { nodeType: 'page', serviceId: 'service.auth.jwt', bundle: 'auth' } });

export const AUTH_LOGIN_FLOW = {
  routePath: '/login', routeLabel: 'JWT Login', templateType: 'form_crud',
  nodes: [
    { id: 'login.submit', type: 'trigger', data: { label: 'Submit Login Form', nodeType: 'trigger', actionType: 'submit' } },
    { id: 'login.user', type: 'action', data: { label: 'Find active user', nodeType: 'action', actionType: 'service', collectionId: 'auth.user.collection' } },
    { id: 'login.password', type: 'condition', data: { label: 'Verify password hash', nodeType: 'condition', actionType: 'service' } },
    { id: 'login.permission', type: 'action', data: { label: 'Load role permissions', nodeType: 'action', actionType: 'service', collections: ['auth.role.collection', 'auth.permission.collection'] } },
    { id: 'login.jwt', type: 'action', data: { label: 'Issue JWT', nodeType: 'action', actionType: 'service', serviceId: 'service.auth.jwt' } },
    { id: 'login.success', type: 'action', data: { label: 'Open Admin Page', nodeType: 'action', actionType: 'navigate', targetPageId: 'auth.admin' } },
  ],
  edges: [{ id: 'e1', source: 'login.submit', target: 'login.user' }, { id: 'e2', source: 'login.user', target: 'login.password' }, { id: 'e3', source: 'login.password', target: 'login.permission', label: 'valid' }, { id: 'e4', source: 'login.permission', target: 'login.jwt' }, { id: 'e5', source: 'login.jwt', target: 'login.success', label: 'success' }],
};

export const markAuthBundleReady = (service: StudioServiceDefinition, adminPageId: string): StudioServiceDefinition => ({ ...service, bundle: { status: 'ready', loginPageId: 'auth.login', adminPageId, userCollectionId: 'auth.user.collection', permissionCollectionId: 'auth.permission.collection', roleCollectionId: 'auth.role.collection', flowPath: '/login' } });
