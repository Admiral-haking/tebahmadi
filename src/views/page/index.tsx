import { Container, Paper, Stack, Typography, Box } from "@mui/material";
import type { PageDocument } from "@/content/models/Page";

type SerializableDate = Date | string | null | undefined;

type PageViewProps = {
  page: Pick<PageDocument, "title" | "content" | "publishedAt" | "updatedAt"> & {
    createdAt?: SerializableDate;
  };
  jsonLd?: unknown;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "long",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "long",
  timeStyle: "short",
});

function toDate(value: SerializableDate): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function formatDate(value: SerializableDate, withTime = false): string | null {
  const date = toDate(value);
  if (!date) return null;
  return withTime ? TIME_FORMATTER.format(date) : DATE_FORMATTER.format(date);
}

const proseStyles = {
  "& > *": {
    marginBlock: 0,
  },
  "& > * + *": {
    marginBlockStart: { xs: 2, md: 3 },
  },
  "& h1": {
    fontSize: { xs: "2rem", md: "2.5rem" },
    fontWeight: 700,
  },
  "& h2": {
    fontSize: { xs: "1.75rem", md: "2rem" },
    fontWeight: 600,
  },
  "& h3": {
    fontSize: { xs: "1.5rem", md: "1.75rem" },
    fontWeight: 600,
  },
  "& h4, & h5, & h6": {
    fontWeight: 600,
  },
  "& p": {
    lineHeight: 1.9,
    fontSize: { xs: "1rem", md: "1.05rem" },
  },
  "& ul, & ol": {
    paddingInlineStart: { xs: 3, md: 4 },
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  "& li": {
    lineHeight: 1.9,
  },
  "& blockquote": {
    paddingInlineStart: 3,
    borderInlineStart: "4px solid rgba(var(--mui-palette-common-backgroundChannel) / 0.12)",
    fontStyle: "italic",
    color: "text.secondary",
  },
  "& a": {
    color: "primary.main",
    textDecoration: "underline",
    textUnderlineOffset: "0.35em",
  },
  "& img": {
    maxWidth: "100%",
    borderRadius: 2,
    boxShadow: 1,
  },
  "& code": {
    fontFamily: "'JetBrains Mono', monospace",
    padding: "2px 6px",
    borderRadius: 1,
    backgroundColor: "rgba(var(--mui-palette-common-backgroundChannel) / 0.08)",
    fontSize: "0.875rem",
  },
  "& pre": {
    padding: 3,
    borderRadius: 2,
    overflowX: "auto",
    backgroundColor: "grey.900",
    color: "common.white",
    fontSize: "0.9rem",
    "& code": {
      padding: 0,
      backgroundColor: "transparent",
      display: "block",
    },
  },
  "& hr": {
    border: "none",
    borderBottom: "1px solid",
    borderColor: "divider",
  },
} as const;

function serializeJsonLd(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export default function PageView({ page, jsonLd }: PageViewProps) {
  const publishedLabel = formatDate(page.publishedAt);
  const updatedLabel = formatDate(page.updatedAt, true);
  const createdLabel = formatDate(page.createdAt);
  const serializedJsonLd = serializeJsonLd(jsonLd);

  return (
    <Container component="article" maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography component="h1" variant="h3" fontWeight={800}>
            {page.title}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 2 }}>
            {publishedLabel && (
              <Typography variant="body2" color="text.secondary">
                تاریخ انتشار: {publishedLabel}
              </Typography>
            )}
            {updatedLabel && (
              <Typography variant="body2" color="text.secondary">
                آخرین بروزرسانی: {updatedLabel}
              </Typography>
            )}
            {!publishedLabel && createdLabel && (
              <Typography variant="body2" color="text.secondary">
                ایجاد شده در: {createdLabel}
              </Typography>
            )}
          </Stack>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            px: { xs: 2.5, md: 4 },
            py: { xs: 3, md: 5 },
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            backgroundImage: "none",
          }}
        >
          <Box sx={proseStyles} dangerouslySetInnerHTML={{ __html: page.content ?? "" }} />
        </Paper>
      </Stack>
      {serializedJsonLd && (
        <Box
          component="script"
          type="application/ld+json"
          sx={{ display: "none" }}
          dangerouslySetInnerHTML={{ __html: serializedJsonLd }}
        />
      )}
    </Container>
  );
}
