"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Controller, useFormContext } from "react-hook-form";
import type { MediaScope } from "@/types";
import { uploadMedia, type MediaUploadResult } from "@/media/client/uploadMedia";
import AiImageDialog from "../ai-image";
import MediaGalleryPicker from "../media-gallery-picker";

interface RHFUploadImageProps {
  name: string;
  label?: ReactNode;
  helperText?: ReactNode;
  scope?: MediaScope;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  accept?: string;
  onUploaded?: (media: MediaUploadResult) => void;
}

type PreviewMap = Map<string, string>;

export function RHFUploadImage({
  name,
  label,
  helperText,
  scope = "attachment",
  multiple,
  maxFiles,
  disabled,
  accept = "image/*",
  onUploaded,
}: RHFUploadImageProps) {
  const { control } = useFormContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PreviewMap>(new Map());
  const [llm, setLlm] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const currentIds = useMemo(() => {
          if (multiple) {
            return Array.isArray(field.value) ? (field.value as string[]) : [];
          }
          return field.value ? [field.value as string] : [];
        }, [field.value, multiple]);

        const effectiveHelper = error?.message ?? uploadError ?? helperText;
        const reachedLimit = Boolean(maxFiles) && currentIds.length >= (maxFiles ?? 0);

        const handleFiles = async (fileList: FileList | null) => {
          if (!fileList?.length) return;

          const files = Array.from(fileList);
          const remainingSlots = maxFiles ? Math.max(maxFiles - currentIds.length, 0) : files.length;
          const filesToUpload = maxFiles ? files.slice(0, remainingSlots) : files;
          if (filesToUpload.length === 0) {
            return;
          }

          setUploading(true);
          setUploadError(null);

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
            field.onChange(next);
          } else {
            field.onChange(newIds[0]);
            // remove previews for previous selection
            setPreviews((prev) => {
              const next = new Map(prev);
              currentIds.forEach((id) => {
                const url = next.get(id);
                if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
                next.delete(id);
              });
              return next;
            });
          }
        };

        const handleGallerySelect = (ids: string[]) => {
          if (!ids.length) return;
          if (multiple) {
            const merged = [...currentIds];
            for (const id of ids) {
              if (merged.includes(id)) continue;
              if (maxFiles && merged.length >= maxFiles) break;
              merged.push(id);
            }
            field.onChange(merged);
          } else {
            field.onChange(ids[0]);
          }
        };

        const removeId = (id: string) => {
          if (multiple) {
            const next = currentIds.filter((item) => item !== id);
            field.onChange(next);
          } else {
            field.onChange(null);
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

        return (
          <Stack gap={1.5}>
            {label && (
              <Typography variant="subtitle2" color={error ? "error" : undefined}>
                {label}
              </Typography>
            )}

            <Stack
              direction="row"
              alignItems="center"
              gap={1}
            >
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
              {uploading && <CircularProgress size={24} sx={{ ml: 2, verticalAlign: "middle" }} />}
            </Stack>

            <Stack direction="row" gap={1} flexWrap="wrap">
              {currentIds.map((id) => {
                const previewUrl = previews.get(id);
                return (
                  <Stack key={id} alignItems="center" gap={0.5} sx={{ width: 140 }}>
                    <Box
                      sx={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: 1,
                        border: 1,
                        borderColor: "divider",
                        overflow: "hidden",
                        bgcolor: "background.default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        p: 0.5,
                      }}
                    >
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

            {(effectiveHelper || error) && (
              <FormHelperText error={!!(error || uploadError)}>{effectiveHelper}</FormHelperText>
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
      }}
    />
  );
}
