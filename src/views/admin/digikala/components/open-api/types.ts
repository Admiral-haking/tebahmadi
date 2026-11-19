export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type BodyField = {
    key: string;
    label: string;
    helper: string;
    type: "text" | "number" | "boolean" | "json" | "datetime";
    required?: boolean;
    defaultValue?: string;
};

export type Preferences = {
    callbackUrl: string;
    defaultWarehouseId: string;
    defaultBoxSizeId: string;
    defaultCityIds: string;
    defaultTimeScopeIds: string;
    defaultCancellationReasonId: string;
    defaultLeadTime: string;
    questionAnswerTemplate: string;
};

export type SpecField = {
    key: string;
    type?: string | null;
    description?: string;
    example?: unknown;
    required?: boolean;
};

export type WorkflowKey =
    | "product"
    | "variant"
    | "orders"
    | "qa"
    | "pricing"
    | "shipping"
    | "profile";

export type EndpointGuide = {
    purpose: string;
    tip: string;
    risk: string;
    requiredPath: string[];
    requiredBody: string[];
    titleFa: string;
};
