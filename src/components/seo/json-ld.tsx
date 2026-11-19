"use client";

/**
 * JSON-LD Structured Data Component
 * Helps AI assistants and search engines better understand the site content
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}
