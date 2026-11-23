import { describe, expect, it } from 'vitest';
import { resolveConfiguredSitePage } from './site-pages';

describe('configured site pages', () => {
  it('resolves an admin-managed page for a supported public slug', () => {
    const page = resolveConfiguredSitePage({
      about: {
        title: 'درباره ما',
        description: 'معرفی مجموعه طب احمدی',
        content: '<p>این متن توسط مدیر سایت نوشته شده است.</p>',
      },
    }, 'about');

    expect(page).toEqual({
      title: 'درباره ما',
      description: 'معرفی مجموعه طب احمدی',
      content: '<p>این متن توسط مدیر سایت نوشته شده است.</p>',
    });
  });

  it('ignores unsupported slugs and pages without body content', () => {
    expect(resolveConfiguredSitePage({ terms: { title: 'شرایط خرید', content: '   ' } }, 'terms')).toBeNull();
    expect(resolveConfiguredSitePage({ about: { content: '<p>محتوا</p>' } }, 'contact')).toBeNull();
  });
});
