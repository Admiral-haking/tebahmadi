"use client";

import { useEffect, useMemo, useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import type { AuthUser } from "@/auth";
import { Form } from "@/components/hook-form";
import { RHFTextField, RHFAutocomplete, RHFUploadAvatar } from "@/components/hook-form";
import { PROVINCES } from "@/data/provinces";
import { CITIES } from "@/data/cities";
import type { AvatarVariantIds } from "@/types";

interface ProfileFormProps {
  user: AuthUser;
  onSuccess: (nextUser: AuthUser) => void;
}

const avatarSchema = z.object({
  originalId: z.string(),
  mobileId: z.string(),
  thumbId: z.string(),
  groupId: z.string(),
});

const optionalTextField = (label: string, max = 100) =>
  z
    .string()
    .trim()
    .max(max, `${label} حداکثر ${max} کاراکتر باشد`)
    .optional()
    .or(z.literal(""));

const profileSchema = z.object({
  fname: optionalTextField("نام"),
  lname: optionalTextField("نام خانوادگی"),
  age: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), "سن فقط باید شامل اعداد باشد")
    .refine((value) => value === "" || (Number(value) >= 0 && Number(value) <= 120), "سن باید بین ۰ تا ۱۲۰ باشد"),
  state: optionalTextField("استان"),
  city: optionalTextField("شهر"),
  address: optionalTextField("آدرس", 255),
  avatar: avatarSchema.optional().nullable(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

function buildDefaultValues(user: AuthUser): ProfileFormValues {
  return {
    fname: user.fname ?? "",
    lname: user.lname ?? "",
    age: user.age != null ? String(user.age) : "",
    state: user.state ?? "",
    city: user.city ?? "",
    address: user.address ?? "",
    avatar: user.avatar ?? null,
  };
}

function sanitizePayload(values: ProfileFormValues, currentAvatar: AvatarVariantIds | undefined | null): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  const setIfFilled = (key: keyof ProfileFormValues, max?: number) => {
    const value = values[key];
    if (typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    payload[key] = max ? trimmed.slice(0, max) : trimmed;
  };

  setIfFilled("fname", 100);
  setIfFilled("lname", 100);
  setIfFilled("state", 100);
  setIfFilled("city", 100);
  setIfFilled("address", 255);

  if (values.age.trim()) {
    payload.age = Number(values.age.trim());
  }

  if (values.avatar) {
    const avatarChanged =
      !currentAvatar ||
      currentAvatar.originalId !== values.avatar.originalId ||
      currentAvatar.mobileId !== values.avatar.mobileId ||
      currentAvatar.thumbId !== values.avatar.thumbId ||
      currentAvatar.groupId !== values.avatar.groupId;

    if (avatarChanged) {
      payload.avatar = values.avatar;
    }
  }

  return payload;
}

export function ProfileForm({ user, onSuccess }: ProfileFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const methods = useForm<any>({
    resolver: zodResolver(profileSchema),
    defaultValues: buildDefaultValues(user),
  });

  const {
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    reset(buildDefaultValues(user));
    setFormError(null);
  }, [user, reset]);

  const stateValue = useWatch({ control, name: "state" });
  const cityValue = useWatch({ control, name: "city" });

  const provinceNames = useMemo(() => PROVINCES.map((province) => province.name), []);

  const cityOptions = useMemo(() => {
    const province = PROVINCES.find((item) => item.name === stateValue);
    if (!province) {
      return [] as string[];
    }
    return CITIES.filter((city) => city.province_id === province.id).map((city) => city.name);
  }, [stateValue]);

  useEffect(() => {
    if (!stateValue) {
      if (cityValue) {
        setValue("city", "", { shouldValidate: true });
      }
      return;
    }

    const province = PROVINCES.find((item) => item.name === stateValue);
    if (!province) {
      setValue("city", "", { shouldValidate: true });
      return;
    }

    const exists = CITIES.some((city) => city.name === cityValue && city.province_id === province.id);
    if (!exists && cityValue) {
      setValue("city", "", { shouldValidate: true });
    }
  }, [stateValue, cityValue, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const payload = sanitizePayload(values, user.avatar ?? null);

    if (Object.keys(payload).length === 0) {
      toast.info("تغییری برای ذخیره وجود ندارد.");
      return;
    }

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        try {
          const data = (await response.json()) as { error?: string };
          const message = data?.error ?? response.statusText ?? "خطایی رخ داد";
          setFormError(message);
          toast.error(message);
        } catch {
          const message = response.statusText || "خطایی رخ داد";
          setFormError(message);
          toast.error(message);
        }
        return;
      }

      const data = (await response.json()) as { user: AuthUser };
      onSuccess(data.user);
      reset(buildDefaultValues(data.user));
      toast.success("اطلاعات با موفقیت ذخیره شد.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "خطایی رخ داد";
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <Accordion
      disableGutters
      sx={{
        bgcolor: "background.paper",
        boxShadow: "none",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
              <path fill="currentColor" d="m12 15l-5-5h10z" />
            </svg>
          </Box>
        }
      >
        <Typography fontWeight={600}>ویرایش پروفایل</Typography>
      </AccordionSummary>

      <AccordionDetails>
        <Form methods={methods} onSubmit={onSubmit}>
          <Stack spacing={2}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}

            <RHFUploadAvatar name="avatar" label="تصویر پروفایل" />

            <Stack spacing={2}>
              <RHFTextField name="fname" label="نام" />
              <RHFTextField name="lname" label="نام خانوادگی" />
              <RHFTextField
                name="age"
                label="سن"
              />
              <RHFAutocomplete name="state" options={provinceNames} label="استان" />
              <RHFAutocomplete name="city" options={cityOptions} label="شهر" disabled={!stateValue} />
              <RHFTextField name="address" label="آدرس" multiline minRows={3} />
            </Stack>

            <Box>
              <Button type="submit" variant="contained" disabled={isSubmitting} startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}>
                {isSubmitting ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </Button>
            </Box>
          </Stack>
        </Form>
      </AccordionDetails>
    </Accordion>
  );
}

export default ProfileForm;
