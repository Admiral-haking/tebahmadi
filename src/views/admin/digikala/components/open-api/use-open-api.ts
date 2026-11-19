"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { dgkOpenApiCatalog } from "@/digikala/constants/open-api-catalog";
import type { Method, WorkflowKey, Preferences, SpecField } from "./types";
import {
    WORKFLOWS, WRITE_METHODS, DEFAULT_PREFERENCES,
} from "./constants";
import {
    extractPlaceholders, fillPathParams, splitPathAndQuery,
    canReturnFile, needsFileUpload, validateJsonBody,
    bodyFieldsFor, fieldsFromSpec, applyPreferenceDefaults,
    buildBodyFromFields, templateFor, stringifyTemplate,
    explainStatus,
} from "./utils";

export type OpenApiState = ReturnType<typeof useOpenApi>;

export function useOpenApi(vendorId: string) {
    const [method, setMethod] = useState<Method>("GET");
    const [path, setPath] = useState("variants?page=1&size=50");
    const [body, setBody] = useState("{}");
    const [bodyFieldValues, setBodyFieldValues] = useState<Record<string, string>>({});
    const [activeWorkflow, setActiveWorkflow] = useState<WorkflowKey>("variant");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedEndpointKey, setSelectedEndpointKey] = useState("");
    const [pathParams, setPathParams] = useState<Record<string, string>>({});
    const [fileFieldName, setFileFieldName] = useState("file");
    const [file, setFile] = useState<File | null>(null);
    const [rawDownload, setRawDownload] = useState(false);
    const [loading, setLoading] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [specFields, setSpecFields] = useState<SpecField[]>([]);
    const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
    const [savingPreferences, setSavingPreferences] = useState(false);
    const [response, setResponse] = useState("");
    const [responseStatus, setResponseStatus] = useState<number | null>(null);

    const resolvedPath = useMemo(() => fillPathParams(path, pathParams), [path, pathParams]);
    const placeholders = useMemo(() => extractPlaceholders(path), [path]);
    const fileUpload = useMemo(() => needsFileUpload(path), [path]);
    const downloadable = useMemo(() => canReturnFile(path), [path]);
    const hasMissingPathParam = useMemo(
        () => placeholders.some((item) => !pathParams[item]?.trim()),
        [pathParams, placeholders],
    );

    const url = useMemo(() => {
        const { path: cleanPath, query: q } = splitPathAndQuery(resolvedPath);
        const params = new URLSearchParams(q);
        params.set("vendorId", vendorId);
        if (rawDownload) params.set("raw", "1");
        return `/api/digikala/open-api/${cleanPath}?${params.toString()}`;
    }, [rawDownload, resolvedPath, vendorId]);

    const filteredCatalog = useMemo(() => {
        const cleanQuery = query.trim().toLowerCase();
        const workflow = WORKFLOWS.find((w) => w.key === activeWorkflow) ?? WORKFLOWS[0];
        return dgkOpenApiCatalog.filter((item) => {
            const groupMatch = (workflow.groups as readonly string[]).includes(item.group);
            const queryMatch =
                !cleanQuery ||
                item.title.toLowerCase().includes(cleanQuery) ||
                item.path.toLowerCase().includes(cleanQuery) ||
                item.method.toLowerCase().includes(cleanQuery);
            return groupMatch && queryMatch;
        });
    }, [activeWorkflow, query]);

    const selectedEndpoint = useMemo(() => {
        if (selectedEndpointKey === "") return null;
        return filteredCatalog[Number(selectedEndpointKey)] ?? null;
    }, [filteredCatalog, selectedEndpointKey]);

    const customBodyFields = useMemo(() => bodyFieldsFor(method, path), [method, path]);
    const bodyFields = useMemo(
        () => (customBodyFields.length ? customBodyFields : fieldsFromSpec(specFields)),
        [customBodyFields, specFields],
    );

    const selectedValue = filteredCatalog[Number(selectedEndpointKey)] ? selectedEndpointKey : "";

    // Load preferences
    useEffect(() => {
        let ignore = false;
        fetch(`/api/digikala/open-api/preferences?vendorId=${encodeURIComponent(vendorId)}`)
            .then(async (res) => {
                if (!res.ok) return;
                const payload = await res.json().catch(() => null);
                if (!ignore && payload) setPreferences((cur) => ({ ...cur, ...(payload?.data ?? {}) }));
            })
            .catch(() => undefined);
        return () => { ignore = true; };
    }, [vendorId]);

    // Load spec fields for write methods
    useEffect(() => {
        if (!selectedEndpoint || method === "GET") { setSpecFields([]); return; }
        let ignore = false;
        const params = new URLSearchParams({ method, path });
        fetch(`/api/digikala/open-api/spec?${params.toString()}`)
            .then(async (res) => {
                if (!res.ok) { if (!ignore) setSpecFields([]); return; }
                const payload = await res.json().catch(() => null);
                if (!ignore) setSpecFields(Array.isArray(payload?.data?.body?.properties) ? payload.data.body.properties : []);
            })
            .catch(() => { if (!ignore) setSpecFields([]); });
        return () => { ignore = true; };
    }, [method, path, selectedEndpoint]);

    useEffect(() => {
        if (!selectedEndpoint || method === "GET" || customBodyFields.length > 0 || specFields.length === 0) return;
        setBodyFieldValues((cur) => ({
            ...applyPreferenceDefaults(fieldsFromSpec(specFields), preferences),
            ...cur,
        }));
    }, [customBodyFields.length, method, preferences, selectedEndpoint, specFields]);

    function applyEndpoint(index: string) {
        const endpoint = filteredCatalog[Number(index)];
        if (!endpoint) return;
        setSelectedEndpointKey(index);
        setMethod(endpoint.method);
        setPath(endpoint.path);
        setBody(templateFor(endpoint.method, endpoint.path));
        setBodyFieldValues(applyPreferenceDefaults(bodyFieldsFor(endpoint.method, endpoint.path), preferences));
        setPathParams({});
        setFile(null);
        setRawDownload(canReturnFile(endpoint.path));
        setResponse("");
        setResponseStatus(null);
    }

    function resetToWorkflow(nextWorkflow: WorkflowKey) {
        setActiveWorkflow(nextWorkflow);
        setSelectedEndpointKey("");
        setPathParams({});
        setBody("{}");
        setBodyFieldValues({});
        setResponse("");
        setResponseStatus(null);
        setFile(null);
        setQuery("");
    }

    async function handleSavePreferences() {
        setSavingPreferences(true);
        try {
            const res = await fetch("/api/digikala/open-api/preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vendorId, ...preferences }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload?.error || "save_failed");
            toast.success("تنظیمات ذخیره شد.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "ذخیره ناموفق.");
        } finally {
            setSavingPreferences(false);
        }
    }

    function handleBuildBodyFromForm() {
        try {
            const missing = bodyFields.filter((f) => f.required && !bodyFieldValues[f.key]?.trim());
            if (missing.length) { toast.error(`فیلدهای اجباری: ${missing.map((f) => f.label).join("، ")}`); return; }
            setBody(stringifyTemplate(buildBodyFromFields(bodyFields, bodyFieldValues)));
            toast.success("اطلاعات از فرم ساخته شد.");
        } catch {
            toast.error("یکی از فیلدهای JSON معتبر نیست.");
        }
    }

    async function handleAiFill() {
        if (!selectedEndpoint) { toast.error("اول یک عملیات انتخاب کنید."); return; }
        if (!aiPrompt.trim()) { toast.error("در کادر هوش مصنوعی توضیح دهید چه کاری می‌خواهید."); return; }

        setAiLoading(true);
        try {
            const res = await fetch("/api/digikala/open-api/assist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method, path, title: selectedEndpoint.title, adminText: aiPrompt, currentPathParams: pathParams, currentBodyFields: bodyFieldValues }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload?.error || "ai_fill_failed");
            const data = payload?.data ?? {};
            if (data.pathParams) setPathParams((cur) => ({ ...cur, ...data.pathParams }));
            if (data.bodyFieldValues) setBodyFieldValues((cur) => ({ ...cur, ...data.bodyFieldValues }));
            if (Array.isArray(data.warningsFa) && data.warningsFa.length) {
                toast.warning(data.warningsFa.join(" | "));
            } else {
                toast.success(data.explanationFa || "فیلدها پر شدند.");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "پر کردن با هوش مصنوعی ناموفق.");
        } finally {
            setAiLoading(false);
        }
    }

    async function handleSend() {
        const unresolved = extractPlaceholders(resolvedPath);
        if (unresolved.length) { toast.error(`شناسه‌های مسیر کامل نیست: ${unresolved.join(", ")}`); return; }

        let nextBody = body;
        if (method !== "GET" && bodyFields.length > 0) {
            const missing = bodyFields.filter((f) => f.required && !bodyFieldValues[f.key]?.trim());
            if (missing.length) { toast.error(`فیلدهای اجباری: ${missing.map((f) => f.label).join("، ")}`); return; }
            try {
                nextBody = stringifyTemplate(buildBodyFromFields(bodyFields, bodyFieldValues));
                setBody(nextBody);
            } catch { toast.error("یکی از فیلدهای فرم معتبر نیست."); return; }
        }
        if (method !== "GET" && !fileUpload && !validateJsonBody(nextBody)) { toast.error("اطلاعات درخواست معتبر نیست."); return; }
        if (method !== "GET" && fileUpload && !file) { toast.error("برای این عملیات باید فایل انتخاب شود."); return; }
        if (WRITE_METHODS.has(method)) {
            const confirmed = window.confirm("این عملیات می‌تواند اطلاعات دیجیکالا را تغییر دهد. ادامه می‌دهید؟");
            if (!confirmed) return;
        }

        setLoading(true);
        setResponse("");
        setResponseStatus(null);

        try {
            const init: RequestInit = { method };
            if (method !== "GET" && fileUpload && file) {
                const form = new FormData();
                form.append(fileFieldName.trim() || "file", file);
                try {
                    const extra = JSON.parse(nextBody.trim() || "{}") as Record<string, unknown>;
                    Object.entries(extra).forEach(([k, v]) => { if (v !== undefined && v !== null) form.append(k, typeof v === "string" ? v : JSON.stringify(v)); });
                } catch { toast.error("اطلاعات درخواست معتبر نیست"); return; }
                init.body = form;
            } else if (method !== "GET") {
                init.headers = { "Content-Type": "application/json" };
                init.body = nextBody.trim() || "{}";
            }

            const res = await fetch(url, init);
            setResponseStatus(res.status);

            if (rawDownload && res.ok) {
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = objectUrl;
                a.download = "digikala-export";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(objectUrl);
                setResponse(JSON.stringify({ ok: true, status: res.status, downloaded: true }, null, 2));
                toast.success("فایل دریافت شد");
                return;
            }

            const payload = await res.json().catch(() => null);
            setResponse(JSON.stringify(payload, null, 2));
            if (!res.ok) toast.error(explainStatus(res.status));
            else toast.success("پاسخ دریافت شد");
        } catch (error) {
            setResponse(JSON.stringify({ error: error instanceof Error ? error.message : error }, null, 2));
            toast.error("خطا در ارسال درخواست");
        } finally {
            setLoading(false);
        }
    }

    return {
        // state
        method, path, body, bodyFieldValues, activeWorkflow, showAdvanced,
        query, selectedEndpointKey, pathParams, fileFieldName, file,
        rawDownload, loading, aiPrompt, aiLoading, preferences,
        savingPreferences, response, responseStatus,
        // derived
        resolvedPath, placeholders, fileUpload, downloadable, hasMissingPathParam,
        url, filteredCatalog, selectedEndpoint, bodyFields, selectedValue,
        // setters
        setMethod, setPath, setBody, setBodyFieldValues, setShowAdvanced,
        setQuery, setPathParams, setFileFieldName, setFile, setRawDownload,
        setAiPrompt, setPreferences,
        // actions
        applyEndpoint, resetToWorkflow, handleSavePreferences,
        handleBuildBodyFromForm, handleAiFill, handleSend,
    };
}
