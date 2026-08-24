import { Node, mergeAttributes } from '@tiptap/core';

export interface FileAttachmentOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (options: { url: string; fileName: string; fileSize?: string; fileType?: string }) => ReturnType;
    };
  }
}

export const FileAttachment = Node.create<FileAttachmentOptions>({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      url: {
        default: null,
      },
      fileName: {
        default: 'Document',
      },
      fileSize: {
        default: '',
      },
      fileType: {
        default: 'DOCUMENT',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-file-attachment]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return false;
          const element = dom as HTMLElement;
          return {
            url: element.getAttribute('data-url') || element.querySelector('a')?.getAttribute('href') || '',
            fileName: element.getAttribute('data-name') || element.querySelector('.file-name')?.textContent || 'Document',
            fileSize: element.getAttribute('data-size') || element.querySelector('.file-size')?.textContent || '',
            fileType: element.getAttribute('data-type') || 'DOC',
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const fileTypeStr = (node.attrs.fileType || 'FILE').toUpperCase();
    const fileNameStr = node.attrs.fileName || 'Document';
    const fileSizeStr = node.attrs.fileSize || '';
    const fileUrlStr = node.attrs.url || '#';

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-file-attachment': 'true',
        'data-url': fileUrlStr,
        'data-name': fileNameStr,
        'data-size': fileSizeStr,
        'data-type': fileTypeStr,
        class: 'file-attachment-card my-2 p-2 border rounded-3 d-inline-flex align-items-center gap-3 bg-white text-dark shadow-sm border-light-subtle position-relative',
        style: 'max-width: 100%; min-width: 280px; user-select: none;',
      }),
      [
        'div',
        { class: 'badge bg-primary bg-opacity-10 text-primary p-2 rounded-2 font-monospace fw-bold text-uppercase', style: 'font-size: 0.75rem;' },
        fileTypeStr,
      ],
      [
        'div',
        { class: 'd-flex flex-column flex-grow-1 overflow-hidden' },
        [
          'a',
          {
            href: fileUrlStr,
            target: '_blank',
            rel: 'noopener noreferrer',
            download: fileNameStr,
            class: 'file-name fw-semibold text-dark text-decoration-none text-truncate d-block',
            style: 'font-size: 0.875rem;',
          },
          fileNameStr,
        ],
        fileSizeStr
          ? [
              'small',
              { class: 'file-size text-muted', style: 'font-size: 0.75rem;' },
              fileSizeStr,
            ]
          : '',
      ],
      [
        'a',
        {
          href: fileUrlStr,
          download: fileNameStr,
          target: '_blank',
          class: 'btn btn-sm btn-light border text-secondary px-2 py-1 ms-auto d-flex align-items-center gap-1',
          style: 'font-size: 0.75rem;',
        },
        'Download',
      ],
    ];
  },

  addCommands() {
    return {
      setFileAttachment:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
