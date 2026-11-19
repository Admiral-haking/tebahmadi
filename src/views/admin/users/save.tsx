'use client';

import { useEffect, useMemo, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Form, RHFTextField, RHFAutocomplete, RHFUploadAvatar } from '@/components/hook-form';
import { PROVINCES } from '@/data/provinces';
import { CITIES } from '@/data/cities';
import type { AvatarVariantIds } from '@/types';

const ROLE_VALUES = ['admin', 'manager', 'staff', 'customer'] as const;
const PERMISSION_VALUES = [
    'users:read',
    'users:write',
    'media:read',
    'media:write',
    'media:read:all',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'promotions:write',
    'catalog:publish',
] as const;
// -----------------------------
// Types
// -----------------------------
export type UserDTO = {
    id?: string;
    phone: string;
    fname?: string | null;
    lname?: string | null;
    age?: number | null;
    state?: string | null;
    city?: string | null;
    address?: string | null;
    avatar?: AvatarVariantIds | null;
    roles: Array<(typeof ROLE_VALUES)[number]>;
    permissions?: Array<(typeof PERMISSION_VALUES)[number]>;
};

// -----------------------------
// Zod schema (mirrors your patterns from profile-form)
// -----------------------------
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
        .or(z.literal(''));

const userSaveSchema = z.object({
    phone: z.string().trim().min(1, 'شماره موبایل الزامی است'),
    fname: optionalTextField('نام'),
    lname: optionalTextField('نام خانوادگی'),
    age: z
        .string()
        .trim()
        .refine((v) => v === '' || /^\d+$/.test(v), 'سن فقط باید شامل اعداد باشد')
        .refine((v) => v === '' || (Number(v) >= 0 && Number(v) <= 120), 'سن باید بین ۰ تا ۱۲۰ باشد'),
    state: optionalTextField('استان'),
    city: optionalTextField('شهر'),
    address: optionalTextField('آدرس', 255),
    avatar: avatarSchema.optional().nullable(),
    roles: z.array(z.enum(ROLE_VALUES)).min(1, 'حداقل یک نقش انتخاب کنید'),
    permissions: z.array(z.enum(PERMISSION_VALUES)).optional(),
});

export type UserSaveFormValues = z.infer<typeof userSaveSchema>;

// -----------------------------
// Helpers
// -----------------------------
function buildDefaultValues(user?: UserDTO | null): UserSaveFormValues {
    return {
        phone: user?.phone ?? '',
        fname: user?.fname ?? '',
        lname: user?.lname ?? '',
        age: user?.age != null ? String(user.age) : '',
        state: user?.state ?? '',
        city: user?.city ?? '',
        address: user?.address ?? '',
        avatar: user?.avatar ?? null,
        roles: user?.roles && user.roles.length > 0 ? user.roles : (['customer'] as UserSaveFormValues['roles']),
        permissions: user?.permissions ?? [],
    };
}

/** Only include changed & meaningful fields; trim/normalize. */
function sanitizePayload(values: UserSaveFormValues, current: UserDTO | null | undefined): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    const setIfFilled = (key: keyof Pick<UserSaveFormValues, 'fname' | 'lname' | 'state' | 'city' | 'address'>, max?: number) => {
        const value = values[key];
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed) return;
        payload[key] = max ? trimmed.slice(0, max) : trimmed;
    };

    // required
    payload.phone = values.phone.trim();

    setIfFilled('fname', 100);
    setIfFilled('lname', 100);
    setIfFilled('state', 100);
    setIfFilled('city', 100);
    setIfFilled('address', 255);

    if (values.age.trim()) {
        payload.age = Number(values.age.trim());
    }

    // avatar (send only if changed)
    if (values.avatar) {
        const a = values.avatar;
        const b = current?.avatar;
        const changed =
            !b ||
            b.originalId !== a.originalId ||
            b.mobileId !== a.mobileId ||
            b.thumbId !== a.thumbId ||
            b.groupId !== a.groupId;
        if (changed) payload.avatar = a;
    }

    // roles (always send; server requires min 1)
    payload.roles = (values.roles ?? []).filter(Boolean);

    // permissions (optional)
    if (values.permissions && values.permissions.length > 0) {
        payload.permissions = values.permissions.filter(Boolean);
    } else {
        payload.permissions = [];
    }

    return payload;
}

// -----------------------------
// Props
// -----------------------------
interface UserSaveProps {
    /** Pass existing user for edit; omit/undefined for create. */
    defaultValues?: UserDTO | null;
}

// -----------------------------
// Component
// -----------------------------
export default function UserSave({ defaultValues = null }: UserSaveProps) {
    const router = useRouter();
    const [formError, setFormError] = useState<string | null>(null);

    const methods = useForm<UserSaveFormValues>({
        resolver: zodResolver(userSaveSchema),
        defaultValues: buildDefaultValues(defaultValues ?? undefined),
    });

    const {
        handleSubmit,
        reset,
        setValue,
        control,
        formState: { isSubmitting },
    } = methods;

    // react to prop changes
    useEffect(() => {
        reset(buildDefaultValues(defaultValues ?? undefined));
        setFormError(null);
    }, [defaultValues, reset]);

    // province/city linkage (same pattern as profile-form)
    const stateValue = useWatch({ control, name: 'state' });
    const cityValue = useWatch({ control, name: 'city' });

    const provinceNames = useMemo(() => PROVINCES.map((p) => p.name), []);

    const cityOptions = useMemo(() => {
        const province = PROVINCES.find((item) => item.name === stateValue);
        if (!province) return [] as string[];
        return CITIES.filter((c) => c.province_id === province.id).map((c) => c.name);
    }, [stateValue]);

    useEffect(() => {
        if (!stateValue) {
            if (cityValue) setValue('city', '', { shouldValidate: true });
            return;
        }
        const province = PROVINCES.find((item) => item.name === stateValue);
        if (!province) {
            setValue('city', '', { shouldValidate: true });
            return;
        }
        const exists = CITIES.some((c) => c.name === cityValue && c.province_id === province.id);
        if (!exists && cityValue) setValue('city', '', { shouldValidate: true });
    }, [stateValue, cityValue, setValue]);

    const isUpdate = Boolean(defaultValues?.id);

    const onSubmit = handleSubmit(async (values) => {
        setFormError(null);

        const payload = sanitizePayload(values, defaultValues ?? null);

        // For create, ensure minimal required fields present
        if (!payload.phone) {
            toast.error('شماره موبایل الزامی است');
            return;
        }

        try {
            const url = isUpdate ? `/api/users/${defaultValues!.id}` : '/api/users';
            const method = isUpdate ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                try {
                    const data = (await response.json()) as { error?: string };
                    const message = data?.error ?? response.statusText ?? 'خطایی رخ داد';
                    setFormError(message);
                    toast.error(message);
                } catch {
                    const message = response.statusText || 'خطایی رخ داد';
                    setFormError(message);
                    toast.error(message);
                }
                return;
            }

            toast.success(isUpdate ? 'کاربر با موفقیت به‌روزرسانی شد.' : 'کاربر با موفقیت ایجاد شد.');
            router.push('/admin/users');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'خطایی رخ داد';
            setFormError(message);
            toast.error(message);
        }
    });

    return (
        <Accordion
            expanded
            disableGutters
            sx={{
                bgcolor: 'background.paper',
                boxShadow: 'none',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                '&:before': { display: 'none' },
            }}
        >
            <AccordionSummary
                expandIcon={
                    <Box
                        component="span"
                        sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                            <path fill="currentColor" d="m12 15l-5-5h10z" />
                        </svg>
                    </Box>
                }
            >
                <Typography fontWeight={600}>{isUpdate ? 'ویرایش کاربر' : 'ایجاد کاربر'}</Typography>
            </AccordionSummary>

            <AccordionDetails>
                <Form methods={methods as any} onSubmit={onSubmit}>
                    <Stack spacing={2}>
                        {formError ? <Alert severity="error">{formError}</Alert> : null}

                        <RHFUploadAvatar name="avatar" label="تصویر پروفایل" />

                        <Stack spacing={2}>
                            <RHFTextField name="phone" label="شماره موبایل *" inputProps={{ dir: 'ltr' }} />
                            <RHFTextField name="fname" label="نام" />
                            <RHFTextField name="lname" label="نام خانوادگی" />
                            <RHFTextField
                                name="age"
                                label="سن"
                                inputProps={{ min: 0, max: 120, inputMode: 'numeric', pattern: '\\d*', dir: 'ltr' }}
                            />

                            <RHFAutocomplete name="state" options={provinceNames} label="استان" />
                            <RHFAutocomplete name="city" options={cityOptions} label="شهر" disabled={!stateValue} />
                            <RHFTextField name="address" label="آدرس" multiline minRows={3} />

                            <RHFAutocomplete
                                name="roles"
                                label="نقش‌ها *"
                                multiple
                                options={ROLE_VALUES as unknown as string[]}
                            />
                            <RHFAutocomplete
                                name="permissions"
                                label="دسترسی‌ها"
                                multiple
                                options={PERMISSION_VALUES as unknown as string[]}
                            />
                        </Stack>

                        <Box>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={isSubmitting}
                                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
                            >
                                {isSubmitting ? 'در حال ذخیره...' : isUpdate ? 'ذخیره تغییرات' : 'ایجاد کاربر'}
                            </Button>
                        </Box>
                    </Stack>
                </Form>
            </AccordionDetails>
        </Accordion>
    );
}
