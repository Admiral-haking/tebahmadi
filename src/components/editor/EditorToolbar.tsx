import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";

import Stack from "@mui/material/Stack";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { styled } from "@mui/material/styles";

import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatAlignJustifyIcon from "@mui/icons-material/FormatAlignJustify";
import CodeIcon from "@mui/icons-material/Code";
import TerminalIcon from "@mui/icons-material/Terminal";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ImageIcon from "@mui/icons-material/Image";
import KeyboardReturnIcon from "@mui/icons-material/KeyboardReturn";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import TextFieldsIcon from "@mui/icons-material/TextFields";

import { LinkDialog } from "./LinkDialog";
import { ImageDialog } from "./ImageDialog";

type EditorToolbarProps = {
  editor: Editor | null;
  disabled?: boolean;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
};

type ToolbarButtonProps = {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
};

const ToolbarRoot = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1),
  padding: theme.spacing(1.25, 1.5),
  flexWrap: "wrap",
  alignItems: "center",
  borderBottom: `1px solid var(--mui-palette-divider)`,
  backgroundColor: "var(--mui-palette-background-paper)",
  borderTopLeftRadius: theme.shape.borderRadius,
  borderTopRightRadius: theme.shape.borderRadius,
}));

const ToolbarIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ theme, active }) => ({
  width: 32,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  color: active ? "var(--mui-palette-primary-main)" : "var(--mui-palette-text-primary)",
  backgroundColor: active ? "rgba(var(--mui-palette-primary-mainChannel) / 0.12)" : "transparent",
  "&:hover": {
    backgroundColor: active
      ? "rgba(var(--mui-palette-primary-mainChannel) / 0.24)"
      : "rgba(var(--mui-palette-text-primaryChannel) / 0.08)",
  },
}));

const HeadingButton = styled(Button)(({ theme }) => ({
  minWidth: 120,
  height: 32,
  justifyContent: "space-between",
  textTransform: "none",
  borderRadius: theme.shape.borderRadius,
  border: `1px solid rgba(var(--mui-palette-text-primaryChannel) / 0.12)`,
}));

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

function ToolbarButton({ title, icon, onClick, disabled, active }: ToolbarButtonProps) {
  return (
    <Tooltip title={title}>
      <span>
        <ToolbarIconButton
          onClick={onClick}
          disabled={disabled}
          color={active ? "primary" : "default"}
          active={active}
          size="small"
        >
          {icon}
        </ToolbarIconButton>
      </span>
    </Tooltip>
  );
}

export function EditorToolbar({ editor, disabled, fullScreen, onToggleFullScreen }: EditorToolbarProps) {
  const [headingAnchor, setHeadingAnchor] = useState<null | HTMLElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const controlsDisabled = disabled || !editor?.isEditable;

  const currentHeadingLabel = useMemo(() => {
    if (!editor) {
      return "Paragraph";
    }
    const activeLevel = HEADING_LEVELS.find((level) => editor.isActive("heading", { level }));
    return activeLevel ? `Heading ${activeLevel}` : "Paragraph";
  }, [editor]);

  if (!editor) {
    return null;
  }

  const canUndo = controlsDisabled ? false : editor.can().chain().focus().undo().run();
  const canRedo = controlsDisabled ? false : editor.can().chain().focus().redo().run();
  const isLinkActive = editor.isActive("link");

  const handleApplyLink = (url: string) => {
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkDialogOpen(false);
  };

  const handleInsertImage = ({ src, alt }: { src: string; alt?: string }) => {
    if (!src) return;
    editor.chain().focus().setImage({ src, alt }).run();
    setImageDialogOpen(false);
  };

  const handleHeadingSelect = (level?: any) => {
    if (!editor) return;
    if (!level) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
    setHeadingAnchor(null);
  };

  const headingButtonDisabled = controlsDisabled;

  return (
    <>
      <ToolbarRoot direction="row">
        <HeadingButton
          size="small"
          disabled={headingButtonDisabled}
          endIcon={<TextFieldsIcon fontSize="small" />}
          onClick={(event) => setHeadingAnchor(event.currentTarget)}
        >
          <Typography variant="body2" fontWeight={500}>
            {currentHeadingLabel}
          </Typography>
        </HeadingButton>

        <Divider orientation="vertical" flexItem />

        <Stack direction="row" spacing={0.5}>
          <ToolbarButton
            title="Bold"
            icon={<FormatBoldIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            title="Italic"
            icon={<FormatItalicIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            title="Strike"
            icon={<StrikethroughSIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <ToolbarButton
            title="Inline code"
            icon={<CodeIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          />
        </Stack>

        <Divider orientation="vertical" flexItem />

        <Stack direction="row" spacing={0.5}>
          <ToolbarButton
            title="Bullet list"
            icon={<FormatListBulletedIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            title="Numbered list"
            icon={<FormatListNumberedIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            title="Blockquote"
            icon={<FormatQuoteIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            title="Horizontal rule"
            icon={<HorizontalRuleIcon fontSize="small" />}
            disabled={controlsDisabled}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
        </Stack>

        <Divider orientation="vertical" flexItem />

        <Stack direction="row" spacing={0.5}>
          <ToolbarButton
            title="Align left"
            icon={<FormatAlignLeftIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          />
          <ToolbarButton
            title="Align center"
            icon={<FormatAlignCenterIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          />
          <ToolbarButton
            title="Align right"
            icon={<FormatAlignRightIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          />
          <ToolbarButton
            title="Justify"
            icon={<FormatAlignJustifyIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          />
        </Stack>

        <Divider orientation="vertical" flexItem />

        <Stack direction="row" spacing={0.5}>
          <ToolbarButton
            title="Code block"
            icon={<TerminalIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
          <ToolbarButton
            title="Hard break"
            icon={<KeyboardReturnIcon fontSize="small" />}
            disabled={controlsDisabled}
            onClick={() => editor.chain().focus().setHardBreak().run()}
          />
          <ToolbarButton
            title="Clear formatting"
            icon={<FormatClearIcon fontSize="small" />}
            disabled={controlsDisabled}
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          />
        </Stack>

        <Divider orientation="vertical" flexItem />

        <Stack direction="row" spacing={0.5}>
          <ToolbarButton
            title="Add link"
            icon={<LinkIcon fontSize="small" />}
            disabled={controlsDisabled}
            active={isLinkActive}
            onClick={() => setLinkDialogOpen(true)}
          />
          <ToolbarButton
            title="Remove link"
            icon={<LinkOffIcon fontSize="small" />}
            disabled={controlsDisabled || !isLinkActive}
            onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
          />
          <ToolbarButton
            title="Insert image"
            icon={<ImageIcon fontSize="small" />}
            disabled={controlsDisabled}
            onClick={() => setImageDialogOpen(true)}
          />
        </Stack>

        <Divider orientation="vertical" flexItem />

        <Stack direction="row" spacing={0.5}>
          <ToolbarButton
            title="Undo"
            icon={<UndoIcon fontSize="small" />}
            disabled={controlsDisabled || !canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            title="Redo"
            icon={<RedoIcon fontSize="small" />}
            disabled={controlsDisabled || !canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          />
          <ToolbarButton
            title={fullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            icon={
              fullScreen ? (
                <FullscreenExitIcon fontSize="small" />
              ) : (
                <FullscreenIcon fontSize="small" />
              )
            }
            onClick={onToggleFullScreen}
          />
        </Stack>
      </ToolbarRoot>

      <Menu
        anchorEl={headingAnchor}
        open={Boolean(headingAnchor)}
        onClose={() => setHeadingAnchor(null)}
      >
        <MenuItem
          onClick={() => handleHeadingSelect(undefined)}
          selected={editor.isActive("paragraph")}
        >
          Paragraph
        </MenuItem>
        {HEADING_LEVELS.map((level) => (
          <MenuItem
            key={level}
            onClick={() => handleHeadingSelect(level)}
            selected={editor.isActive("heading", { level })}
          >
            <Typography variant="body2" fontWeight={600 - level * 20}>
              Heading {level}
            </Typography>
          </MenuItem>
        ))}
      </Menu>

      <LinkDialog
        open={linkDialogOpen && !disabled}
        initialUrl={isLinkActive ? editor.getAttributes("link").href : ""}
        onClose={() => setLinkDialogOpen(false)}
        onSubmit={handleApplyLink}
      />

      <ImageDialog
        open={imageDialogOpen && !disabled}
        onClose={() => setImageDialogOpen(false)}
        onSubmit={handleInsertImage}
      />
    </>
  );
}
