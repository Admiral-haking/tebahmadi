"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import FormHelperText from "@mui/material/FormHelperText";
import Typography from "@mui/material/Typography";
import { Controller, useFormContext } from "react-hook-form";
import type { AvatarVariantIds } from "@/types";
import { uploadMedia } from "@/media/client/uploadMedia";

interface RHFUploadAvatarProps {
  name: string;
  label?: ReactNode;
  helperText?: ReactNode;
  buttonLabel?: ReactNode;
  scope?: "avatar";
  disabled?: boolean;
}

const DEFAULT_AVATAR_SIZE = 96;

export function RHFUploadAvatar({
  name,
  label,
  helperText,
  buttonLabel = "Upload Avatar",
  scope = "avatar",
  disabled,
}: RHFUploadAvatarProps) {
  const { control } = useFormContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const value = field.value as AvatarVariantIds | null | undefined;

        const previewUrl = useMemo(() => {
          if (localPreview) {
            return localPreview;
          }
          if (value?.thumbId) {
            return `/api/media/${value.thumbId}`;
          }
          if (value?.originalId) {
            return `/api/media/${value.originalId}`;
          }
          return undefined;
        }, [localPreview, value?.thumbId, value?.originalId]);

        const effectiveHelper = error?.message ?? uploadError ?? helperText;

        const handleFiles = async (fileList: FileList | null) => {
          const file = fileList?.item(0);
          if (!file) {
            return;
          }
          const preview = URL.createObjectURL(file);
          setLocalPreview(preview);
          setUploadError(null);
          setUploading(true);
          try {
            const media = await uploadMedia({ file, scope });
            const nextValue: AvatarVariantIds = {
              originalId: media.originalId,
              mobileId: media.mobileId ?? media.originalId,
              thumbId: media.thumbId ?? media.originalId,
              groupId: media.groupId,
            };
            field.onChange(nextValue);
            setLocalPreview(null);
          } catch (err) {
            setUploadError(err instanceof Error ? err.message : "Upload failed");
            setLocalPreview(null);
          } finally {
            URL.revokeObjectURL(preview);
            setUploading(false);
          }
        };

        const handleSelectClick = () => {
          if (disabled) return;
          inputRef.current?.click();
        };

        const handleRemove = () => {
          setLocalPreview(null);
          setUploadError(null);
          field.onChange(null);
        };

        return (
          <Stack direction="row" gap={2} alignItems="center">
            <Box sx={{ position: "relative", width: DEFAULT_AVATAR_SIZE, height: DEFAULT_AVATAR_SIZE }}>
              <Avatar
                src={previewUrl}
                sx={{ width: DEFAULT_AVATAR_SIZE, height: DEFAULT_AVATAR_SIZE }}
              >
                {label ? undefined : ""}
              </Avatar>
              {uploading && (
                <Box
                  sx={{
                    inset: 0,
                    position: "absolute",
                    bgcolor: "rgba(var(--mui-palette-common-onBackgroundChannel) / 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                  }}
                >
                  <CircularProgress size={32} />
                </Box>
              )}
            </Box>

            <Stack gap={0.5} flex={1}>
              {label && (
                <Typography variant="subtitle2" color={error ? "error" : undefined}>
                  {label}
                </Typography>
              )}

              <Stack direction="row" gap={1}>
                <Button variant="outlined" onClick={handleSelectClick} disabled={disabled || uploading}>
                  {buttonLabel}
                </Button>
                {(value || localPreview) && (
                  <Button color="secondary" onClick={handleRemove} disabled={disabled || uploading}>
                    Remove
                  </Button>
                )}
              </Stack>

              {(effectiveHelper || error) && (
                <FormHelperText error={!!(error || uploadError)}>{effectiveHelper}</FormHelperText>
              )}
            </Stack>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              disabled={disabled}
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </Stack>
        );
      }}
    />
  );
}
