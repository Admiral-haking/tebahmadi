"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import type { MediaScope } from "@/types";
import {
  uploadMedia,
  type MediaUploadResult,
} from "@/media/client/uploadMedia";
import AiImageDialog from "../ai-image";
import MediaGalleryPicker from "../media-gallery-picker";

type PreviewMap = Map<string, string>;

type BaseImageUploaderProps = {
  label?: ReactNode;
  helperText?: ReactNode;
  errorText?: ReactNode;
  scope?: MediaScope;
  maxFiles?: number;
  disabled?: boolean;
  accept?: string;
  onUploaded?: (media: MediaUploadResult) => void;
};

type SingleImageUploaderProps = BaseImageUploaderProps & {
  multiple?: false;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
};

type MultipleImageUploaderProps = BaseImageUploaderProps & {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
};

export type ImageUploaderProps =
  | SingleImageUploaderProps
  | MultipleImageUploaderProps;

export function ImageUploader(props: ImageUploaderProps) {
  const {
    label,
    helperText,
    errorText,
    scope = "attachment",
    maxFiles,
    disabled,
    accept = "image/*",
    onUploaded,
  } = props;

  const multiple = props.multiple ?? false;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isControlled = props.value !== undefined;
  const [internalValue, setInternalValue] = useState<string | string[] | null>(
    () => {
      if (props.defaultValue !== undefined) {
        return props.defaultValue as string | string[] | null;
      }
      return multiple ? [] : null;
    },
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PreviewMap>(new Map());
  const [llm, setLlm] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const selectedValue = isControlled
    ? (props.value as string | string[] | null)
    : internalValue;

  const currentIds = useMemo(() => {
    if (multiple) {
      if (Array.isArray(selectedValue)) {
        return selectedValue;
      }
      if (selectedValue) {
        return [selectedValue as string];
      }
      return [];
    }
    if (typeof selectedValue === "string" && selectedValue) {
      return [selectedValue];
    }
    return [];
  }, [multiple, selectedValue]);

  const emitChange = (nextIds: string[]) => {
    if (!isControlled) {
      setInternalValue(multiple ? nextIds : (nextIds[0] ?? null));
    }

    if (multiple) {
      (props as MultipleImageUploaderProps).onChange?.(nextIds);
    } else {
      (props as SingleImageUploaderProps).onChange?.(nextIds[0] ?? null);
    }
  };

  const effectiveHelper = errorText ?? uploadError ?? helperText;
  const hasError = Boolean(errorText || uploadError);
  const reachedLimit =
    Boolean(maxFiles) && currentIds.length >= (maxFiles ?? 0);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const files = Array.from(fileList);
    const remainingSlots = maxFiles
      ? Math.max(maxFiles - currentIds.length, 0)
      : files.length;
    const filesToUpload = maxFiles ? files.slice(0, remainingSlots) : files;
    if (filesToUpload.length === 0) {
      return;
    }

    setUploading(true);
    setUploadError(null);

    const previousIds = currentIds;
    const newIds: string[] = [];
    for (const file of filesToUpload) {
      const previewUrl = URL.createObjectURL(file);
      try {
        const media = await uploadMedia({ file, scope });
        const mediaId = media.id;
        newIds.push(mediaId);
        setPreviews((prev) => {
          const next = new Map(prev);
          next.set(mediaId, `/api/media/${mediaId}?type=thumb`);
          return next;
        });
        onUploaded?.(media);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        URL.revokeObjectURL(previewUrl);
      }
    }

    setUploading(false);

    if (!newIds.length) {
      return;
    }

    if (multiple) {
      const next = [...currentIds, ...newIds];
      emitChange(next);
    } else {
      emitChange([newIds[0]]);
      setPreviews((prev) => {
        const next = new Map(prev);
        previousIds.forEach((id) => {
          const url = next.get(id);
          if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
          next.delete(id);
        });
        return next;
      });
    }
  };

  const removeId = (id: string) => {
    if (multiple) {
      const next = currentIds.filter((item) => item !== id);
      emitChange(next);
    } else {
      emitChange([]);
    }

    setPreviews((prev) => {
      const next = new Map(prev);
      const url = next.get(id);
      if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
      next.delete(id);
      return next;
    });
  };

  const makePrimary = (id: string) => {
    if (!multiple || disabled || uploading || currentIds[0] === id) return;
    emitChange([id, ...currentIds.filter((item) => item !== id)]);
  };

  // Images chosen from the existing site gallery — same id format as an upload,
  // so they slot into the form exactly like a directly-uploaded image.
  const handleGallerySelect = (ids: string[]) => {
    if (!ids.length) return;
    if (multiple) {
      const merged = [...currentIds];
      for (const id of ids) {
        if (merged.includes(id)) continue;
        if (maxFiles && merged.length >= maxFiles) break;
        merged.push(id);
      }
      emitChange(merged);
    } else {
      emitChange([ids[0]]);
    }
  };

  return (
    <Stack gap={1.5}>
      {label && (
        <Typography variant="subtitle2" color={hasError ? "error" : undefined}>
          {label}
        </Typography>
      )}

      <Stack direction="row" alignItems="center" gap={1}>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled || uploading || reachedLimit}
          onClick={() => inputRef.current?.click()}
        >
          {multiple ? "اضافه کردن تصویر" : "اپلود تصویر"}
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="secondary"
          disabled={disabled || uploading || reachedLimit}
          onClick={() => setGalleryOpen(true)}
        >
          انتخاب از گالری
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={disabled || uploading || reachedLimit}
          onClick={() => setLlm(true)}
        >
          ساخت تصویر با هوش مصنوعی
        </Button>
        {uploading && (
          <CircularProgress size={24} sx={{ ml: 2, verticalAlign: "middle" }} />
        )}
      </Stack>

      <Stack direction="row" gap={1} flexWrap="wrap">
        {currentIds.map((id, index) => {
          const previewUrl = previews.get(id);
          const isPrimary = multiple && index === 0;
          return (
            <Stack key={id} alignItems="center" gap={0.5} sx={{ width: 100 }}>
              <Box
                onClick={() => makePrimary(id)}
                role={multiple ? "button" : undefined}
                tabIndex={multiple ? 0 : undefined}
                onKeyDown={(event) => {
                  if (!multiple) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    makePrimary(id);
                  }
                }}
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: 1,
                  border: isPrimary ? 3 : 1,
                  borderColor: isPrimary ? "warning.main" : "divider",
                  overflow: "hidden",
                  bgcolor: "background.default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 0.5,
                  cursor:
                    multiple && !disabled && !uploading ? "pointer" : "default",
                  boxShadow: isPrimary
                    ? "0 0 0 2px rgba(var(--mui-palette-warning-mainChannel) / 0.18)"
                    : "none",
                  transition: "border-color .15s ease, box-shadow .15s ease",
                  "&:hover": multiple
                    ? {
                        borderColor: isPrimary
                          ? "warning.main"
                          : "primary.main",
                      }
                    : undefined,
                }}
              >
                {isPrimary && (
                  <Chip
                    label="اصلی"
                    color="warning"
                    size="small"
                    sx={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      zIndex: 1,
                      height: 22,
                      fontWeight: 700,
                    }}
                  />
                )}
                {previewUrl ? (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="Uploaded preview"
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Box
                    component="img"
                    src={`/api/media/${id}`}
                    alt="Uploaded preview"
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </Box>
              <Button
                size="small"
                variant="text"
                color={isPrimary ? "warning" : "secondary"}
                onClick={() => (isPrimary ? undefined : makePrimary(id))}
                disabled={disabled || uploading || isPrimary || !multiple}
              >
                {isPrimary ? "تصویر اصلی" : "اصلی شود"}
              </Button>
              <Button
                size="small"
                variant="text"
                color="secondary"
                onClick={() => removeId(id)}
                disabled={disabled || uploading}
              >
                حذف
              </Button>
            </Stack>
          );
        })}
      </Stack>

      {(effectiveHelper || hasError) && (
        <FormHelperText error={hasError}>{effectiveHelper}</FormHelperText>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        disabled={disabled}
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <AiImageDialog
        onClose={() => setLlm(false)}
        open={llm}
        onSave={handleFiles}
        sampleMediaIds={currentIds}
      />
      <MediaGalleryPicker
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        multiple={multiple}
        maxFiles={maxFiles}
        onSelect={handleGallerySelect}
      />
    </Stack>
  );
}
