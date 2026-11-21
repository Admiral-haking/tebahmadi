'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Autocomplete, Grid, TextField } from '@mui/material';

import { useCart, type CartAddress } from './useCart';
import { useAuth } from '@/auth';
import { isValidIranMobile, isValidIranPostalCode, normalizeDigits } from '@/lib/format';
import { PROVINCE_NAMES, getCitiesByProvinceName, isCityInProvince } from '@/utils/location';

const emptyAddress: CartAddress = {
  fname: '',
  lname: '',
  phone: '',
  state: '',
  city: '',
  address: '',
  postalCode: '',
};
let timeout: ReturnType<typeof setTimeout> | null = null;

export default function AddressForm() {
  const { state, setAddress } = useCart();
  const [values, setValues] = useState<CartAddress>(state.address ?? emptyAddress);
  const [touched, setTouched] = useState<Partial<Record<keyof CartAddress, boolean>>>({});

  const { user } = useAuth();

  useEffect(() => {
    const candidateState = state.address?.state ?? emptyAddress.state;
    const normalizedState = candidateState && PROVINCE_NAMES.includes(candidateState) ? candidateState : '';

    const candidateCity = state.address?.city ?? emptyAddress.city;
    const normalizedCity =
      normalizedState && isCityInProvince(candidateCity, normalizedState) ? candidateCity ?? '' : '';

    setValues({
      fname: state.address?.fname || emptyAddress.fname,
      lname: state.address?.lname || emptyAddress.lname,
      state: normalizedState,
      city: normalizedCity,
      address: user?.address || state.address?.address || emptyAddress.address,
      phone: state.address?.phone || emptyAddress.phone,
      postalCode: state.address?.postalCode || '',
    });
  }, [state.address, user?.address]);

  useEffect(() => {
    const candidateState = user?.state ?? state.address?.state ?? emptyAddress.state;
    const normalizedState = candidateState && PROVINCE_NAMES.includes(candidateState) ? candidateState : '';

    const candidateCity = user?.city ?? state.address?.city ?? emptyAddress.city;
    const normalizedCity =
      normalizedState && isCityInProvince(candidateCity, normalizedState) ? candidateCity ?? '' : '';

    setValues({
      fname: user?.fname || state.address?.fname || emptyAddress.fname,
      lname: user?.lname || state.address?.lname || emptyAddress.lname,
      state: normalizedState,
      city: normalizedCity,
      address: user?.address || state.address?.address || emptyAddress.address,
      phone: user?.phone || state.address?.phone || emptyAddress.phone,
      postalCode: state.address?.postalCode || '',
    });
  }, [user, state.address]);

  const cityOptions = useMemo(() => getCitiesByProvinceName(values.state), [values.state]);

  useEffect(() => {
    setValues((prev) => {
      if (!prev.state) {
        if (prev.city) {
          return { ...prev, city: '' };
        }
        return prev;
      }
      if (prev.city && !isCityInProvince(prev.city, prev.state)) {
        return { ...prev, city: '' };
      }
      return prev;
    });
  }, [values.state, values.city]);

  useEffect(() => {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      const hasAnyValue = Object.values(values).some((value) => value && value.toString().trim().length > 0);
      if (!hasAnyValue) {
        setAddress(null);
        return;
      }
      setAddress(values);
    }, 500);
  }, [values.fname, values.lname, values.city, values.address, values.state, values.phone, values.postalCode]);

  const handleChange = (field: keyof CartAddress) => (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const value = field === 'phone' || field === 'postalCode' ? normalizeDigits(raw) : raw;
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: keyof CartAddress) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleStateSelect = (_: unknown, newValue: string | null) => {
    setValues((prev) => {
      const nextState = newValue ?? '';
      if (prev.state === nextState) {
        return prev;
      }
      const preserveCity = nextState && isCityInProvince(prev.city, nextState);
      return {
        ...prev,
        state: nextState,
        city: preserveCity ? prev.city : '',
      };
    });
  };

  const handleCitySelect = (_: unknown, newValue: string | null) => {
    setValues((prev) => {
      const nextCity = newValue ?? '';
      if (prev.city === nextCity) {
        return prev;
      }
      return { ...prev, city: nextCity };
    });
  };

  const fnameError = touched.fname && !values.fname.trim() ? 'لطفاً نام گیرنده را وارد کنید.' : '';
  const lnameError = touched.lname && !values.lname.trim() ? 'لطفاً نام خانوادگی را وارد کنید.' : '';
  const phoneError = touched.phone
    ? !values.phone.trim()
      ? 'شماره تماس الزامی است.'
      : !isValidIranMobile(values.phone)
        ? 'شماره موبایل معتبر وارد کنید (مثال: 09123456789).'
        : ''
    : '';
  const postalError =
    touched.postalCode && values.postalCode && values.postalCode.trim().length > 0 && !isValidIranPostalCode(values.postalCode)
      ? 'کد پستی باید ۱۰ رقم باشد.'
      : '';

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          label="نام *"
          value={values.fname}
          onChange={handleChange('fname')}
          onBlur={handleBlur('fname')}
          error={Boolean(fnameError)}
          helperText={fnameError || undefined}
          fullWidth
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          label="نام خانوادگی *"
          value={values.lname}
          onChange={handleChange('lname')}
          onBlur={handleBlur('lname')}
          error={Boolean(lnameError)}
          helperText={lnameError || undefined}
          fullWidth
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          label="شماره تماس *"
          value={values.phone}
          onChange={handleChange('phone')}
          onBlur={handleBlur('phone')}
          error={Boolean(phoneError)}
          helperText={phoneError || undefined}
          fullWidth
          inputProps={{ dir: 'ltr', inputMode: 'tel', style: { direction: 'ltr', textAlign: 'left' } }}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <Autocomplete
          options={PROVINCE_NAMES}
          value={values.state || null}
          onChange={handleStateSelect}
          renderInput={(params) => <TextField {...params} label="استان" fullWidth />}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <Autocomplete
          options={cityOptions}
          value={values.city || null}
          onChange={handleCitySelect}
          disabled={!values.state}
          renderInput={(params) => <TextField {...params} label="شهر" fullWidth />}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          label="کد پستی (اختیاری)"
          value={values.postalCode ?? ''}
          onChange={handleChange('postalCode')}
          onBlur={handleBlur('postalCode')}
          error={Boolean(postalError)}
          helperText={postalError || '۱۰ رقم بدون خط تیره (اختیاری)'}
          fullWidth
          inputProps={{ dir: 'ltr', inputMode: 'numeric', style: { direction: 'ltr', textAlign: 'left' } }}
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <TextField
          label="آدرس کامل پستی"
          value={values.address ?? ''}
          onChange={handleChange('address')}
          fullWidth
          multiline
          minRows={3}
        />
      </Grid>
    </Grid>
  );
}

