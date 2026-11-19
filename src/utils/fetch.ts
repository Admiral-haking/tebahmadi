
let fetcher: any = fetch;
// Or use undici.fetch with custom configuration
if (typeof window === 'undefined') {
    const globals = globalThis as typeof globalThis & { File?: typeof File };
    if (!globals.File) {
        const nodeRequire = eval("require") as NodeRequire;
        const { File: NodeFile } = nodeRequire("node:buffer") as typeof import("node:buffer");
        globals.File = NodeFile as unknown as typeof File;
    }

    const nodeRequire = eval("require") as NodeRequire;
    const { markAsUncloneable } = nodeRequire("node:worker_threads") as { markAsUncloneable?: unknown };

    if (typeof markAsUncloneable === "function") {
        import('undici').then(({ setGlobalDispatcher, fetch, ProxyAgent }) => {
            const proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy || '';
            if (proxyUrl) {
                console.log('[Fetch] Using proxy:', proxyUrl);
                try {
                    const proxyAgent = new ProxyAgent(proxyUrl);
                    setGlobalDispatcher(proxyAgent);
                    console.log('[Fetch] ProxyAgent mounted successfully!');
                } catch (e) {
                    console.warn('[Fetch] Failed to create ProxyAgent, falling back to direct:', e);
                    import('undici').then(({ Agent }) => {
                        const agent = new Agent({ keepAliveTimeout: 60000, connect: { timeout: 30000 } });
                        setGlobalDispatcher(agent);
                    }).catch(e2 => {
                        console.error('[Fetch] Critical: Cannot load undici fallback:', e2);
                    });
                }
            } else {
                console.log('[Fetch] No proxy configured, using direct connection');
                import('undici').then(({ Agent }) => {
                    const agent = new Agent({ keepAliveTimeout: 60000, connect: { timeout: 30000 } });
                    setGlobalDispatcher(agent);
                }).catch(e2 => {
                    console.error('[Fetch] Critical: Cannot load undici fallback:', e2);
                });
            }
            fetcher = fetch;
            console.log('undici mounted!');
        })
    } else if (process.env.HTTP_PROXY || process.env.http_proxy) {
        console.warn('[Fetch] Skipping external undici dispatcher because this Node.js runtime lacks markAsUncloneable; using native fetch.');
    }
}

class FetchError extends Error {
    status: number = 500;
    data: string | Record<string, any> = {}
    constructor(message: string) {
        super(message)
    }
}

const MAX_RETRIES = 10;
const RETRIES_DELAY = 1e3 * 3;
const RETRIES_STATUS = [504, 502, 429];
const RATE_LIMIT_RETRY_DELAY = 2e3;

export default async function Fetch<T = any>(input: string, init: RequestInit = {}, retries = 0, rateDelay = RATE_LIMIT_RETRY_DELAY) {

    const isLastTry = retries >= MAX_RETRIES;

    try {


        const response = typeof window === 'undefined' ? await fetcher(input, {
            ...init,
        }) : await fetch(input, {
            ...(init as any),
        });


        let data;
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch { }
        } else {
            data = await response.text();
        }

        if (!response.ok) {

            const retryError = RETRIES_STATUS.find(x => x === response.status);

            if (retryError && !isLastTry) {
                await new Promise(res => setTimeout(res, retryError === 429 ? rateDelay : RETRIES_DELAY))
                return Fetch<T>(input, init, retries + 1, rateDelay * 2)
            }

            const error = new FetchError(`Request Failed With Status ${response.status}`);

            error.status = response.status;

            error.data = data as any;

            throw error
        }

        return data as T;
    } catch (err: any) {
        const errorCode = err?.cause?.code || err?.code;

        // Note: don't dump err.data here — for non-JSON failures (e.g. an
        // upstream Tomcat 404 HTML page) it floods the logs on every retry.
        // Callers already record failures via logErrorLater.
        if (errorCode === 'UND_ERR_CONNECT_TIMEOUT' && !isLastTry) {
            console.log("time out is trigged, retrying after ", RETRIES_DELAY / 1e3, "sec");
            await new Promise(res => setTimeout(res, RETRIES_DELAY))
            return Fetch<T>(input, init, retries + 1)
        }
        throw err;
    }
}


export function Get<T = any>(input: string, headers: HeadersInit = {}) {
    return Fetch<T>(input, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...headers
        },

        method: "GET"
    })
}
export function DELETE<T = any>(input: string, headers: HeadersInit = {}, body?: Record<string, any>,) {
    return Fetch<T>(input, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...headers
        },
        method: "DELETE",
        body: JSON.stringify(body || {})
    })
}

export function POST<T = any>(input: string, body: Record<string, any>, headers: HeadersInit = {}) {
    return Fetch<T>(input, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...headers
        },
        method: "POST",
        body: JSON.stringify(body)
    })
}
export function PATCH<T = any>(input: string, body: Record<string, any>, headers: HeadersInit = {}) {
    return Fetch<T>(input, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...headers
        },
        method: "PATCH",
        body: JSON.stringify(body)
    })
}

export function PUT<T = any>(input: string, body: Record<string, any>, headers: HeadersInit = {}) {
    return Fetch<T>(input, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...headers
        },
        method: "PUT",
        body: JSON.stringify(body)
    })
}
