import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile as uploadFileUtil } from "@/lib/imageUpload";
import { toast } from "sonner";
import {
  Bold, Italic, Underline, Link, Image, Paperclip, List, ListOrdered,
  Code, X, FileText, Eye, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Strikethrough, Quote, Minus, Table, Heading1, Heading2, Heading3,
  Palette, Type, Undo, Redo, Subscript, Superscript, RemoveFormatting
} from "lucide-react";
import DOMPurify from "dompurify";

type Attachment = {
  name: string;
  url: string;
  type: string;
  size: number;
};

type RichMessageComposerProps = {
  value: string;
  onChange: (val: string) => void;
  isHtml: boolean;
  onIsHtmlChange: (val: boolean) => void;
  attachments: Attachment[];
  onAttachmentsChange: (att: Attachment[]) => void;
  placeholder?: string;
  maxLength?: number;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const FONT_SIZES = [
  { label: "Small", value: "1" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
  { label: "X-Large", value: "7" },
];

const TEXT_COLORS = [
  "#000000", "#374151", "#6B7280", "#DC2626", "#EA580C",
  "#D97706", "#16A34A", "#0891B2", "#2563EB", "#7C3AED",
  "#DB2777", "#FFFFFF",
];

const BG_COLORS = [
  "transparent", "#FEF2F2", "#FFF7ED", "#FEFCE8", "#F0FDF4",
  "#ECFEFF", "#EFF6FF", "#F5F3FF", "#FDF2F8", "#F3F4F6",
  "#FEE2E2", "#DBEAFE",
];

const RichMessageComposer = ({
  value,
  onChange,
  isHtml,
  onIsHtmlChange,
  attachments,
  onAttachmentsChange,
  placeholder = "Type your message…",
  maxLength = 10000,
}: RichMessageComposerProps) => {
  const [uploading, setUploading] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "html" | "preview">("visual");
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const execCommand = (command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    syncContent();
  };

  const syncContent = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html);
      if (!isHtml && html !== value) {
        onIsHtmlChange(true);
      }
    }
  }, [onChange, isHtml, onIsHtmlChange, value]);

  const handleInsertLink = () => {
    const url = prompt("Enter URL:");
    if (url) execCommand("createLink", url);
  };

  const insertTable = () => {
    const rows = prompt("Number of rows:", "3");
    const cols = prompt("Number of columns:", "3");
    if (!rows || !cols) return;
    const r = parseInt(rows), c = parseInt(cols);
    if (isNaN(r) || isNaN(c) || r < 1 || c < 1) return;
    let html = '<table style="width:100%;border-collapse:collapse;margin:8px 0;"><tbody>';
    for (let i = 0; i < r; i++) {
      html += "<tr>";
      for (let j = 0; j < c; j++) {
        html += '<td style="border:1px solid #d1d5db;padding:6px 8px;min-width:40px;">&nbsp;</td>';
      }
      html += "</tr>";
    }
    html += "</tbody></table><p>&nbsp;</p>";
    execCommand("insertHTML", html);
  };

  const insertCodeBlock = () => {
    execCommand("insertHTML", '<pre style="background:#1f2937;color:#e5e7eb;padding:12px 16px;border-radius:6px;font-family:monospace;font-size:13px;overflow-x:auto;margin:8px 0;"><code>// your code here</code></pre><p>&nbsp;</p>');
  };

  const insertBlockquote = () => {
    execCommand("insertHTML", '<blockquote style="border-left:4px solid hsl(var(--primary));padding:8px 16px;margin:8px 0;background:hsl(var(--muted));border-radius:0 4px 4px 0;font-style:italic;">Quote text here</blockquote><p>&nbsp;</p>');
  };

  const insertHeading = (level: number) => {
    const sizes: Record<number, string> = { 1: "28px", 2: "22px", 3: "18px" };
    execCommand("insertHTML", `<h${level} style="font-size:${sizes[level]};font-weight:bold;margin:8px 0;">\u200B</h${level}>`);
  };

  const uploadFile = async (file: File, bucket: string): Promise<string | null> => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File "${file.name}" exceeds 5MB limit`);
      return null;
    }
    try {
      const url = await uploadFileUtil({ bucket, folder: "", file });
      return url;
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" is not an image`);
        continue;
      }
      const url = await uploadFile(file, "admin-attachments");
      if (url && editorRef.current) {
        execCommand("insertHTML", `<img src="${url}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`);
      }
    }
    setUploading(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadFile(file, "admin-attachments");
      if (url) {
        newAttachments.push({ name: file.name, url, type: file.type, size: file.size });
      }
    }
    onAttachmentsChange([...attachments, ...newAttachments]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const ToolbarButton = ({ onClick, title, children, className = "" }: { onClick: () => void; title: string; children: React.ReactNode; className?: string }) => (
    <Button type="button" size="sm" variant="ghost" className={`h-7 w-7 p-0 ${className}`} onClick={onClick} title={title}>
      {children}
    </Button>
  );

  const ToolbarDivider = () => <div className="mx-0.5 h-5 w-px bg-border" />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Message</Label>
        <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as any)}>
          <TabsList className="h-7">
            <TabsTrigger value="visual" className="text-xs px-2 py-0.5 gap-1">
              <FileText className="h-3 w-3" /> Visual
            </TabsTrigger>
            <TabsTrigger value="html" className="text-xs px-2 py-0.5 gap-1">
              <Code className="h-3 w-3" /> HTML
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs px-2 py-0.5 gap-1">
              <Eye className="h-3 w-3" /> Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Enhanced Toolbar */}
      {editorMode === "visual" && (
        <div className="rounded-t-md border border-b-0 border-border bg-muted/50 p-1 space-y-1">
          {/* Row 1: Text formatting */}
          <div className="flex flex-wrap items-center gap-0.5">
            <ToolbarButton onClick={() => execCommand("undo")} title="Undo"><Undo className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("redo")} title="Redo"><Redo className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton onClick={() => execCommand("bold")} title="Bold"><Bold className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("italic")} title="Italic"><Italic className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("underline")} title="Underline"><Underline className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("strikeThrough")} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("subscript")} title="Subscript"><Subscript className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("superscript")} title="Superscript"><Superscript className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarDivider />

            {/* Font Size */}
            <Select onValueChange={(v) => execCommand("fontSize", v)}>
              <SelectTrigger className="h-7 w-[90px] text-xs">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map(s => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ToolbarDivider />

            {/* Text Color */}
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" title="Text Color">
                  <Type className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <p className="text-xs font-medium mb-1 text-muted-foreground">Text Color</p>
                <div className="grid grid-cols-6 gap-1">
                  {TEXT_COLORS.map(color => (
                    <button
                      key={color}
                      className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => execCommand("foreColor", color)}
                      title={color}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Highlight / Background Color */}
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" title="Highlight Color">
                  <Palette className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <p className="text-xs font-medium mb-1 text-muted-foreground">Highlight</p>
                <div className="grid grid-cols-6 gap-1">
                  {BG_COLORS.map(color => (
                    <button
                      key={color}
                      className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color === "transparent" ? "#fff" : color }}
                      onClick={() => execCommand("hiliteColor", color)}
                      title={color === "transparent" ? "None" : color}
                    >
                      {color === "transparent" && <X className="h-3 w-3 mx-auto text-muted-foreground" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <ToolbarButton onClick={() => execCommand("removeFormat")} title="Clear Formatting"><RemoveFormatting className="h-3.5 w-3.5" /></ToolbarButton>
          </div>

          {/* Row 2: Structure & media */}
          <div className="flex flex-wrap items-center gap-0.5">
            <ToolbarButton onClick={() => insertHeading(1)} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => insertHeading(2)} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => insertHeading(3)} title="Heading 3"><Heading3 className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton onClick={() => execCommand("justifyLeft")} title="Align Left"><AlignLeft className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("justifyCenter")} title="Align Center"><AlignCenter className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("justifyRight")} title="Align Right"><AlignRight className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("justifyFull")} title="Justify"><AlignJustify className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton onClick={() => execCommand("insertUnorderedList")} title="Bullet List"><List className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("insertOrderedList")} title="Numbered List"><ListOrdered className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton onClick={insertBlockquote} title="Blockquote"><Quote className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={insertCodeBlock} title="Code Block"><Code className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => execCommand("insertHorizontalRule")} title="Horizontal Line"><Minus className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={insertTable} title="Insert Table"><Table className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton onClick={handleInsertLink} title="Insert Link"><Link className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => imageInputRef.current?.click()} title="Insert Image"><Image className="h-3.5 w-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Attach File"><Paperclip className="h-3.5 w-3.5" /></ToolbarButton>
            {uploading && <span className="ml-2 text-xs text-muted-foreground animate-pulse">Uploading…</span>}
          </div>
        </div>
      )}

      {/* Visual Editor */}
      {editorMode === "visual" && (
        <div
          ref={editorRef}
          contentEditable
          className="min-h-[200px] max-h-[400px] overflow-auto rounded-b-md border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none"
          onInput={syncContent}
          onBlur={syncContent}
          dangerouslySetInnerHTML={{ __html: value }}
          data-placeholder={placeholder}
          style={{ wordBreak: "break-word" }}
        />
      )}

      {/* HTML Source Editor */}
      {editorMode === "html" && (
        <textarea
          className="min-h-[200px] max-h-[400px] w-full rounded-md border border-border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onIsHtmlChange(true);
          }}
          placeholder="Write HTML here…"
          maxLength={maxLength}
        />
      )}

      {/* Preview */}
      {editorMode === "preview" && (
        <div className="min-h-[200px] max-h-[400px] overflow-auto rounded-md border border-border bg-muted/30 p-3">
          {value ? (
            <div
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}
            />
          ) : (
            <p className="text-muted-foreground text-sm italic">Nothing to preview</p>
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleAttachmentUpload} />

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Attachments ({attachments.length})</Label>
          <div className="space-y-1">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline flex-1">
                  {att.name}
                </a>
                <span className="text-muted-foreground shrink-0">{formatFileSize(att.size)}</span>
                <Button type="button" size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeAttachment(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RichMessageComposer;
