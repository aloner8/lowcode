// @vitest-environment jsdom

import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MailTemplateEditor } from '@/components/studio/MailTemplateEditor';
import { normalizeMailTemplates, renderMailTemplatePreview } from '@/lib/services/mailBindingTemplates';

afterEach(cleanup);

function Harness() {
  const [value, setValue] = useState<unknown>({ welcome: { subject: 'Welcome {{name}}', html: '<p>Hello {{name}}</p>' } });
  return <><MailTemplateEditor value={value} onChange={setValue}/><output data-testid="templates-json">{JSON.stringify(value)}</output></>;
}

describe('MailTemplateEditor', () => {
  it('adds, edits, previews and removes templates without raw binding JSON', async () => {
    const user = userEvent.setup();
    render(<Harness/>);

    expect(screen.getByTestId('mail-html-preview').textContent).toBe('<p>Hello Artit</p>');
    await user.clear(screen.getByLabelText('New mail template ID'));
    await user.type(screen.getByLabelText('New mail template ID'), 'receipt');
    await user.click(screen.getByRole('button', { name: /Add/i }));
    expect((screen.getByLabelText('Mail template') as HTMLSelectElement).value).toBe('receipt');

    await user.clear(screen.getByLabelText('Subject'));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Receipt for {{name}}' } });
    expect(screen.getByTestId('templates-json').textContent).toContain('Receipt for {{name}}');
    expect(screen.getByText(/Subject:/).parentElement?.textContent).toContain('Receipt for Artit');

    await user.click(screen.getByRole('button', { name: 'Delete mail template' }));
    expect((screen.getByLabelText('Mail template') as HTMLSelectElement).value).toBe('welcome');
    expect(screen.getByTestId('templates-json').textContent).not.toContain('receipt');
  });

  it('rejects unsafe IDs and ignores malformed stored templates', async () => {
    const user = userEvent.setup();
    render(<Harness/>);
    await user.type(screen.getByLabelText('New mail template ID'), '../bad');
    await user.click(screen.getByRole('button', { name: /Add/i }));
    expect(screen.getByRole('alert').textContent).toContain('Template ID must start with a letter');
    expect(normalizeMailTemplates({ good: { subject: 'S', html: 'H' }, '../bad': { subject: 'S', html: 'H' }, broken: { subject: 1 } })).toEqual({ good: { subject: 'S', html: 'H' } });
  });

  it('renders nested preview variables deterministically', () => {
    expect(renderMailTemplatePreview('{{user.name}} / {{missing}}', { user: { name: 'Nox' } })).toBe('Nox / ');
  });
});
