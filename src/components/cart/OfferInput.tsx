'use client';

import { useState, useEffect } from 'react';
import { Button, Stack, TextField } from '@mui/material';

import { useCart } from './useCart';

export default function OfferInput() {
  const { state, setOfferCode } = useCart();
  const [code, setCode] = useState(state.offerCode ?? '');

  useEffect(() => {
    setCode(state.offerCode ?? '');
  }, [state.offerCode]);

  useEffect(() => {

    const offerX = localStorage.getItem("offerX");

    if (!offerX) return;

    setOfferCode(offerX)
  }, [])

  const handleApply = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setOfferCode(null);
      return;
    }
    setOfferCode(trimmed);
  };

  const handleRemove = () => {
    setCode('');
    setOfferCode(null);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        label="کد تخفیف"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        fullWidth
        inputProps={{ dir: 'ltr' }}
      />
      <Button variant="contained" onClick={handleApply}>
        ثبت
      </Button>
      {state.offerCode ? (
        <Button variant="text" color="error" onClick={handleRemove}>
          حذف
        </Button>
      ) : null}
    </Stack>
  );
}
