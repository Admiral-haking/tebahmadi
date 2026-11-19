"use client";

import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { CacheProvider } from '@emotion/react';


type RTLProps = {
    children: React.ReactNode;
};

const cacheRtl = createCache({
    key: 'rtl',
    prepend: true,
    stylisPlugins: [rtlPlugin],
});

export function RTL({ children }: RTLProps) {

    return <CacheProvider value={cacheRtl}>{children}</CacheProvider>
}
