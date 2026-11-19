"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Backdrop from "@mui/material/Backdrop";
import Portal from "@mui/material/Portal";
import Typography from "@mui/material/Typography";
import FormHelperText from "@mui/material/FormHelperText";
import { styled } from "@mui/material/styles";

import { EditorToolbar } from "./EditorToolbar";
import { CodeBlockView } from "./CodeBlockView";

export type EditorProps = {
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  helperText?: ReactNode;
  error?: boolean;
  disabled?: boolean;
  minHeight?: number;
  label?: ReactNode;
};

const EMPTY_PARAGRAPH = "<p></p>";

type SurfaceProps = {
  error?: boolean;
  fullScreen?: boolean;
  disabled?: boolean;
  focused?: boolean;
};

type ContentProps = {
  minHeight: number;
  disabled?: boolean;
};

const Surface = styled(Paper, {
  shouldForwardProp: (prop) => !["error", "fullScreen", "disabled", "focused"].includes(String(prop)),
})<SurfaceProps>(({ theme, error, fullScreen, disabled, focused }) => ({
  display: "flex",
  flexDirection: "column",
  borderRadius: Number(theme.shape.borderRadius) * 1.25,
  border: `1px solid ${error ? "var(--mui-palette-error-main)" : `rgba(var(--mui-palette-text-primaryChannel) / ${focused ? 0.45 : 0.16})`
    }`,
  boxShadow: focused ? theme.shadows[8] : theme.shadows[1],
  overflow: "hidden",
  background: disabled
    ? "var(--mui-palette-action-disabledBackground)"
    : "var(--mui-palette-background-paper)",
  transition: theme.transitions.create(["box-shadow", "border-color"], {
    duration: theme.transitions.duration.shorter,
  }),
  ...(fullScreen && {
    position: "fixed",
    inset: theme.spacing(3),
    margin: "auto",
    width: `calc(100% - ${theme.spacing(6)})`,
    height: `calc(100% - ${theme.spacing(6)})`,
    maxWidth: "min(1200px, 100%)",
    maxHeight: `calc(100% - ${theme.spacing(6)})`,
    zIndex: theme.zIndex.modal + 1,
  }),
}));

const Content = styled(Box, {
  shouldForwardProp: (prop) => prop !== "minHeight" && prop !== "disabled",
})<ContentProps>(({ theme, minHeight, disabled }) => ({
  flex: "1 1 auto",
  minHeight,
  overflowY: "auto",
  padding: theme.spacing(2.25, 2.75),
  backgroundColor: disabled
    ? "var(--mui-palette-action-disabledBackground)"
    : "rgba(var(--mui-palette-primary-mainChannel) / 0.04)",
  borderTop: `1px solid rgba(var(--mui-palette-text-primaryChannel) / 0.08)`,
  "& .tiptap": {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    flex: "1 1 auto",
    color: "var(--mui-palette-text-primary)",
  },
  "& .ProseMirror": {
    outline: "none",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    lineHeight: 1.7,
    fontSize: theme.typography.body1.fontSize,
    "& p": { margin: 0 },
    "& h1, & h2, & h3, & h4, & h5, & h6": {
      margin: 0,
      fontWeight: theme.typography.fontWeightBold,
      color: "var(--mui-palette-text-primary)",
    },
    "& h1": { ...theme.typography.h4 },
    "& h2": { ...theme.typography.h5 },
    "& h3": { ...theme.typography.h6 },
    "& h4": { ...theme.typography.subtitle1 },
    "& h5": { ...theme.typography.subtitle2 },
    "& h6": { ...theme.typography.body1, textTransform: "uppercase", letterSpacing: 0.5 },
    "& blockquote": {
      margin: 0,
      paddingLeft: theme.spacing(3),
      borderLeft: `4px solid rgba(var(--mui-palette-primary-mainChannel) / 0.3)`,
      color: "var(--mui-palette-text-secondary)",
      fontStyle: "italic",
    },
    "& ul, & ol": {
      paddingLeft: theme.spacing(4),
      margin: 0,
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1),
    },
    "& a": {
      color: "var(--mui-palette-primary-main)",
      textDecoration: "underline",
      textDecorationThickness: 2,
      textUnderlineOffset: 4,
    },
    "& code": {
      fontFamily: "'JetBrains Mono', monospace",
      padding: theme.spacing(0.25, 0.5),
      borderRadius: Number(theme.shape.borderRadius) / 2,
      backgroundColor: `rgba(var(--mui-palette-text-primaryChannel) / 0.08)`,
    },
    "& img": {
      maxWidth: "100%",
      borderRadius: theme.shape.borderRadius,
      boxShadow: theme.shadows[2],
    },
    "& hr": {
      border: "none",
      borderBottom: `1px solid rgba(var(--mui-palette-text-primaryChannel) / 0.08)`,
      margin: theme.spacing(2, 0),
    },
  },
  "& .ProseMirror p.is-editor-empty:first-of-type::before": {
    color: "var(--mui-palette-text-disabled)",
    content: "attr(data-placeholder)",
    pointerEvents: "none",
    height: 0,
  },
}));

export function Editor({
  value,
  onChange,
  onBlur,
  placeholder,
  helperText,
  error,
  disabled,
  minHeight = 240,
  label,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const lowlight = useMemo(() => createLowlight(common), []);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Write something brilliant...",
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView as any);
        },
      }).configure({ lowlight }),
    ],
    [lowlight, placeholder],
  );

  const editor = useEditor({
    editable: !disabled,
    content: value ?? EMPTY_PARAGRAPH,
    extensions,
    onUpdate({ editor: instance }) {
      const html = instance.getHTML();
      onChange?.(html);
    },
    onFocus() {
      setIsFocused(true);
    },
    onBlur() {
      setIsFocused(false);
      onBlur?.();
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const next = value ?? EMPTY_PARAGRAPH;
    const current = editor.getHTML();
    if (next === current) {
      return;
    }
    if (!next && editor.isEmpty) {
      return;
    }
    editor.commands.setContent(next, false);
  }, [value, editor]);

  useEffect(() => {
    if (!fullScreen) {
      document.body.style.overflow = "";
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullScreen]);

  const toggleFullScreen = useCallback(() => {
    setFullScreen((prev) => !prev);
  }, []);

  if (!editor) {
    return null;
  }

  const editorSurface = (
    <>
      {fullScreen && (
        <Backdrop
          open
          sx={{
            zIndex: (theme) => theme.zIndex.modal,
            backdropFilter: "blur(3px)",
            bgcolor: "rgba(var(--mui-palette-common-onBackgroundChannel) / 0.45)",
          }}
        />
      )}

      <Surface error={error} fullScreen={fullScreen} disabled={disabled} focused={isFocused}>
        <EditorToolbar
          editor={editor}
          disabled={disabled}
          fullScreen={fullScreen}
          onToggleFullScreen={toggleFullScreen}
        />

        <Content minHeight={minHeight} disabled={disabled}>
          <EditorContent
            editor={editor}
            className="tiptap"
            spellCheck="false"
            autoComplete="off"
            autoCapitalize="off"
            aria-label={typeof label === "string" ? label : undefined}
          />
        </Content>
      </Surface>
    </>
  );

  return (
    <Stack gap={1.25}>
      {label && (
        <Typography variant="subtitle2" color={error ? "error" : "text.secondary"}>
          {label}
        </Typography>
      )}

      <Box ref={containerRef} sx={{ position: "relative" }}>
        {fullScreen ? <Portal>{editorSurface}</Portal> : editorSurface}
      </Box>

      {helperText && (
        <FormHelperText error={error} sx={{ margin: 0 }}>
          {helperText}
        </FormHelperText>
      )}
    </Stack>
  );
}
