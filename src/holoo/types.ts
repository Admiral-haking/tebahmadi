/** TypeScript shapes for the Holoo web service (هلو). */

/** Login response wrapper. */
export interface HolooLoginResponse {
    Login: {
        State: "True" | "False";
        Token: string;
        ErrorCode: string;
        Error: string;
    };
}

/** Generic success envelope for write operations (POST/PUT). */
export interface HolooSuccess {
    Header: string;
    Success: {
        Id?: string;
        ErpCode: string;
        ReturnParam1?: string;
        ReturnParam2?: string;
        ReturnParam3?: string;
    };
}

// ---------------------------------------------------------------------------
// Customers (طرف حساب)
// ---------------------------------------------------------------------------
export interface HolooCustomer {
    Code: string;
    Name: string;
    NationalId?: string;
    EconomicId?: string;
    BedSarfasl?: string;
    BesSarfasl?: string;
    IsPurchaser?: string;
    IsSeller?: string;
    IsBlackList?: string;
    Mandeh?: string;
    Credit?: string;
    CustType?: string;
    IsVaseteh?: string;
    VasetehPorsant?: string;
    Tel?: string;
    Mobile?: string;
    Fax?: string;
    City?: string;
    Ostan?: string;
    Mantagheh?: string;
    ZipCode?: string;
    Address?: string;
    Job?: string;
    Email?: string;
    ErpCode: string;
}

export interface HolooCustomerListParams {
    code?: string;
    "code.from"?: string;
    "code.to"?: string;
    purchaser?: boolean;
    seller?: boolean;
    vaseteh?: boolean;
    "date.from"?: string;
    "date.to"?: string;
}

export interface HolooCustomerInput {
    id?: string;
    code?: string;
    name: string;
    ispurchaser: boolean;
    isseller: boolean;
    isvaseteh?: boolean;
    isblacklist?: boolean;
    Credit?: number;
    custtype: 0 | 1;
    bedsarfasl?: string;
    nationalid?: string;
    economicid?: string;
    tel?: string;
    mobile?: string;
    fax?: string;
    city?: string;
    ostan?: string;
    mantagheh?: string;
    email?: string;
    zipcode?: string;
    address?: string;
}

export interface HolooCustomerUpdateInput {
    erpcode: string;
    code?: string;
    name?: string;
    ispurchaser?: boolean;
    isseller?: boolean;
    isvaseteh?: boolean;
    isblacklist?: boolean;
    Credit?: number;
    custtype?: 0 | 1;
    bedsarfasl?: string;
    nationalid?: string;
    economicid?: string;
    tel?: string;
    mobile?: string;
    fax?: string;
    city?: string;
    ostan?: string;
    mantagheh?: string;
    email?: string;
    zipcode?: string;
    address?: string;
}

// ---------------------------------------------------------------------------
// Products (کالا)
// ---------------------------------------------------------------------------
export interface HolooProduct {
    Code: string;
    Name: string;
    Few?: string;
    BuyPrice?: string;
    SellPrice?: string;
    SellPrice1?: string;
    CountInKarton?: string;
    CountInBasteh?: string;
    MainGroupName?: string;
    MainGroupErpCode?: string;
    SideGroupName?: string;
    SideGroupErpCode?: string;
    ErpCode: string;
    image?: string;
    [key: string]: string | undefined;
}

export interface HolooProductListParams {
    code?: string;
    "date.from"?: string;
    "date.to"?: string;
    maingrouperpcode?: string;
    sidegrouperpcode?: string;
    getimage?: boolean;
}

export interface HolooProductInput {
    id?: string;
    sidegrouperpcode: string;
    code?: string;
    name: string;
    few?: number;
    buyprice?: number;
    sellprice?: number;
    sellprice2?: number;
    sellprice3?: number;
    sellprice4?: number;
    sellprice5?: number;
    sellprice6?: number;
    sellprice7?: number;
    sellprice8?: number;
    sellprice9?: number;
    sellprice10?: number;
    countinkarton?: number;
    countinbasteh?: number;
    uniterpcode?: string;
}

export interface HolooProductUpdateInput extends Partial<Omit<HolooProductInput, "sidegrouperpcode">> {
    erpcode: string;
}

// ---------------------------------------------------------------------------
// Base groups / units
// ---------------------------------------------------------------------------
export interface HolooMainGroup {
    Name: string;
    ErpCode: string;
}
export interface HolooSideGroup {
    Name: string;
    ErpCode: string;
    MainGroupName: string;
    MainErpCode: string;
}
export interface HolooUnit {
    Name: string;
    ErpCode: string;
}

// ---------------------------------------------------------------------------
// Invoices / documents
// ---------------------------------------------------------------------------
/** 1=فروش، 2=برگشت از فروش، 3=خرید، 4=برگشت از خرید */
export type HolooInvoiceType = 1 | 2 | 3 | 4;

export interface HolooInvoiceDetailInput {
    id?: string;
    ProductErpCode: string;
    few: number;
    price: number;
    levy?: number;
    scot?: number;
    uniterpcode?: string;
    Comment?: string;
}

export interface HolooInvoiceInput {
    id: string;
    Type: HolooInvoiceType;
    customererpcode: string;
    date: string;
    time: string;
    Cash?: number;
    CashSarfasl?: string;
    Bank?: number;
    BankSarfasl?: string;
    Nesiyeh?: number;
    Discount?: number;
    Kind?: number;
    detailinfo: HolooInvoiceDetailInput[];
}

export interface HolooPreInvoiceInput {
    id: string;
    customerpcode: string;
    date: string;
    time: string;
    comment?: string;
    levy?: number;
    scot?: number;
    detailinfo: HolooInvoiceDetailInput[];
}

export interface HolooInvoiceListParams {
    Code?: string;
    "code.from"?: string;
    "code.to"?: string;
    Type?: string;
    Sanadcode?: string;
    "date.from"?: string;
    "date.to"?: string;
}

export interface HolooInvoiceSummary {
    Code: string;
    Type: string;
    SanadCode: string;
    CustomerName: string;
    CustomerErpCode: string;
    Date: string;
    Time: string;
    SumNaghd: string;
    SumNesiyeh: string;
    SumDiscount: string;
    SumCheck: string;
    SumLevy: string;
    SumScot: string;
    SumPrice: string;
    ErpCode: string;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export interface HolooHavalehInput {
    id: string;
    date: string;
    time: string;
    customersarfasl: string;
    banksarfasl: string;
    bank: number;
    discount?: number;
    comment?: string;
}

export interface HolooReceiveInput {
    id: string;
    date: string;
    time: string;
    customersarfasl: string;
    banksarfasl?: string;
    bank?: number;
    cashsarfasl?: string;
    cash?: number;
    discount?: number;
    comment?: string;
}
