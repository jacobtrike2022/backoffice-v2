import './RichTextEditor.css';

import { Color } from '@tiptap/extension-color';
import ListItem from '@tiptap/extension-list-item';
import { EditorProvider, useCurrentEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React from 'react';
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
  WrapText,
  RemoveFormatting,
  FileCode
} from 'lucide-react';

const MenuBar = () => {
  const { editor } = useCurrentEditor();

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
      >
        <Undo className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="toolbar-button"
        title="Redo"
      >
        <Redo className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor.isActive('heading', { level: 1 }) ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive('heading', { level: 3 }) ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        className={editor.isActive('code') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Code"
      >
        <Code className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={editor.isActive('codeBlock') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Code Block"
      >
        <FileCode className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive('blockquote') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Blockquote"
      >
        <Quote className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="toolbar-button"
        title="Horizontal Rule"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setHardBreak().run()}
        className="toolbar-button"
        title="Hard Break"
      >
        <WrapText className="w-4 h-4" />
      </button>

      <div className="toolbar-divider" />

      <button
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        className="toolbar-button"
        title="Clear Formatting"
      >
        <RemoveFormatting className="w-4 h-4" />
      </button>
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

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  console.log('🎨 RichTextEditor - Rendering with content length:', content?.length || 0);

  return (
    <div className="tiptap-editor-wrapper">
      <EditorProvider
        slotBefore={<MenuBar />}
        extensions={extensions}
        content={content}
        onUpdate={({ editor }) => {
          onChange(editor.getHTML());
        }}
      />
    </div>
  );
}