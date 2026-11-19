import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { styled } from "@mui/material/styles";

type CodeBlockViewProps = {
  extension: { options: { lowlight: { listLanguages: () => string[] } } };
  updateAttributes: (attributes: Record<string, unknown>) => void;
  node: {
    attrs: {
      language?: string;
    };
  };
};

const StyledNodeViewWrapper = styled(NodeViewWrapper)(({ theme }) => ({
  position: "relative",
  padding: theme.spacing(0, 2, 2),
  "& pre": {
    margin: 0,
    overflowX: "auto",
    borderRadius: theme.shape.borderRadius,
    backgroundColor: "var(--mui-palette-grey-900)",
    color: "var(--mui-palette-common-white)",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: theme.typography.body2.fontSize,
    padding: theme.spacing(4, 3, 3),
    "& code": {
      fontFamily: "inherit",
      display: "block",
      "& .hljs-comment": { color: "#999" },
      "& .hljs-tag": { color: "#b4b7b4" },
      "& .hljs-operator, & .hljs-punctuation, & .hljs-subst": { color: "#ccc" },
      "& .hljs-operator": { opacity: 0.7 },
      "& .hljs-bullet, & .hljs-deletion, & .hljs-name, & .hljs-selector-tag, & .hljs-template-variable, & .hljs-variable":
      {
        color: "#f2777a",
      },
      "& .hljs-attr, & .hljs-link, & .hljs-literal, & .hljs-number, & .hljs-symbol, & .hljs-variable.constant_":
      {
        color: "#f99157",
      },
      "& .hljs-class .hljs-title, & .hljs-title, & .hljs-title.class_": { color: "#ffcc66" },
      "& .hljs-strong": { color: "#ffcc66", fontWeight: 700 },
      "& .hljs-addition, & .hljs-code, & .hljs-string, & .hljs-title.class_.inherited__": {
        color: "#99cc99",
      },
      "& .hljs-built_in, & .hljs-doctag, & .hljs-keyword.hljs-atrule, & .hljs-quote, & .hljs-regexp":
      {
        color: "#66cccc",
      },
      "& .hljs-attribute, & .hljs-function .hljs-title, & .hljs-section, & .hljs-title.function_, & .ruby .hljs-property":
      {
        color: "#6699cc",
      },
      "& .diff .hljs-meta, & .hljs-keyword, & .hljs-template-tag, & .hljs-type": { color: "#cc99cc" },
      "& .hljs-emphasis": { color: "#cc99cc", fontStyle: "italic" },
      "& .hljs-meta, & .hljs-meta .hljs-keyword, & .hljs-meta .hljs-string": { color: "#a3685a" },
      "& .hljs-meta .hljs-keyword, & .hljs-meta-keyword": { fontWeight: 700 },
    },
  },
}));

const LanguageSelect = styled("select")(({ theme }) => ({
  top: theme.spacing(1),
  right: theme.spacing(1),
  zIndex: 1,
  padding: theme.spacing(0.5),
  outline: "none",
  borderRadius: Number(theme.shape.borderRadius) / 2,
  position: "absolute",
  color: "var(--mui-palette-common-white)",
  backgroundColor: "rgba(var(--mui-palette-common-backgroundChannel) / 0.08)",
  border: `1px solid rgba(var(--mui-palette-common-backgroundChannel) / 0.16)`,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
}));

export function CodeBlockView({ extension, node, updateAttributes }: CodeBlockViewProps) {
  const currentLanguage = node.attrs.language ?? "null";
  const languages = extension.options.lowlight.listLanguages();

  return (
    <StyledNodeViewWrapper>
      <LanguageSelect
        name="language"
        contentEditable={false}
        defaultValue={currentLanguage}
        onChange={(event) => updateAttributes({ language: event.target.value })}
      >
        <option value="null">auto</option>
        <option disabled>—</option>
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </LanguageSelect>

      <pre>
        <NodeViewContent as="code" />
      </pre>
    </StyledNodeViewWrapper>
  );
}
