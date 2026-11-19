"use client";
import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { DEFAULT_AI_IMAGE_SYSTEM_PROMPT } from "@/ai/constants";
import useLocalStorage from "@/hooks/use-localStorage";

type BaseImage = {
  file: File;
  url: string;
};

type EditedItem = {
  id: string;
  url: string;
  file: File;
  checked: boolean;
  promptId?: string;
  promptName?: string;
  promptText?: string;
};

type PromptOption = {
  id: string;
  name: string;
  prompt: string;
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (files: FileList) => Promise<any>;
  sampleMediaIds?: string[];
} & Omit<DialogProps, "open" | "onClose">;

export default function AiImageDialog({
  open,
  onClose,
  onSave,
  sampleMediaIds = [],
  ...rest
}: Props) {
  const [url] = useLocalStorage("gpt");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<EditedItem[]>([]);
  const [baseImage, setBaseImageState] = useState<BaseImage | null>(null);
  const [busyGenerate, setBusyGenerate] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [viewer, setViewer] = useState<{ open: boolean; src?: string }>({
    open: false,
  });
  const [prompts, setPrompts] = useState<PromptOption[]>([]);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState(
    DEFAULT_AI_IMAGE_SYSTEM_PROMPT,
  );
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");

  const clearGeneratedItems = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
  }, []);

  const setBaseImage = useCallback(
    (file: File | null) => {
      setBaseImageState((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return file ? { file, url: URL.createObjectURL(file) } : null;
      });
      if (file) {
        clearGeneratedItems();
      }
    },
    [clearGeneratedItems],
  );

  const revokeAll = useCallback(() => {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    if (baseImage) {
      URL.revokeObjectURL(baseImage.url);
    }
  }, [items, baseImage]);

  const sanitizeFileNameSegment = (input: string) =>
    input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 40);

  const buildGeneratedFileName = (source: File, promptName?: string) => {
    const baseName = source.name.replace(/\.[^/.]+$/, "");
    const baseSegment = sanitizeFileNameSegment(baseName) || "image";
    const promptSegment = promptName ? sanitizeFileNameSegment(promptName) : "";
    const parts = ["edited"];
    if (promptSegment) parts.push(promptSegment);
    parts.push(baseSegment);
    return `${parts.join("_")}.png`;
  };

  const handleClose = () => {
    revokeAll();
    setItems([]);
    setBaseImageState(null);
    setSelectedPromptIds([]);
    setSystemPrompt(DEFAULT_AI_IMAGE_SYSTEM_PROMPT);
    setNewPromptName("");
    setNewPromptText("");
    onClose();
  };

  const appendEdited = (edited: File, prompt: PromptOption) => {
    const url = URL.createObjectURL(edited);
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        url,
        file: edited,
        checked: true,
        promptId: prompt.id,
        promptName: prompt.name,
        promptText: prompt.prompt,
      },
    ]);
  };

  const callAI = async (
    file: File,
    prompt: PromptOption,
    systemPromptText: string,
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("prompt", prompt.prompt);
    form.append("systemPrompt", systemPromptText);
    const response = await fetch(url || "/api/ai/image", {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      let message = "خطا در پردازش تصویر";
      try {
        const data = await response.json();
        if (data?.error) {
          message = data.error;
        }
      } catch {
        // ignore non-JSON errors
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    return new File([blob], buildGeneratedFileName(file, prompt.name), {
      type: "image/png",
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBaseImage(file);
      toast.success(`تصویر «${file.name}» انتخاب شد.`);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDropFiles = useCallback(
    (files: File[]) => {
      const first = files[0];
      if (!first) return;
      setBaseImage(first);
      toast.success(`تصویر «${first.name}» انتخاب شد.`);
    },
    [setBaseImage],
  );

  const handleSampleSelect = useCallback(
    async (mediaId: string) => {
      try {
        const response = await fetch(`/api/media/${mediaId}?type=original`);
        if (!response.ok) {
          throw new Error("دریافت تصویر نمونه ناموفق بود.");
        }
        const blob = await response.blob();
        const extension = blob.type.split("/")[1] || "jpg";
        const file = new File([blob], `variant-${mediaId}.${extension}`, {
          type: blob.type || "image/jpeg",
        });
        setBaseImage(file);
        toast.success("تصویر واریانت به عنوان نمونه انتخاب شد.");
      } catch (error) {
        console.error(error);
        toast.error(
          error instanceof Error
            ? error.message
            : "دریافت تصویر نمونه ناموفق بود.",
        );
      }
    },
    [setBaseImage],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    onDrop: handleDropFiles,
    multiple: false,
    noClick: true,
  });

  const toggleCheck = (id: string) =>
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
    );

  const togglePromptSelection = useCallback((id: string) => {
    setSelectedPromptIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [id, ...prev],
    );
  }, []);

  const handleDeletePrompt = useCallback(async (id: string) => {
    setDeletingPromptId(id);
    try {
      const res = await fetch(`/api/ai/prompts/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.error ?? "حذف پرامپت ناموفق بود.";
        throw new Error(message);
      }
      setPrompts((prev) => prev.filter((item) => item.id !== id));
      setSelectedPromptIds((prev) => prev.filter((pid) => pid !== id));
      toast.success("پرامپت حذف شد.");
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "حذف پرامپت ناموفق بود.";
      toast.error(message);
    } finally {
      setDeletingPromptId((current) => (current === id ? null : current));
    }
  }, []);

  const selectedFiles = useMemo(
    () => items.filter((i) => i.checked).map((i) => i.file),
    [items],
  );
  const selectedCount = selectedFiles.length;
  const selectedPrompts = useMemo(
    () => prompts.filter((prompt) => selectedPromptIds.includes(prompt.id)),
    [prompts, selectedPromptIds],
  );

  const fetchPrompts = useCallback(async () => {
    setLoadingPrompts(true);
    try {
      const res = await fetch("/api/ai/prompts");
      if (!res.ok) {
        throw new Error("امکان دریافت پرامپت‌ها وجود ندارد.");
      }
      const data = await res.json();
      const items: PromptOption[] = Array.isArray(data?.prompts)
        ? data.prompts
        : [];
      setPrompts(items);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "بارگذاری پرامپت‌ها ناموفق بود.",
      );
    } finally {
      setLoadingPrompts(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchPrompts();
  }, [open, fetchPrompts]);

  useEffect(() => {
    return () => {
      revokeAll();
    };
  }, [revokeAll]);

  const handleGenerate = async () => {
    if (!baseImage?.file) {
      toast.message("ابتدا یک تصویر ورودی انتخاب کنید.");
      return;
    }
    if (!selectedPrompts.length) {
      toast.message("حداقل یک پرامپت را انتخاب کنید.");
      return;
    }
    setBusyGenerate(true);
    const statusId = toast.loading("در حال تولید تصاویر…");
    const failures: string[] = [];
    let successCount = 0;

    try {
      for (const prompt of selectedPrompts) {
        try {
          const edited = await callAI(baseImage.file, prompt, systemPrompt);
          appendEdited(edited, prompt);
          successCount += 1;
        } catch (error) {
          console.error(error);
          failures.push(prompt.name);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} تصویر با موفقیت تولید شد.`, {
          id: statusId,
        });
      } else {
        toast.error("تولید تصاویر ناموفق بود.", { id: statusId });
      }

      if (failures.length) {
        const failedPrompts = failures.join("، ");
        toast.error(`پردازش برای پرامپت‌های ${failedPrompts} ناموفق بود.`);
      }
    } finally {
      setBusyGenerate(false);
    }
  };

  const handleCreatePrompt = async () => {
    const name = newPromptName.trim();
    const promptText = newPromptText.trim();
    if (!name) {
      toast.message("نام پرامپت را وارد کنید.");
      return;
    }
    if (!promptText) {
      toast.message("متن پرامپت را وارد کنید.");
      return;
    }
    setSavingPrompt(true);
    try {
      const res = await fetch("/api/ai/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt: promptText }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.error ?? "ذخیره پرامپت ناموفق بود.";
        throw new Error(message);
      }
      const created: PromptOption | undefined = data?.prompt;
      if (created) {
        setPrompts((prev) => [
          created,
          ...prev.filter((item) => item.id !== created.id),
        ]);
        setSelectedPromptIds((prev) =>
          prev.includes(created.id) ? prev : [created.id, ...prev],
        );
        toast.success(`پرامپت «${created.name}» ذخیره شد.`);
      }
      setNewPromptName("");
      setNewPromptText("");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "ذخیره پرامپت ناموفق بود.",
      );
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleSaveAll = async () => {
    if (!selectedCount) {
      toast.message("هیچ تصویری انتخاب نشده است.");
      return;
    }
    setBusySave(true);
    const t = toast.loading("در حال ذخیره تصاویر…");
    try {
      const dt = new DataTransfer();
      selectedFiles.forEach((f) => dt.items.add(f));
      await onSave(dt.files);
      toast.success("ذخیره تصاویر انجام شد.", { id: t });
    } catch (err) {
      console.error(err);
      toast.error("خطا در ذخیره تصاویر.", { id: t });
    } finally {
      setBusySave(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            bgcolor: "background.default",
            backgroundImage: "none",
            backdropFilter: "blur(5px)",
          },
        },
      }}
      {...rest}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography fontWeight={700}>ویرایش تصویر با هوش مصنوعی</Typography>
        <IconButton onClick={handleClose} aria-label="بستن">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box
          {...getRootProps()}
          sx={{
            border: "2px dashed",
            borderColor: isDragActive ? "primary.main" : "divider",
            borderRadius: 2,
            p: 3,
            textAlign: "center",
            transition: "border-color .15s ease",
            mb: 2,
            cursor: "pointer",
          }}
        >
          <input {...getInputProps()} />
          <Typography variant="body1" gutterBottom>
            تصویر پایه را اینجا رها کنید یا از دکمه «انتخاب تصویر» استفاده کنید.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            این تصویر برای تمام پرامپت‌های انتخابی استفاده می‌شود.
          </Typography>
          {(busyGenerate || busySave) && (
            <Box display="inline-flex" alignItems="center" gap={1} mt={2}>
              <CircularProgress size={18} />
              <Typography variant="body2">
                {busyGenerate ? "در حال تولید تصاویر…" : "در حال ذخیره…"}
              </Typography>
            </Box>
          )}
        </Box>

        {baseImage ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              mb: 3,
            }}
          >
            <Box
              component="img"
              src={baseImage.url}
              alt="تصویر ورودی"
              sx={{
                width: 96,
                height: 96,
                objectFit: "cover",
                borderRadius: 2,
              }}
            />
            <Box flexGrow={1}>
              <Typography fontWeight={600}>{baseImage.file.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                اندازه: {Math.round(baseImage.file.size / 1024)} کیلوبایت
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => setBaseImage(null)}>
              حذف تصویر
            </Button>
          </Box>
        ) : (
          <Box py={2}>
            <Typography color="text.secondary">
              هنوز تصویری انتخاب نشده است.
            </Typography>
          </Box>
        )}

        {sampleMediaIds.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              تصاویر فعلی واریانت برای نمونه
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              روی هر تصویر کلیک کنید تا به عنوان تصویر پایه هوش مصنوعی استفاده
              شود.
            </Typography>
            <Stack direction="row" gap={1.25} flexWrap="wrap">
              {sampleMediaIds.map((mediaId, index) => (
                <Box
                  key={`${mediaId}-${index}`}
                  component="button"
                  type="button"
                  onClick={() => void handleSampleSelect(mediaId)}
                  sx={{
                    width: 96,
                    height: 96,
                    p: 0.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    cursor: "pointer",
                    overflow: "hidden",
                    transition: "border-color .15s ease, box-shadow .15s ease",
                    "&:hover": {
                      borderColor: "primary.main",
                      boxShadow: 2,
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={`/api/media/${mediaId}`}
                    alt={`تصویر نمونه ${index + 1}`}
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: 1.5,
                      display: "block",
                    }}
                  />
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Box sx={{ my: 2 }}>
          <Accordion>
            <AccordionSummary>پرامپت سیستم</AccordionSummary>
            <AccordionDetails>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  پرامپت سیستمی (قابل ویرایش)
                </Typography>
                <TextField
                  multiline
                  minRows={4}
                  fullWidth
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  placeholder="پرامپت پایه برای همه پردازش‌ها"
                  slotProps={{
                    input: {
                      style: {
                        direction: "ltr",
                        textAlign: "left",
                      },
                    },
                  }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary>پرامپت های شما</AccordionSummary>
            <AccordionDetails>
              <Box>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  mb={1}
                >
                  <Typography variant="subtitle1" fontWeight={600}>
                    پرامپت‌های ذخیره‌شده
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => fetchPrompts()}
                    disabled={loadingPrompts}
                  >
                    به‌روزرسانی
                  </Button>
                </Box>
                {loadingPrompts ? (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CircularProgress size={18} />
                    <Typography variant="body2">
                      در حال بارگذاری پرامپت‌ها…
                    </Typography>
                  </Box>
                ) : prompts.length === 0 ? (
                  <Typography color="text.secondary">
                    هنوز پرامپتی ذخیره نشده است. از فرم زیر یک پرامپت جدید
                    بسازید.
                  </Typography>
                ) : (
                  <Stack spacing={1.5} sx={{ mb: 3 }}>
                    {prompts.map((prompt) => {
                      const selected = selectedPromptIds.includes(prompt.id);
                      const deleting = deletingPromptId === prompt.id;
                      return (
                        <Box
                          key={prompt.id}
                          onClick={() => togglePromptSelection(prompt.id)}
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                            border: "1px solid",
                            borderColor: selected ? "primary.main" : "divider",
                            borderRadius: 2,
                            p: 1.5,
                            bgcolor: selected
                              ? "primary.main"
                              : "background.paper",
                            color: selected
                              ? "primary.contrastText"
                              : "inherit",
                            cursor: "pointer",
                            transition:
                              "border-color .15s ease, background-color .15s ease",
                          }}
                        >
                          <Checkbox
                            checked={selected}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => togglePromptSelection(prompt.id)}
                            sx={{
                              alignSelf: "flex-start",
                              color: selected
                                ? "primary.contrastText"
                                : undefined,
                              "&.Mui-checked": {
                                color: selected
                                  ? "primary.contrastText"
                                  : "primary.main",
                              },
                            }}
                            inputProps={{
                              "aria-label": `انتخاب ${prompt.name}`,
                            }}
                          />
                          <Box flex={1} minWidth={0} sx={{ pr: 1 }}>
                            <Typography fontWeight={700}>
                              {prompt.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              color={
                                selected
                                  ? "primary.contrastText"
                                  : "text.secondary"
                              }
                            >
                              {prompt.prompt}
                            </Typography>
                          </Box>
                          {deleting ? (
                            <CircularProgress
                              size={18}
                              sx={{
                                alignSelf: "center",
                                color: selected
                                  ? "primary.contrastText"
                                  : "text.secondary",
                              }}
                            />
                          ) : (
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeletePrompt(prompt.id);
                              }}
                              sx={{
                                ml: 0.5,
                                alignSelf: "flex-start",
                                color: selected
                                  ? "primary.contrastText"
                                  : "text.secondary",
                              }}
                              aria-label={`حذف ${prompt.name}`}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  ایجاد پرامپت جدید
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    fullWidth
                    label="نام پرامپت"
                    value={newPromptName}
                    onChange={(event) => setNewPromptName(event.target.value)}
                  />
                  <TextField
                    fullWidth
                    label="متن پرامپت"
                    multiline
                    minRows={3}
                    value={newPromptText}
                    onChange={(event) => setNewPromptText(event.target.value)}
                  />
                  <Box display="flex" gap={1}>
                    <Button
                      variant="contained"
                      onClick={handleCreatePrompt}
                      disabled={savingPrompt}
                      startIcon={
                        savingPrompt ? (
                          <CircularProgress size={16} />
                        ) : undefined
                      }
                    >
                      {savingPrompt ? "در حال ذخیره…" : "ذخیره پرامپت"}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setNewPromptName("");
                        setNewPromptText("");
                      }}
                    >
                      پاک‌سازی فرم
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>

        <Stack
          direction="row"
          gap={2}
          alignItems="center"
          flexWrap="wrap"
          sx={{ my: 2 }}
        >
          {prompts.map((prompt) => {
            const selected = selectedPromptIds.includes(prompt.id);
            return (
              <FormControlLabel
                key={prompt.id}
                label={prompt.name}
                control={
                  <Checkbox
                    checked={selected}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => togglePromptSelection(prompt.id)}
                  />
                }
              />
            );
          })}
        </Stack>

        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          تصاویر تولید شده
        </Typography>
        {items.length === 0 ? (
          <Box py={4} textAlign="center">
            <Typography color="text.secondary">
              هنوز تصویری اضافه نشده است.
            </Typography>
          </Box>
        ) : (
          <ImageList cols={4} gap={12}>
            {items.map((item) => (
              <ImageListItem
                key={item.id}
                sx={{ borderRadius: 2, overflow: "hidden" }}
              >
                <img
                  src={item.url}
                  alt="تصویر ویرایش‌شده"
                  loading="lazy"
                  style={{ cursor: "zoom-in", background: "transparent" }}
                  onClick={() => setViewer({ open: true, src: item.url })}
                />
                <ImageListItemBar
                  position="bottom"
                  sx={{ bgcolor: "rgba(var(--mui-palette-common-onBackgroundChannel) / 0.35)" }}
                  title={item.promptName}
                  actionIcon={
                    <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
                      <IconButton
                        aria-label="بزرگ‌نمایی"
                        onClick={() => setViewer({ open: true, src: item.url })}
                        sx={{ color: "white" }}
                      >
                        <ZoomInIcon />
                      </IconButton>
                      <Checkbox
                        checked={item.checked}
                        onChange={() => toggleCheck(item.id)}
                        sx={{ color: "white" }}
                        inputProps={{ "aria-label": "انتخاب" }}
                      />
                    </Box>
                  }
                  subtitle={item.checked ? "انتخاب‌شده" : "انتخاب‌نشده"}
                />
              </ImageListItem>
            ))}
          </ImageList>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFileChange}
        />
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Box>
          <Button onClick={handleClose}>بستن</Button>
        </Box>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Button
            variant="outlined"
            onClick={() => fileInputRef.current?.click()}
            disabled={busyGenerate || busySave}
          >
            انتخاب تصویر
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerate}
            disabled={
              busyGenerate ||
              busySave ||
              !baseImage ||
              selectedPrompts.length === 0
            }
            startIcon={
              busyGenerate ? <CircularProgress size={16} /> : undefined
            }
          >
            {busyGenerate
              ? "در حال تولید…"
              : `تولید (${selectedPrompts.length})`}
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveAll}
            disabled={busySave || selectedCount === 0}
            startIcon={busySave ? <CircularProgress size={16} /> : undefined}
          >
            {busySave ? "در حال ذخیره…" : `ذخیره (${selectedCount})`}
          </Button>
        </Box>
      </DialogActions>

      <Dialog
        open={viewer.open}
        onClose={() => setViewer({ open: false })}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography>نمایش تصویر</Typography>
          <IconButton onClick={() => setViewer({ open: false })}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewer.src && (
            <Box display="flex" justifyContent="center">
              <img
                src={viewer.src}
                alt="نمایش بزرگ"
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  background: "transparent",
                }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
