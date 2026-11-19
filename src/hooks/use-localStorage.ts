"use client";
import { useEffect, useState } from "react";

export default function useLocalStorage(key: string, defaultValue?: string) {
    const [state, setState] = useState(() => typeof window === 'undefined' ? defaultValue || null : localStorage.getItem(key) || defaultValue || null);

    useEffect(() => {
        if (!state) return;
        localStorage.setItem(key, state);
    }, [state]);

    return [state, setState] as const
}