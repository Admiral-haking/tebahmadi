"use client";

import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import { toast } from "sonner";
import { RHFSwitch, RHFTextField } from "@/components/hook-form";

type SmartPopupFieldProps = {
  disabled?: boolean;
};

function createEmptyStep() {
  return {
    title: "",
    body: "",
    imageUrl: "",
    imageMediaId: "",
    actionLabel: "",
    actionHref: "",
    aiTextPrompt: "",
    aiImagePrompt: "",
  };
}

function readAiJson(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export default function SmartPopupField({ disabled }: SmartPopupFieldProps) {
  const { control, register, getValues, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "smartPopup.steps",
  });
  const [aiTextIndex, setAiTextIndex] = useState<number | null>(null);
  const [aiImageIndex, setAiImageIndex] = useState<number | null>(null);

  async function improveStepText(index: number) {
    const step = getValues(`smartPopup.steps.${index}`);
    const prompt =
      String(step?.aiTextPrompt ?? "").trim() ||
      `برای پاپ‌آپ فروشگاه طب احمدی، متن فارسی کوتاه و جذاب درباره محصولات طبیعی بساز. عنوان فعلی: ${step?.title || "-"} متن فعلی: ${step?.body || "-"}. خروجی فقط JSON با title و body و actionLabel باشد.`;

    setAiTextIndex(index);
    try {
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "You rewrite Persian ecommerce popup copy. Return strict JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const json = readAiJson(await response.json());
      if (!json) throw new Error("AI response was not JSON");
      if (typeof json.title === "string") setValue(`smartPopup.steps.${index}.title`, json.title, { shouldDirty: true });
      if (typeof json.body === "string") setValue(`smartPopup.steps.${index}.body`, json.body, { shouldDirty: true });
      if (typeof json.actionLabel === "string") setValue(`smartPopup.steps.${index}.actionLabel`, json.actionLabel, { shouldDirty: true });
      toast.success("متن پاپ‌آپ با هوش مصنوعی آماده شد.");
    } catch {
      toast.error("تولید متن هوشمند انجام نشد.");
    } finally {
      setAiTextIndex(null);
    }
  }

  async function generateStepImage(index: number) {
    const step = getValues(`smartPopup.steps.${index}`);
    const prompt = String(step?.aiImagePrompt ?? "").trim();
    if (!prompt) {
      toast.error("برای تولید تصویر، پرامپت تصویر را وارد کنید.");
      return;
    }

    setAiImageIndex(index);
    try {
      const response = await fetch("/api/ai/popup-image", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error(await response.text());
      const json = await response.json();
      if (typeof json.imageUrl === "string") setValue(`smartPopup.steps.${index}.imageUrl`, json.imageUrl, { shouldDirty: true });
      if (typeof json.media?.id === "string") setValue(`smartPopup.steps.${index}.imageMediaId`, json.media.id, { shouldDirty: true });
      toast.success("تصویر پاپ‌آپ تولید و ذخیره شد.");
    } catch {
      toast.error("تولید تصویر هوشمند انجام نشد.");
    } finally {
      setAiImageIndex(null);
    }
  }

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h6" fontWeight={800}>
            پاپ‌آپ هوشمند سایت
          </Typography>
          <Typography variant="body2" color="text.secondary">
            پیام چندمرحله‌ای قابل ویرایش برای صفحات سایت؛ با تغییر نسخه، دوباره برای کاربران نمایش داده می‌شود.
          </Typography>
        </Stack>

        <Alert severity="info" variant="outlined">
          مسیرها را با کاما جدا کنید. مثال: / ، /store ، /product/* . خالی بودن یعنی همه صفحات عمومی.
        </Alert>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <RHFSwitch name="smartPopup.enabled" label="فعال باشد" disabled={disabled} />
          <RHFSwitch name="smartPopup.showOnce" label="برای هر کاربر فقط یک‌بار" disabled={disabled} />
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <RHFTextField name="smartPopup.version" label="نسخه نمایش" disabled={disabled} fullWidth />
          <RHFTextField name="smartPopup.delayMs" label="تاخیر نمایش (میلی‌ثانیه)" type="number" disabled={disabled} fullWidth />
          <RHFTextField name="smartPopup.pagesText" label="صفحات نمایش" disabled={disabled} fullWidth />
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          {fields.map((field, index) => (
            <Box key={field.id} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="subtitle2" fontWeight={800}>
                    مرحله {index + 1}
                  </Typography>
                  <Box flex="1 1 auto" />
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteRoundedIcon />}
                    onClick={() => remove(index)}
                    disabled={disabled || fields.length <= 1}
                  >
                    حذف
                  </Button>
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField label="عنوان" fullWidth disabled={disabled} {...register(`smartPopup.steps.${index}.title`)} />
                  <TextField label="متن دکمه" fullWidth disabled={disabled} {...register(`smartPopup.steps.${index}.actionLabel`)} />
                  <TextField label="لینک دکمه" fullWidth disabled={disabled} {...register(`smartPopup.steps.${index}.actionHref`)} />
                </Stack>

                <TextField
                  label="متن"
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={disabled}
                  {...register(`smartPopup.steps.${index}.body`)}
                />

                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField label="آدرس تصویر" fullWidth disabled={disabled} {...register(`smartPopup.steps.${index}.imageUrl`)} />
                  <TextField label="Media ID" fullWidth disabled={disabled} {...register(`smartPopup.steps.${index}.imageMediaId`)} />
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField label="پرامپت متن AI" fullWidth disabled={disabled} {...register(`smartPopup.steps.${index}.aiTextPrompt`)} />
                  <Button
                    variant="outlined"
                    startIcon={<AutoFixHighRoundedIcon />}
                    onClick={() => improveStepText(index)}
                    disabled={disabled || aiTextIndex !== null}
                  >
                    {aiTextIndex === index ? "در حال تولید..." : "بهبود متن"}
                  </Button>
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField label="پرامپت تصویر AI" fullWidth disabled={disabled} {...register(`smartPopup.steps.${index}.aiImagePrompt`)} />
                  <Button
                    variant="outlined"
                    startIcon={<ImageRoundedIcon />}
                    onClick={() => generateStepImage(index)}
                    disabled={disabled || aiImageIndex !== null}
                  >
                    {aiImageIndex === index ? "در حال تصویر..." : "تولید تصویر"}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>

        <Button
          variant="outlined"
          startIcon={<AddRoundedIcon />}
          onClick={() => append(createEmptyStep())}
          disabled={disabled}
        >
          افزودن مرحله
        </Button>
      </Stack>
    </Box>
  );
}
