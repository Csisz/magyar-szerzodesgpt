"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

type ContractEditorProps = {
  value: string;
  onChange: (html: string) => void;
};

export default function ContractEditor({
  value,
  onChange,
}: ContractEditorProps) {
  const editor = useEditor({
    immediatelyRender: false, // 👈 EZ A MEGOLDÁS

    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: "Kezdd el szerkeszteni a szerződést…",
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none focus:outline-none min-h-[420px]",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });


  // Ha kívülről változik a value (pl. első megnyitáskor)
  useEffect(() => {
    if (!editor) return;
    if (value && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 p-2">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={16} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 size={16} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 size={16} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 size={16} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
        >
          <ListOrdered size={16} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          active={editor.isActive({ textAlign: "left" })}
          onClick={() =>
            editor.chain().focus().setTextAlign("left").run()
          }
        >
          <AlignLeft size={16} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive({ textAlign: "center" })}
          onClick={() =>
            editor.chain().focus().setTextAlign("center").run()
          }
        >
          <AlignCenter size={16} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive({ textAlign: "right" })}
          onClick={() =>
            editor.chain().focus().setTextAlign("right").run()
          }
        >
          <AlignRight size={16} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo size={16} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo size={16} />
        </ToolbarButton>
      </div>

      {/* EDITOR */}
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/* ====== KIS SEGÉD KOMPONENSEK ====== */

function ToolbarButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onClick}
      className={cn(
        "h-8 w-8",
        active && "bg-slate-700 text-white"
      )}
    >
      {children}
    </Button>
  );
}

function Separator() {
  return <div className="mx-1 h-5 w-px bg-slate-700" />;
}
