'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Autocomplete, Grid, TextField } from '@mui/material';

import { useCart, type CartAddress } from './useCart';
import { useAuth } from '@/auth';
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
let timeout: any = null
export default function AddressForm() {
  const { state, setAddress } = useCart();
  const [values, setValues] = useState<CartAddress>(state.address ?? emptyAddress);

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
  }, [state.address]);
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
  }, [user]);

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
    clearTimeout(timeout);

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
    const value = event.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
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

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label="نام" value={values.fname} onChange={handleChange('fname')} fullWidth />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label="نام خانوادگی" value={values.lname} onChange={handleChange('lname')} fullWidth />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          label="شماره تماس"
          value={values.phone}
          onChange={handleChange('phone')}
          fullWidth
          inputProps={{ dir: 'ltr', inputMode: 'tel' }}
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
          fullWidth
          helperText="اختیاری"
          inputProps={{ dir: 'ltr', inputMode: 'numeric' }}
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <TextField
          label="آدرس کامل"
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
