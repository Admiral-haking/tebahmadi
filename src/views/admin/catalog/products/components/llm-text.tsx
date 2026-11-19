import * as React from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  InputAdornment,
  CircularProgress,
  Stack,
  Typography,
  Paper,
  Chip,
  Button,
  Tooltip,
  Collapse,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputBase,
  useTheme,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { SYSTEM_PRODUCT_PROMPT } from "../constants/product-propmt";
import { ShinyText } from "@/components/react-bits/shiny";
import { useFormContext } from "react-hook-form";
import { useEasyLLM } from "easy-llm-call/react";
import { toast } from "sonner";
import z from "zod";
import CodeBlock from "@/components/code";
import ReactMarkdown from "react-markdown";
import { FuzzyText } from "@/components/react-bits";
import ProductLLMRender from "./llm-product-render";
import { ImageUploader } from "@/components/image-uploader";
import useLocalStorage from "@/hooks/use-localStorage";

export type AIProductChatDialogProps = {
  categories: any[];
  productTypes: any[];
  onTypeUpdate: (obj: any) => any | Promise<null | string>;
  open?: boolean;
  onClose?: () => void;
  title?: string;
  formError?: string | null;
  createEmptyVariant: VoidFunction;
  schema: z.ZodObject;
  append: (value: any, options?: any) => any;
  remove: (value: number) => any;
};

export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // raw JSON string
  };
}

function translateFunctions(txt: string) {
  return txt
    .replace("set_value", "ثبت مقدار")
    .replace("variants_append", "ثبت واریانت")
    .replace("variants_remove", "حذف واریانت")
    .replace("attributes_append", "ثبت ویژگی")
    .replace("attributes_remove", "حذف ویژگی")
    .replace("update_product_type", "به روز رسانی نوع محصول")
    .replace("check_errors", "بررسی خطاهای فرم")
    .replace("set_variant_mediaIds", "انتخاب تصویر")
    .replace("set_variant_primary_media", "انتخاب تصویر اصلی واریانت");
}

function getMediaIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && !!item.trim(),
      )
    : [];
}
export function MessageBubble({
  role,
  text,
  tools,
  send,
}: {
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  tools?: LLMToolCall[];
  send?: any;
}) {
  const [show, setShow] = React.useState(false);

  const { getValues, setValue } = useFormContext();

  if (tools?.length) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          px: 1,
          cursor: "pointer",
          flexDirection: "column",
          my: 2,
        }}
      >
        <Box
          sx={{
            "& p,a, li": {
              fontSize: 12,
            },
          }}
        >
          <ReactMarkdown
            components={{
              p: Typography,
              a: Link,
            }}
          >
            {text}
          </ReactMarkdown>
        </Box>
        {tools.map((x) =>
          x.function.name !== "set_variant_mediaIds" ? (
            <Box key={x.id}>
              <Stack
                direction="row"
                alignItems="center"
                gap={1}
                sx={{ cursor: "pointer" }}
                onClick={() => setShow((last) => !last)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                >
                  <g fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path
                      d="M7 10c0-1.414 0-2.121.44-2.56C7.878 7 8.585 7 10 7h4c1.414 0 2.121 0 2.56.44c.44.439.44 1.146.44 2.56v4c0 1.414 0 2.121-.44 2.56c-.439.44-1.146.44-2.56.44h-4c-1.414 0-2.121 0-2.56-.44C7 16.122 7 15.415 7 14z"
                      opacity={0.5}
                    ></path>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12.429 10L11 12h2l-1.429 2"
                    ></path>
                    <path d="M4 12c0-3.771 0-5.657 1.172-6.828S8.229 4 12 4s5.657 0 6.828 1.172S20 8.229 20 12s0 5.657-1.172 6.828S15.771 20 12 20s-5.657 0-6.828-1.172S4 15.771 4 12Z"></path>
                    <path
                      strokeLinecap="round"
                      d="M4 12H2m20 0h-2M4 9H2m20 0h-2M4 15H2m20 0h-2m-8 5v2m0-20v2M9 20v2M9 2v2m6 16v2m0-20v2"
                      opacity={0.5}
                    ></path>
                  </g>
                </svg>
                <Typography variant="caption" color="text.secondary">
                  فراخوانی متد: {translateFunctions(x.function.name)}
                </Typography>
              </Stack>

              <Collapse in={show} unmountOnExit>
                <CodeBlock
                  language="bash"
                  children={
                    typeof x.function.arguments === "object"
                      ? JSON.stringify(x.function.arguments)
                      : x.function.arguments
                  }
                />
              </Collapse>
            </Box>
          ) : (
            <Box key={x.id}>
              <ImageUploader
                multiple
                value={getValues(
                  `variants.${(x.function.arguments as any).index}.mediaIds`,
                )}
                maxFiles={10}
                label="تصویر"
                scope="attachment"
                onChange={(values) => {
                  setValue(
                    `variants.${(x.function.arguments as any).index}.mediaIds`,
                    values,
                  );
                  send?.({
                    message: {
                      role: "tool",
                      tool_call_id: x.id,
                      content: JSON.stringify(getValues()),
                    },
                    model: "deepseek-reasoner",
                    tool_choice: "auto",
                  });
                }}
              />
            </Box>
          ),
        )}
      </Box>
    );
  }

  if (role === "tool") {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          px: 1,
          cursor: "pointer",
          flexDirection: "column",
          my: 2,
        }}
        onClick={() => setShow((last) => !last)}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={16}
            height={16}
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="m20.352 10.52l-1.716 5.15c-1.21 3.63-1.816 5.446-2.703 5.962c-.844.49-1.887.49-2.73 0c-.888-.516-1.493-2.331-2.703-5.962c-.195-.583-.292-.874-.455-1.118a2.2 2.2 0 0 0-.597-.597c-.244-.163-.535-.26-1.118-.454c-3.63-1.21-5.446-1.816-5.962-2.703a2.72 2.72 0 0 1 0-2.731C2.884 7.18 4.7 6.575 8.33 5.364l5.15-1.716c4.498-1.5 6.747-2.25 7.934-1.062s.438 3.436-1.062 7.935"
              clipRule="evenodd"
              opacity={0.5}
            ></path>
            <path
              fill="currentColor"
              d="M13.046 10.902a.75.75 0 0 1 .006-1.06l4.21-4.164a.75.75 0 0 1 1.055 1.066l-4.21 4.164a.75.75 0 0 1-1.061-.006"
            ></path>
          </svg>

          <Typography variant="caption" color="text.secondary">
            فراخوانی متد انجام شد. برای دیدن نتایج اینجا کلیک کنید.
          </Typography>
        </Stack>
        <Collapse in={show} unmountOnExit>
          <CodeBlock
            language="bash"
            children={typeof text === "string" ? text : JSON.stringify(text)}
          />
        </Collapse>
      </Box>
    );
  }
  const isUser = role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        px: 1,
        width: "100%",
      }}
    >
      <Paper
        elevation={2}
        sx={{
          px: 2,
          py: 1.25,
          borderRadius: "1rem",
          width: "100%",
          bgcolor: !isUser ? "primary.contrastText" : "info.main",
          color: !isUser ? "primary.main" : "info.contrastText",
          "& p,a, li": {
            fontSize: 14,
          },
        }}
      >
        <ReactMarkdown
          components={{
            p: Typography,
            a: Link,
          }}
        >
          {text}
        </ReactMarkdown>
      </Paper>
    </Box>
  );
}

// -------------------------
// Main Component
// -------------------------

export default function AIProductChatDialog(props: AIProductChatDialogProps) {
  const {
    categories,
    productTypes,
    onTypeUpdate,
    createEmptyVariant,
    open,
    onClose,
    title = "افزودن با هوش مصنوعی",
    formError,
    schema,
    append,
    remove,
  } = props;

  const theme = useTheme();
  const [url] = useLocalStorage("llm");
  const [includeVariantImagesForAi, setIncludeVariantImagesForAi] =
    React.useState(true);
  const [variantImageAsPrimary, setVariantImageAsPrimary] =
    React.useState(true);
  const {
    messages,
    loading,
    send,
    errors: { axiosErrors, errors: easyLLMErrors, toolErrors },
    llm,
    setMessages,
  } = useEasyLLM({
    systemPrompt: SYSTEM_PRODUCT_PROMPT.replace(
      "__TYPES__",
      JSON.stringify(productTypes),
    ).replace("__CATEGORIES__", JSON.stringify(categories)),
    url: url || "/api/ai/extract",
    retries: 2,
    retryDelay: 5e3,
    onError(err) {
      toast.error(err.message);
    },
    onToolError(name, id, err) {
      toast.error(`Tool Error: tool-name: ${name} Error: ${err?.message}`);
    },
  });

  const {
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<any>();

  const buildAiImageContext = React.useCallback(() => {
    if (!includeVariantImagesForAi) return "";

    const values = getValues();
    const variants = Array.isArray(values?.variants) ? values.variants : [];
    const variantImages = variants
      .map((variant: any, index: number) => {
        const mediaIds = getMediaIds(variant?.mediaIds);
        return {
          index,
          sku: variant?.sku,
          barcode: variant?.barcode,
          title: variant?.title,
          attributes: variant?.attributeValues,
          mediaIds,
          primaryMediaId: mediaIds[0],
        };
      })
      .filter((variant: any) => variant.mediaIds.length > 0);

    if (!variantImages.length) return "";

    return [
      "\n\n[CONTEXT: current variant images]",
      "You may reuse existing variant images instead of asking for new uploads.",
      variantImageAsPrimary
        ? "The first mediaIds item is the primary image for that variant. If primary image must change, call set_variant_primary_media."
        : "Keep existing mediaIds order unless user asks to change the primary image.",
      JSON.stringify({ variantImages }, null, 2),
      "[/CONTEXT]",
    ].join("\n");
  }, [getValues, includeVariantImagesForAi, variantImageAsPrimary]);

  llm.registerTool("set_value", {
    desc: "the function for setting values to the form. it will return full form object.",
    props: {
      key: {
        type: "string",
        desc: 'the key of the property you wan to set. example: "slug" or "variants.[index].sku"',
        required: true,
      },
      value: {
        type: "string",
        desc: "the value of that field you want to set. for type look at the schema you have in system prompt. if its json just return json string and we will parse it here.",
        required: true,
      },
    },
    func: async (args) => {
      try {
        args.value = JSON.parse(args.value);
      } catch {}
      setValue(args.key, args.value, { shouldTouch: true });

      return JSON.stringify(getValues());
    },
    type: "auto",
  });

  llm.registerTool("variants_append", {
    desc: "for appending a new row to variants. it will return full form object.",
    props: {
      variant: {
        desc: "variant object to append to form",
        required: true,
        type: "object",
      },
    },
    func: ({ variant }) => {
      if (variant) {
        if (!variant.attributeValues.weightGrams)
          variant.attributeValues.weightGrams = 313;
        append(variant);
      } else createEmptyVariant();
      return JSON.stringify(getValues());
    },
    type: "auto",
  });
  llm.registerTool("variants_remove", {
    desc: "remove a variant by index. it will return full form object.",
    props: {
      index: {
        desc: "the index of the variant you want to remove",
        required: true,
        type: "number",
      },
    },
    func: ({ index }) => {
      remove(index);
      return JSON.stringify(getValues());
    },
    type: "auto",
  });

  llm.registerTool("update_product_type", {
    desc: "update the selected product type. if user asks for new values for attributes you should first call this and add new values to the type. it will return the full updated product type object",
    props: {
      productType: {
        type: "object",
        desc: "the updated product type object with new values you added",
        required: true,
      },
    },
    func: async ({ productType }) => {
      await onTypeUpdate(productType);
      return JSON.stringify(productType);
    },
    type: "auto",
  });

  llm.registerTool("check_errors", {
    desc: "it validates the current form values with zod",
    func: async () => {
      const result = schema.safeParse(getValues());
      return JSON.stringify(result);
    },
    type: "auto",
  });

  llm.registerTool("set_variant_mediaIds", {
    desc: "ask user to add or reorder images for a variant. mediaIds order matters; first mediaId is the primary image.",
    props: {
      index: {
        desc: "the index of the variant you want to user to add mediaIds",
        required: true,
        type: "number",
      },
    },
    func: () => {
      return "";
    },
    type: "cut-for-user",
  });

  llm.registerTool("set_variant_primary_media", {
    desc: "set one existing mediaId as the primary image of a variant by moving it to the first position in mediaIds. It returns full form object.",
    props: {
      index: {
        desc: "the index of the variant",
        required: true,
        type: "number",
      },
      mediaId: {
        desc: "existing mediaId that should become the primary image",
        required: true,
        type: "string",
      },
    },
    func: ({ index, mediaId }) => {
      const current = getMediaIds(getValues(`variants.${index}.mediaIds`));
      const next = [mediaId, ...current.filter((item) => item !== mediaId)];
      setValue(`variants.${index}.mediaIds`, next, {
        shouldTouch: true,
        shouldDirty: true,
      });
      return JSON.stringify(getValues());
    },
    type: "auto",
  });

  const [input, setInput] = React.useState("");
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll on message add
  React.useEffect(() => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const handleClose = () => {
    onClose?.();
  };
  function handleSend() {
    const last = messages[messages.length - 1];

    if (last.tool_calls?.length) {
      setMessages((arr) => [
        ...arr,
        ...(last.tool_calls || [])
          .filter((x) => x.function.name === "set_variant_mediaIds")
          .map(
            (x) =>
              ({
                timestamp: Date.now(),
                tool_call_id: x.id,
                role: "tool",
                content: "cancelled",
              }) as const,
          ),
      ]);

      return toast.warning(
        "انتخاب تصویر لغو شد! لطفا دوباره روی دکمه ارسال کلیک نمایید..",
      );
    }
    send({
      message: {
        role: "user",
        content: `${input}${buildAiImageContext()}`,
      },
      model: "deepseek-reasoner",
      tool_choice: "auto",
    });
    setInput("");
  }

  // Enter to send, Shift+Enter for newline
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  React.useEffect(() => {
    if (!formError) return;
    setInput(`خطای بازگشتی : ${formError}`);
  }, [formError]);

  React.useEffect(() => {
    if (!errors) return;
    try {
      if (Object.keys(errors).length === 0) return;
      setInput(`خطای اعتبار سنجی:\n${JSON.stringify(errors)}`);
    } catch {}
  }, [errors]);

  return (
    <Dialog
      open={!!open}
      fullScreen
      onClose={handleClose}
      slotProps={{
        paper: {
          sx: {
            bgcolor: "background.default",
            backgroundImage: "none",
            backdropFilter: "blur(5px)",
          },
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          maxHeight: "99vh",
          height: "100%",
          py: 8,
          pb: 16,
          display: "flex",
          gap: 2,
        }}
      >
        <Box
          ref={viewportRef}
          sx={{
            maxHeight: "100%",
            overflowY: "auto",
            flex: "1 1 auto",
            height: "100%",
          }}
        >
          {/* Context header */}
          <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Chip
                label={`انواع محصول: ${productTypes?.length ?? 0}`}
                size="small"
              />
              <Chip
                label={`نوع محصول ارائه‌شده`}
                size="small"
                color="primary"
              />
              <Chip
                label={`دسته‌ها: ${categories?.length ?? 0}`}
                size="small"
              />
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0, sm: 2 }}
              sx={{ mt: 1 }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeVariantImagesForAi}
                    onChange={(event) =>
                      setIncludeVariantImagesForAi(event.target.checked)
                    }
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption">
                    استفاده از تصاویر فعلی واریانت‌ها
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={variantImageAsPrimary}
                    onChange={(event) =>
                      setVariantImageAsPrimary(event.target.checked)
                    }
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption">
                    اولین تصویر، تصویر اصلی واریانت باشد
                  </Typography>
                }
              />
            </Stack>
          </Box>

          {/* Messages viewport */}
          <Box sx={{ py: 2, px: 1.5 }}>
            <Stack gap={2}>
              {messages
                .filter((x) => x.role !== "system")
                .map((m, i) => (
                  <MessageBubble
                    key={i}
                    role={m.role}
                    text={m.content || ""}
                    tools={m.tool_calls as any}
                    send={send}
                  />
                ))}
              {loading && (
                <Box
                  sx={{ display: "flex", justifyContent: "flex-start", px: 1 }}
                >
                  <ShinyText text="در حال پردازش..." speed={1} />
                </Box>
              )}
              {!!(
                easyLLMErrors.length +
                axiosErrors.length +
                toolErrors.length
              ) && (
                <Accordion>
                  <AccordionSummary>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={2}
                    >
                      <Typography variant="caption">خطاهای سیستم</Typography>
                      <Chip
                        color="error"
                        label={
                          easyLLMErrors.length +
                          axiosErrors.length +
                          toolErrors.length
                        }
                      />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    {easyLLMErrors.map((x) => (
                      <Typography key={x.timestamp}>{x.message}</Typography>
                    ))}
                    {toolErrors.map((x) => (
                      <Typography key={x.timestamp}>{x.message}</Typography>
                    ))}
                    {axiosErrors.map((x) => (
                      <Typography key={x.timestamp}>{x.message}</Typography>
                    ))}
                  </AccordionDetails>
                </Accordion>
              )}
            </Stack>
          </Box>

          {messages.length === 1 && (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ width: "100%", height: "80%" }}
            >
              <FuzzyText children="Deepseek Assistant" fontSize={32} />
              <ShinyText text="Waiting for orders master" speed={1} />
            </Stack>
          )}
        </Box>
        <Box
          sx={{
            maxHeight: "100%",
            height: "100%",
            overflowY: "auto",
            minWidth: 400,
            display: { xs: "none", md: "block" },
            backdropFilter: "blur(3px)",
            borderRadius: "1rem",
            p: 2,

            maxWidth: 400,
          }}
        >
          <Typography variant="subtitle1">اطلاعات محصول</Typography>

          {React.useMemo(
            () => (
              <ProductLLMRender
                categories={categories}
                productTypes={productTypes}
              />
            ),
            [],
          )}
        </Box>
      </DialogContent>

      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,

          backgroundColor: theme.vars?.palette.background.defaultChannel,
          backgroundImage: "none",
          backdropFilter: "blur(5px)",
        }}
      >
        <Typography variant="h6" component="div" sx={{ flex: 1 }}>
          {title}
        </Typography>
        <Tooltip title="بستن">
          <IconButton onClick={handleClose} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </Tooltip>
      </DialogTitle>
      <Box
        sx={{
          p: 1.5,
          position: "absolute",
          bottom: 0,
          right: 0,
          left: 0,
          backgroundColor: theme.vars?.palette.background.defaultChannel,
          backgroundImage: "none",
          backdropFilter: "blur(5px)",
        }}
      >
        <InputBase
          multiline
          minRows={2}
          maxRows={6}
          fullWidth
          placeholder="اینجا بنویسید یا جای‌گذاری کنید…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          endAdornment={
            <InputAdornment position="end">
              <Tooltip title="ارسال">
                <span>
                  <IconButton
                    onClick={() => handleSend()}
                    disabled={loading || !input.trim()}
                  >
                    {loading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <SendRoundedIcon
                        sx={{
                          rotate: "180deg",
                        }}
                      />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </InputAdornment>
          }
        />
        {/* Quick helper row */}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => setInput((i) => (i ? i + "\n" : "") + "عنوان: ")}
          >
            عنوان
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() =>
              setInput((i) => (i ? i + "\n" : "") + "قیمت پایه (تومان): ")
            }
          >
            قیمت
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() =>
              setInput((i) => (i ? i + "\n" : "") + "واریانت‌ها: ")
            }
          >
            واریانت‌ها
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() =>
              setInput((i) => (i ? i + "\n" : "") + "تخفیف: ٪ و تاریخ‌ها: ")
            }
          >
            تخفیف
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
