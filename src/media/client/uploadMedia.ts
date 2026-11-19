"use client";

import type { MediaKind, MediaScope } from "@/types";

export interface MediaUploadResult {
  id: string;
  kind: MediaKind;
  scope: MediaScope;
  filename: string;
  contentType: string;
  groupId: string;
  originalId: string;
  mobileId?: string;
  thumbId?: string;
  ownerUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

type UploadMediaInput = {
  file: File;
  scope?: MediaScope;
  signal?: AbortSignal;
};

export async function uploadMedia({ file, scope = "gallery", signal }: UploadMediaInput): Promise<MediaUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scope", scope);

  const query = new URLSearchParams({ scope }).toString();

  const response = await fetch(`/api/media/upload?${query}`, {
    method: "POST",
    body: formData,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    let message = "Upload failed";

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const data = (await response.json()) as { error?: string };
        if (data?.error) {
          message = data.error;
        }
      } catch {
        // ignore
      }
    } else {
      const text = (await response.text().catch(() => "")).trim();
      if (text) {
        message = text;
      }
    }

    if (response.status === 413 && message === "Upload failed") {
      message = "حجم فایل بیشتر از حد مجاز است";
    }

    if (response.status === 401 && message === "Upload failed") {
      message = "دسترسی آپلود ندارید";
    }

    throw new Error(message);
  }

  const json = (await response.json()) as { media?: MediaUploadResult };
  if (!json?.media || typeof json.media !== "object") {
    throw new Error("Malformed upload response");
  }

  return json.media;
}
