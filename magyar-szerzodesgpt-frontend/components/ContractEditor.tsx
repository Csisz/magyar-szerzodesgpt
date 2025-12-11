"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Paragraph from "@tiptap/extension-paragraph";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import { useEffect } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

export default function ContractEditor({ value, onChange }: Props) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
            paragraph: false, // kikapcsoljuk a duplázódást
        }),
        Paragraph.configure({
          HTMLAttributes: { class: "tiptap-block" },
        }),
        Underline,
        Link,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Bold,
        Italic,
      ],
      content: value || "<p></p>",
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      immediatelyRender: false, // NEXT.JS REQUIREMENTS
    },
    [] // fontos!
  );

  // Ha kívülről változik a value → frissítjük a modalt
  useEffect(() => {
    if (!editor) return;
    if (value && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 bg-slate-800 p-2 rounded border border-slate-700">

        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="px-2 py-1 bg-slate-700 rounded text-white"
        >
          B
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="px-2 py-1 bg-slate-700 rounded text-white"
        >
          I
        </button>

        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className="px-2 py-1 bg-slate-700 rounded text-white"
        >
          U
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className="px-2 py-1 bg-slate-700 rounded text-white"
        >
          ⬅
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className="px-2 py-1 bg-slate-700 rounded text-white"
        >
          ⬆
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className="px-2 py-1 bg-slate-700 rounded text-white"
        >
          ➡
        </button>
      </div>

      {/* TipTap editor */}
      <EditorContent
        editor={editor}
        className="min-h-[300px] max-h-[600px] overflow-auto bg-slate-900 border border-slate-700 rounded p-4 text-slate-100"
      />
    </div>
  );
}
