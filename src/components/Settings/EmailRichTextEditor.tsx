import '../RichTextEditor.css';

import { Color } from '@tiptap/extension-color';
import ListItem from '@tiptap/extension-list-item';
import { EditorProvider, useCurrentEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useCallback } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  RemoveFormatting,
  Variable,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface EmailVariable {
  key: string;
  description: string;
}

interface MenuBarProps {
  availableVariables: EmailVariable[];
}

const MenuBar = ({ availableVariables }: MenuBarProps) => {
  const { editor } = useCurrentEditor();

  const insertVariable = useCallback(
    (variable: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(variable).run();
    },
    [editor]
  );

  if (!editor) {
    return null;
  }

  return (
    <div className="editor-toolbar">
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="toolbar-button"
        title="Undo"
        type="button"
      >
        <Undo className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="toolbar-button"
        title="Redo"
        type="button"
      >
        <Redo className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={
          editor.isActive('heading', { level: 1 })
            ? 'toolbar-button is-active'
            : 'toolbar-button'
        }
        title="Heading 1"
        type="button"
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={
          editor.isActive('heading', { level: 2 })
            ? 'toolbar-button is-active'
            : 'toolbar-button'
        }
        title="Heading 2"
        type="button"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={
          editor.isActive('heading', { level: 3 })
            ? 'toolbar-button is-active'
            : 'toolbar-button'
        }
        title="Heading 3"
        type="button"
      >
        <Heading3 className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={
          editor.isActive('bold') ? 'toolbar-button is-active' : 'toolbar-button'
        }
        title="Bold"
        type="button"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={
          editor.isActive('italic')
            ? 'toolbar-button is-active'
            : 'toolbar-button'
        }
        title="Italic"
        type="button"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={
          editor.isActive('strike')
            ? 'toolbar-button is-active'
            : 'toolbar-button'
        }
        title="Strikethrough"
        type="button"
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        className={
          editor.isActive('code') ? 'toolbar-button is-active' : 'toolbar-button'
        }
        title="Code"
        type="button"
      >
        <Code className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={
          editor.isActive('bulletList')
            ? 'toolbar-button is-active'
            : 'toolbar-button'
        }
        title="Bullet List"
        type="button"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={
          editor.isActive('orderedList')
            ? 'toolbar-button is-active'
            : 'toolbar-button'
        }
        title="Numbered List"
        type="button"
      >
        <ListOrdered className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={
          editor.isActive('blockquote')
            ? 'toolbar-button is-active'
            : 'toolbar-button'
        }
        title="Blockquote"
        type="button"
      >
        <Quote className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="toolbar-button"
        title="Horizontal Rule"
        type="button"
      >
        <Minus className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        className="toolbar-button"
        title="Clear Formatting"
        type="button"
      >
        <RemoveFormatting className="w-4 h-4" />
      </button>

      {/* Variable Inserter */}
      {availableVariables.length > 0 && (
        <>
          <div className="toolbar-divider" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="toolbar-button" title="Insert Variable" type="button">
                <Variable className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              {availableVariables.map((variable) => (
                <DropdownMenuItem
                  key={variable.key}
                  onClick={() => insertVariable(`{{${variable.key}}}`)}
                  className="flex flex-col items-start py-2"
                >
                  <span className="font-mono text-sm text-primary">
                    {`{{${variable.key}}}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {variable.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
};

const extensions = [
  Color.configure({ types: [ListItem.name] }),
  StarterKit.configure({
    bulletList: {
      keepMarks: true,
      keepAttributes: false,
    },
    orderedList: {
      keepMarks: true,
      keepAttributes: false,
    },
  }),
];

interface EmailRichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  availableVariables?: EmailVariable[];
  placeholder?: string;
}

export function EmailRichTextEditor({
  content,
  onChange,
  availableVariables = [],
  placeholder,
}: EmailRichTextEditorProps) {
  return (
    <div className="tiptap-editor-wrapper">
      <EditorProvider
        slotBefore={<MenuBar availableVariables={availableVariables} />}
        extensions={extensions}
        content={content}
        onUpdate={({ editor }) => {
          onChange(editor.getHTML());
        }}
        editorProps={{
          attributes: {
            class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
            ...(placeholder && { 'data-placeholder': placeholder }),
          },
        }}
      />
    </div>
  );
}
