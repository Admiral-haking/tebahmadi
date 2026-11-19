import { parse } from "yaml";

import type { DgkOpenApiMethod } from "./open-api";

const SPEC_URL = "https://seller.digikala.com/open-api/v1/doc/specification.yml";
const CACHE_TTL_MS = 6 * 60 * 60_000;

type OpenApiOperation = {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: Array<{
    in?: string;
    name?: string;
    description?: string | null;
    required?: boolean | string;
    example?: unknown;
    schema?: {
      type?: string | null;
      enum?: unknown[];
      default?: unknown;
      example?: unknown;
    };
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, {
      schema?: {
        type?: string;
        properties?: Record<string, unknown>;
        required?: string[];
        example?: unknown;
      };
      example?: unknown;
    }>;
  } | null;
};

type OpenApiDocument = {
  paths?: Record<string, Partial<Record<Lowercase<DgkOpenApiMethod>, OpenApiOperation>>>;
};

type CachedSpec = {
  loadedAt: number;
  document: OpenApiDocument;
};

let cachedSpec: CachedSpec | null = null;

function normalizePath(path: string | string[]) {
  const joined = Array.isArray(path) ? path.join("/") : path;
  const clean = joined
    .replace(/^\/+/, "")
    .replace(/^open-api\/v1\/?/, "")
    .replace(/\?.*$/, "")
    .trim();

  return `/open-api/v1/${clean}`.replace(/\/$/, clean ? "" : "/");
}

async function loadSpecDocument() {
  if (cachedSpec && Date.now() - cachedSpec.loadedAt < CACHE_TTL_MS) {
    return cachedSpec.document;
  }

  const response = await fetch(SPEC_URL, {
    headers: { Accept: "application/yaml,text/yaml,text/plain,*/*" },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`digikala_openapi_spec_${response.status}`);
  }

  const text = await response.text();
  const document = parse(text) as OpenApiDocument;
  cachedSpec = { loadedAt: Date.now(), document };
  return document;
}

function bodyContent(operation?: OpenApiOperation) {
  return operation?.requestBody?.content?.["application/json"] ?? Object.values(operation?.requestBody?.content ?? {})[0];
}

export async function getDgkOpenApiOperation(method: DgkOpenApiMethod, path: string | string[]) {
  const document = await loadSpecDocument();
  const normalizedPath = normalizePath(path);
  const operation = document.paths?.[normalizedPath]?.[method.toLowerCase() as Lowercase<DgkOpenApiMethod>] ?? null;
  const content = bodyContent(operation ?? undefined);

  return {
    path: normalizedPath,
    method,
    operation,
    requestBody: operation?.requestBody ?? null,
    bodySchema: content?.schema ?? null,
    bodyExample: content?.example ?? content?.schema?.example ?? null,
    parameters: (operation?.parameters ?? []).filter((param) => param.in !== "header"),
    requiredBodyFields: content?.schema?.required ?? [],
    sourceUrl: SPEC_URL,
  };
}

export async function getDgkOpenApiSpecSummary(method: DgkOpenApiMethod, path: string | string[]) {
  const details = await getDgkOpenApiOperation(method, path);
  const properties = details.bodySchema?.properties ?? {};

  return {
    path: details.path,
    method: details.method,
    title: details.operation?.summary || details.operation?.tags?.[0] || "",
    description: details.operation?.description || "",
    parameters: details.parameters.map((param) => ({
      in: param.in,
      name: param.name,
      description: param.description,
      required: param.required === true || param.required === "true",
      example: param.example ?? param.schema?.example ?? param.schema?.default ?? null,
      type: param.schema?.type ?? null,
      enum: param.schema?.enum ?? null,
    })),
    body: {
      required: details.requestBody?.required === true,
      requiredFields: details.requiredBodyFields,
      example: details.bodyExample,
      properties: Object.entries(properties).map(([key, value]) => {
        const schema = value as {
          type?: string;
          description?: string;
          example?: unknown;
          enum?: unknown[];
          items?: unknown;
        };
        return {
          key,
          type: schema.type ?? null,
          description: schema.description ?? "",
          example: schema.example ?? null,
          enum: schema.enum ?? null,
          required: details.requiredBodyFields.includes(key),
        };
      }),
    },
    sourceUrl: details.sourceUrl,
  };
}
