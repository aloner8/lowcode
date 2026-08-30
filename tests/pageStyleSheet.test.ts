import { describe, expect, it } from 'vitest';
import { compilePageCss, compilePageStyleSheet } from '../src/lib/engine/pageStyleSheet';
import type { PageStyleSheet } from '../src/types';

describe('compilePageStyleSheet', () => {
  it('scopes component, descendant, state and responsive rules', () => {
    const css = compilePageStyleSheet({
      scopeId: 'page-auth.login',
      rules: [
        { id: 'base', componentId: 'auth.login.form', declarations: { color: '#123456' } },
        { id: 'hover', componentId: 'auth.login.form', selector: '.btn-primary', state: 'hover', declarations: { 'background-color': '#084298' } },
        { id: 'mobile', componentId: 'auth.login.form', breakpoint: 'mobile', declarations: { padding: '12px' } },
      ],
    });

    expect(css).toContain('[data-page-style-scope="page-auth-login"] [data-component-instance-id="auth\\2e login\\2e form"]{color:#123456}');
    expect(css).toContain('[data-component-instance-id="auth\\2e login\\2e form"] .btn-primary:hover{background-color:#084298}');
    expect(css).toContain('@media(max-width:575.98px)');
  });

  it('drops unsafe selectors, properties and values', () => {
    const css = compilePageStyleSheet({
      scopeId: 'safe',
      rules: [
        { id: 'selector', componentId: 'one', selector: 'body .target', declarations: { color: 'red' } },
        { id: 'value', componentId: 'two', declarations: { color: 'expression(alert(1))', 'background-color': 'blue' } },
        { id: 'property', componentId: 'three', declarations: { 'bad property': 'red' } },
      ],
    });

    expect(css).not.toContain('body');
    expect(css).not.toContain('expression');
    expect(css).toContain('background-color:blue');
    expect(css).not.toContain('bad property');
  });

  it('keeps page, layout and component CSS in one compiled view', () => {
    const styleSheet: PageStyleSheet = {
      scopeId: 'page-login',
      rules: [
        { id: 'page', declarations: { color: '#111' } },
        { id: 'layout', layoutRegion: 'content', declarations: { padding: '20px' } },
        { id: 'component', componentId: 'login.form', state: 'hover', declarations: { opacity: '.9' } },
      ],
    };
    const css = compilePageCss(styleSheet, [{ id: 'login.form', type: 'FormComponent', props: {}, style: { backgroundColor: '#fff' } }]);

    expect(css).toContain('[data-page-style-scope="page-login"]{color:#111}');
    expect(css).toContain('[data-layout-region="content"]{padding:20px}');
    expect(css).toContain('[data-component-instance-id="login\\2e form"]{background-color:#fff}');
    expect(css).toContain('[data-component-instance-id="login\\2e form"]:hover{opacity:.9}');
  });
});
