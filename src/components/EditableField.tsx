import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  displayClassName?: string;
  emptyText?: string;
}

export function EditableField({
  value,
  onSave,
  label,
  placeholder = "Enter text...",
  multiline = false,
  className,
  displayClassName,
  emptyText = "Click to add...",
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      if ('setSelectionRange' in inputRef.current) {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (draft === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch (err) {
      console.error("[EditableField] Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Enter" && e.metaKey && multiline) {
      e.preventDefault();
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <label className="text-sm font-medium text-muted-foreground">
            {label}
          </label>
        )}
        <div className="flex gap-2">
          {multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 min-h-[100px] bg-zinc-900 border-zinc-700"
              disabled={isSaving}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 bg-zinc-900 border-zinc-700"
              disabled={isSaving}
            />
          )}
          <div className="flex flex-col gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
              className="h-8 w-8 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {multiline && (
          <p className="text-xs text-muted-foreground">
            Press Cmd+Enter to save, Escape to cancel
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("group", className)}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground block mb-1">
          {label}
        </label>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsEditing(true);
          }
        }}
        className={cn(
          "relative cursor-pointer rounded-lg p-3 transition-colors",
          "border border-transparent hover:border-zinc-700 hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
          displayClassName
        )}
      >
        {value ? (
          <p className="text-foreground whitespace-pre-wrap pr-8">{value}</p>
        ) : (
          <p className="text-muted-foreground italic pr-8">{emptyText}</p>
        )}
        <div className="absolute top-2 right-2 p-1 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/50 rounded">
          <Pencil className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}
