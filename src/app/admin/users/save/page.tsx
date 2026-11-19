import UserModel from "@/models/User";
import ToJson from "@/utils/toJson";
import UserSave from "@/views/admin/users/save";
import { buildAdminMetadata } from "@/lib/admin-metadata";

const CREATE_TITLE = "ایجاد کاربر";
const EDIT_TITLE = "ویرایش کاربر";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveUserId(paramsPromise: SearchParams): Promise<string | undefined> {
    const params = await paramsPromise;
    const rawId = params?.id;
    return Array.isArray(rawId) ? rawId[0] : rawId ?? undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
    const id = await resolveUserId(searchParams);
    const title = id ? EDIT_TITLE : CREATE_TITLE;
    return buildAdminMetadata(title);
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
    const id = await resolveUserId(searchParams);

    const defaultValues = id ? await UserModel.findById(id) : null;

    return <UserSave
        defaultValues={defaultValues ? ToJson(defaultValues) : null}
    />;
}
