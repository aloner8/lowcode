'use client';

import React, { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Image as ImageExtension } from '@tiptap/extension-image';
import { Table as TableExtension } from '@tiptap/extension-table';
import { TableRow as TableRowExtension } from '@tiptap/extension-table-row';
import { TableCell as TableCellExtension } from '@tiptap/extension-table-cell';
import { TableHeader as TableHeaderExtension } from '@tiptap/extension-table-header';
import { Color as ColorExtension } from '@tiptap/extension-color';
import { TextStyle as TextStyleExtension } from '@tiptap/extension-text-style';
import { Highlight as HighlightExtension } from '@tiptap/extension-highlight';
import { TaskList as TaskListExtension } from '@tiptap/extension-task-list';
import { TaskItem as TaskItemExtension } from '@tiptap/extension-task-item';

import { FileAttachment } from './editor/FileAttachmentNode';
import { DynamicHtmlComponent } from './DynamicHtmlComponent';
import { FileManagerPopupComponent, type FileManagerAsset, type FileManagerPopupProps } from './FileManagerPopupComponent';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  CheckSquare,
  Code,
  Copy,
  Eye,
  FileDown,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Plus,
} from 'lucide-react';

export interface HtmlEditorProps {
  label?: string;
  initialContent?: string;
  onChange?: (html: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  onUploadFile?: (file: File) => Promise<{ url: string; fileName: string; fileSize?: string; fileType?: string }>;
  fileManagerRootPath?: string;
  fileManagerCurrentPath?: string;
  imageFileManagerPath?: string;
  documentFileManagerPath?: string;
  onFileManagerPathChange?: (path: string) => void;
  onFileManagerLoad?: FileManagerPopupProps['onLoad'];
  readOnly?: boolean;
  className?: string;
}

export const HtmlEditorComponent: React.FC<HtmlEditorProps> = ({
  label = 'Rich HTML Editor',
  initialContent = `
    <h2>Welcome to modern React HTML Editor! ✨</h2>
    <p>This is a shared component built with Tiptap, supporting full rich text formatting, tables, images, and document attachments.</p>
    <div data-file-attachment="true" data-url="#" data-name="Project-Specification-2026.pdf" data-size="2.4 MB" data-type="PDF" class="file-attachment-card my-2 p-2 border rounded-3 d-inline-flex align-items-center gap-3 bg-white text-dark shadow-sm border-light-subtle position-relative" style="max-width: 100%; min-width: 280px; user-select: none;">
      <div class="badge bg-primary bg-opacity-10 text-primary p-2 rounded-2 font-monospace fw-bold text-uppercase" style="font-size: 0.75rem;">PDF</div>
      <div class="d-flex flex-column flex-grow-1 overflow-hidden">
        <a href="#" target="_blank" rel="noopener noreferrer" class="file-name fw-semibold text-dark text-decoration-none text-truncate d-block" style="font-size: 0.875rem;">Project-Specification-2026.pdf</a>
        <small class="file-size text-muted" style="font-size: 0.75rem;">2.4 MB</small>
      </div>
      <a href="#" target="_blank" class="btn btn-sm btn-light border text-secondary px-2 py-1 ms-auto d-flex align-items-center gap-1" style="font-size: 0.75rem;">Download</a>
    </div>
  `,
  onChange,
  onUploadImage,
  onUploadFile,
  fileManagerRootPath = '/uploads',
  fileManagerCurrentPath,
  imageFileManagerPath,
  documentFileManagerPath,
  onFileManagerPathChange,
  onFileManagerLoad,
  readOnly = false,
  className = '',
}) => {
  const [mode, setMode] = useState<'visual' | 'source' | 'preview'>('visual');
  const [sourceCode, setSourceCode] = useState<string>(initialContent);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [showTableMenu, setShowTableMenu] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [imageCurrentPath, setImageCurrentPath] = useState(imageFileManagerPath || fileManagerCurrentPath || fileManagerRootPath);
  const [documentCurrentPath, setDocumentCurrentPath] = useState(documentFileManagerPath || fileManagerCurrentPath || fileManagerRootPath);


  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      TextStyleExtension,
      ColorExtension,
      HighlightExtension.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ImageExtension.configure({ inline: true, allowBase64: true }),
      TableExtension.configure({ resizable: true }),
      TableRowExtension,
      TableHeaderExtension,
      TableCellExtension,
      TaskListExtension,
      TaskItemExtension.configure({ nested: true }),
      FileAttachment,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'studio-tiptap-content focus-ring-0',
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      setSourceCode(html);
      if (onChange) onChange(html);
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused && editor.getHTML() !== sourceCode && mode === 'source') {
      editor.commands.setContent(sourceCode, { emitUpdate: false });
    }
  }, [sourceCode, mode, editor]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setSourceCode(val);
    if (onChange) onChange(val);
    if (editor) {
      editor.commands.setContent(val, { emitUpdate: false });
    }
  };

  const uploadFromManager = async (files: File[], path: string, kind: 'image' | 'document'): Promise<FileManagerAsset[]> => Promise.all(files.map(async (file, index) => {
    if (kind === 'image' && onUploadImage) {
      const url = await onUploadImage(file);
      return { id: `image-${Date.now()}-${index}`, name: file.name, path: `${path}/${file.name}`, url, mimeType: file.type, size: file.size };
    }
    if (kind === 'document' && onUploadFile) {
      const result = await onUploadFile(file);
      return { id: `document-${Date.now()}-${index}`, name: result.fileName || file.name, path: `${path}/${result.fileName || file.name}`, url: result.url, mimeType: file.type, size: file.size };
    }
    return { id: `local-${Date.now()}-${index}`, name: file.name, path: `${path}/${file.name}`, url: URL.createObjectURL(file), mimeType: file.type, size: file.size };
  }));

  const useImages = (files: FileManagerAsset[]) => {
    if (!editor) return;
    files.forEach((file) => editor.chain().focus().setImage({ src: file.url, alt: file.name }).run());
    setShowImageModal(false);
  };

  const useDocuments = (files: FileManagerAsset[]) => {
    if (!editor) return;
    files.forEach((file) => (editor.chain().focus() as any).setFileAttachment({
      url: file.url, fileName: file.name, fileSize: file.size ? `${(file.size / 1024).toFixed(1)} KB` : '', fileType: file.name.split('.').pop()?.toUpperCase() || 'FILE',
    }).run());
    setShowDocModal(false);
  };

  // Link Setter
  const setLink = () => {
    const previous = editor?.getAttributes('link').href || '';
    const href = window.prompt('Enter URL:', previous);
    if (href === null) return;
    if (!href) editor?.chain().focus().unsetLink().run();
    else editor?.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  // Copy HTML Source
  const handleCopySource = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const commandBtn = (action: () => void, active = false, title?: string, icon?: React.ReactNode, disabled = false) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`btn btn-sm border-0 rounded-1 px-2 py-1 ${
        active ? 'btn-primary text-white' : 'btn-light text-secondary hover-bg-gray'
      }`}
      onClick={action}
    >
      {icon}
    </button>
  );

  return (
    <div className={`card shadow-sm border rounded-3 overflow-hidden bg-white ${className}`}>
      {/* Header Bar */}
      <div className="d-flex justify-content-between align-items-center border-bottom bg-light px-3 py-2">
        <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
          <FileText size={18} className="text-primary" />
          {label}
        </h6>
        <div className="d-flex align-items-center gap-2">
          <div className="btn-group btn-group-sm bg-white p-0.5 border rounded-2">
            <button
              type="button"
              className={`btn btn-sm border-0 rounded-1 ${mode === 'visual' ? 'btn-primary' : 'btn-light text-secondary'}`}
              onClick={() => setMode('visual')}
            >
              <Pilcrow size={13} className="me-1" />
              Visual Editor
            </button>
            <button
              type="button"
              className={`btn btn-sm border-0 rounded-1 ${mode === 'source' ? 'btn-primary' : 'btn-light text-secondary'}`}
              onClick={() => setMode('source')}
            >
              <Braces size={13} className="me-1" />
              HTML Source
            </button>
            <button
              type="button"
              className={`btn btn-sm border-0 rounded-1 ${mode === 'preview' ? 'btn-primary' : 'btn-light text-secondary'}`}
              onClick={() => setMode('preview')}
            >
              <Eye size={13} className="me-1" />
              Live Preview
            </button>
          </div>
        </div>
      </div>

      {/* Main Mode Rendering */}
      {mode === 'visual' && (
        <>
          {/* Main Toolbar */}
          <div className="d-flex flex-wrap align-items-center gap-1 border-bottom bg-white p-2">
            {/* History */}
            {commandBtn(() => editor?.chain().focus().undo().run(), false, 'Undo (Ctrl+Z)', <Undo2 size={15} />)}
            {commandBtn(() => editor?.chain().focus().redo().run(), false, 'Redo (Ctrl+Y)', <Redo2 size={15} />)}

            <span className="border-start mx-1 vh-50" style={{ height: '18px' }} />

            {/* Headings */}
            {commandBtn(
              () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
              editor?.isActive('heading', { level: 1 }),
              'Heading 1',
              <Heading1 size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
              editor?.isActive('heading', { level: 2 }),
              'Heading 2',
              <Heading2 size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
              editor?.isActive('heading', { level: 3 }),
              'Heading 3',
              <Heading3 size={15} />
            )}

            <span className="border-start mx-1 vh-50" style={{ height: '18px' }} />

            {/* Inline Formatting */}
            {commandBtn(() => editor?.chain().focus().toggleBold().run(), editor?.isActive('bold'), 'Bold', <Bold size={15} />)}
            {commandBtn(() => editor?.chain().focus().toggleItalic().run(), editor?.isActive('italic'), 'Italic', <Italic size={15} />)}
            {commandBtn(
              () => editor?.chain().focus().toggleUnderline().run(),
              editor?.isActive('underline'),
              'Underline',
              <UnderlineIcon size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().toggleStrike().run(),
              editor?.isActive('strike'),
              'Strikethrough',
              <Strikethrough size={15} />
            )}

            {/* Color Pickers */}
            <div className="dropdown d-inline-block">
              <button
                type="button"
                className="btn btn-sm btn-light border-0 text-secondary px-2 py-1"
                data-bs-toggle="dropdown"
                title="Text Color"
              >
                <Palette size={15} className="text-primary" />
              </button>
              <ul className="dropdown-menu p-2 shadow-sm border-0" style={{ minWidth: '160px' }}>
                <li className="small fw-bold text-muted mb-1 px-1">Text Color</li>
                <div className="d-flex flex-wrap gap-1">
                  {['#000000', '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#8b5cf6'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="btn p-0 border rounded-circle"
                      style={{ width: '20px', height: '20px', backgroundColor: color }}
                      onClick={() => editor?.chain().focus().setColor(color).run()}
                    />
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm btn-light border rounded-circle text-muted p-0"
                    style={{ width: '20px', height: '20px', fontSize: '10px' }}
                    onClick={() => editor?.chain().focus().unsetColor().run()}
                  >
                    ×
                  </button>
                </div>
              </ul>
            </div>

            <div className="dropdown d-inline-block">
              <button
                type="button"
                className="btn btn-sm btn-light border-0 text-secondary px-2 py-1"
                data-bs-toggle="dropdown"
                title="Highlight Color"
              >
                <Highlighter size={15} className="text-warning" />
              </button>
              <ul className="dropdown-menu p-2 shadow-sm border-0" style={{ minWidth: '160px' }}>
                <li className="small fw-bold text-muted mb-1 px-1">Text Highlight</li>
                <div className="d-flex flex-wrap gap-1">
                  {['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="btn p-0 border rounded"
                      style={{ width: '20px', height: '20px', backgroundColor: color }}
                      onClick={() => editor?.chain().focus().toggleHighlight({ color }).run()}
                    />
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm btn-light border text-muted p-0"
                    style={{ width: '20px', height: '20px', fontSize: '10px' }}
                    onClick={() => editor?.chain().focus().unsetHighlight().run()}
                  >
                    ×
                  </button>
                </div>
              </ul>
            </div>

            <span className="border-start mx-1 vh-50" style={{ height: '18px' }} />

            {/* Alignment */}
            {commandBtn(
              () => editor?.chain().focus().setTextAlign('left').run(),
              editor?.isActive({ textAlign: 'left' }),
              'Align Left',
              <AlignLeft size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().setTextAlign('center').run(),
              editor?.isActive({ textAlign: 'center' }),
              'Align Center',
              <AlignCenter size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().setTextAlign('right').run(),
              editor?.isActive({ textAlign: 'right' }),
              'Align Right',
              <AlignRight size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().setTextAlign('justify').run(),
              editor?.isActive({ textAlign: 'justify' }),
              'Align Justify',
              <AlignJustify size={15} />
            )}

            <span className="border-start mx-1 vh-50" style={{ height: '18px' }} />

            {/* Lists & Blocks */}
            {commandBtn(
              () => editor?.chain().focus().toggleBulletList().run(),
              editor?.isActive('bulletList'),
              'Bullet List',
              <List size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().toggleOrderedList().run(),
              editor?.isActive('orderedList'),
              'Ordered List',
              <ListOrdered size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().toggleTaskList().run(),
              editor?.isActive('taskList'),
              'Task Check List',
              <CheckSquare size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().toggleBlockquote().run(),
              editor?.isActive('blockquote'),
              'Quote',
              <Quote size={15} />
            )}

            <span className="border-start mx-1 vh-50" style={{ height: '18px' }} />

            {/* Inserts */}
            {commandBtn(setLink, editor?.isActive('link'), 'Insert Link', <Link2 size={15} />)}
            {commandBtn(() => setShowImageModal(true), false, 'Insert Image', <ImageIcon size={15} className="text-success" />)}
            {commandBtn(() => setShowDocModal(true), false, 'Attach Document/File', <FileDown size={15} className="text-primary" />)}

            {/* Table Dropdown */}
            <div className="position-relative d-inline-block">
              {commandBtn(
                () => setShowTableMenu(!showTableMenu),
                editor?.isActive('table'),
                'Table Controls',
                <TableIcon size={15} className="text-info" />
              )}
              {showTableMenu && (
                <div
                  className="position-absolute bg-white shadow border rounded-3 p-2 mt-1 z-3"
                  style={{ minWidth: '180px', left: 0 }}
                >
                  <div className="d-flex flex-column gap-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-light text-start"
                      onClick={() => {
                        editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                        setShowTableMenu(false);
                      }}
                    >
                      <Plus size={12} className="me-1" /> Insert 3x3 Table
                    </button>
                    {editor?.isActive('table') && (
                      <>
                        <hr className="my-1" />
                        <button
                          type="button"
                          className="btn btn-sm btn-light text-start"
                          onClick={() => editor?.chain().focus().addColumnAfter().run()}
                        >
                          Add Column
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light text-start"
                          onClick={() => editor?.chain().focus().deleteColumn().run()}
                        >
                          Delete Column
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light text-start"
                          onClick={() => editor?.chain().focus().addRowAfter().run()}
                        >
                          Add Row
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light text-start"
                          onClick={() => editor?.chain().focus().deleteRow().run()}
                        >
                          Delete Row
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger text-start text-danger mt-1"
                          onClick={() => {
                            editor?.chain().focus().deleteTable().run();
                            setShowTableMenu(false);
                          }}
                        >
                          <Trash2 size={12} className="me-1" /> Delete Table
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {commandBtn(
              () => editor?.chain().focus().setHorizontalRule().run(),
              false,
              'Horizontal Divider',
              <Minus size={15} />
            )}
            {commandBtn(
              () => editor?.chain().focus().unsetAllMarks().clearNodes().run(),
              false,
              'Clear Formatting',
              <RemoveFormatting size={15} />
            )}
          </div>

          {/* Tiptap Canvas */}
          <div className="bg-white min-h-200">
            <EditorContent editor={editor} />
          </div>
        </>
      )}

      {/* Source Editor Mode */}
      {mode === 'source' && (
        <div className="position-relative">
          <div className="d-flex justify-content-between align-items-center bg-dark text-white px-3 py-1.5 small">
            <span className="font-monospace text-muted d-flex align-items-center gap-1">
              <Code size={14} className="text-warning" /> HTML Markup Source Code
            </span>
            <button type="button" className="btn btn-sm btn-outline-light py-0 px-2" onClick={handleCopySource}>
              <Copy size={12} className="me-1" />
              {copySuccess ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <textarea
            className="form-control border-0 rounded-0 font-monospace bg-dark text-light p-3"
            rows={12}
            value={sourceCode}
            onChange={handleSourceChange}
            spellCheck={false}
            style={{ fontSize: '0.85rem', lineHeight: '1.5', resize: 'vertical' }}
          />
        </div>
      )}

      {/* Live Preview Mode */}
      {mode === 'preview' && (
        <div className="p-4 bg-light min-h-200">
          <div className="card shadow-sm border p-4 bg-white">
            <DynamicHtmlComponent content={sourceCode} />
          </div>
        </div>
      )}

      {/* Footer Status Bar */}
      <div className="border-top bg-light px-3 py-1.5 d-flex justify-content-between align-items-center small text-muted">
        <span>Tiptap v3 · Custom React Node Extensions</span>
        <span>{sourceCode.length} characters</span>
      </div>

      <FileManagerPopupComponent
        open={showImageModal}
        title="เลือกหรืออัปโหลดรูปภาพ"
        rootPath={fileManagerRootPath}
        currentPath={imageCurrentPath}
        selectionMode="multiple"
        accept="image/*"
        useButtonText="แทรกรูปภาพ"
        onLoad={onFileManagerLoad}
        onCurrentPathChange={(path) => { setImageCurrentPath(path); onFileManagerPathChange?.(path); }}
        onUpload={(files, path) => uploadFromManager(files, path, 'image')}
        onUse={useImages}
        onClose={() => setShowImageModal(false)}
      />
      <FileManagerPopupComponent
        open={showDocModal}
        title="เลือกหรืออัปโหลดเอกสาร"
        rootPath={fileManagerRootPath}
        currentPath={documentCurrentPath}
        selectionMode="multiple"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv"
        useButtonText="แนบเอกสาร"
        onLoad={onFileManagerLoad}
        onCurrentPathChange={(path) => { setDocumentCurrentPath(path); onFileManagerPathChange?.(path); }}
        onUpload={(files, path) => uploadFromManager(files, path, 'document')}
        onUse={useDocuments}
        onClose={() => setShowDocModal(false)}
      />

      {/* Editor CSS */}
      <style jsx global>{`
        .studio-tiptap-content {
          min-height: 240px;
          padding: 1.25rem;
          outline: none;
          font-size: 0.925rem;
          line-height: 1.7;
          color: #1f2937;
        }
        .studio-tiptap-content p {
          margin-bottom: 0.75rem;
        }
        .studio-tiptap-content h1,
        .studio-tiptap-content h2,
        .studio-tiptap-content h3,
        .studio-tiptap-content h4 {
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.75rem;
        }
        .studio-tiptap-content blockquote {
          border-left: 4px solid #4f46e5;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #4b5563;
          font-style: italic;
        }
        .studio-tiptap-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 0.5rem 0;
        }
        .studio-tiptap-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        .studio-tiptap-content th,
        .studio-tiptap-content td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem 0.75rem;
        }
        .studio-tiptap-content th {
          background-color: #f9fafb;
          font-weight: 600;
        }
        .studio-tiptap-content ul[data-type='taskList'] {
          list-style: none;
          padding-left: 0;
        }
        .studio-tiptap-content ul[data-type='taskList'] li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
};
