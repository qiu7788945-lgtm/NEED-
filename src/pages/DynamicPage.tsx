import type { Page, PageFaqItem, PageMediaRef, PageSection } from '../../shared/types/pages';
import { resolvePublicAssetUrl } from '../services/publicContent';

interface DynamicPageProps {
  page: Page;
  previewNotice?: string;
}

function bySortOrder<TItem extends { sortOrder: number }>(items: TItem[] = []) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function renderBody(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => (
      <p key={paragraph} className="text-base md:text-lg leading-8 text-gray-600">
        {paragraph}
      </p>
    ));
}

function DynamicSection({ section }: { section: PageSection }) {
  if (!section.enabled) {
    return null;
  }

  const items = Array.isArray(section.items) ? section.items.filter(Boolean) : [];

  return (
    <section className="border-t border-gray-100 py-12 md:py-16">
      <div className="grid gap-8 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
        <div>
          <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-[#7a9900]">
            {section.type || 'section'}
          </p>
          {section.title ? (
            <h2 className="text-3xl font-black tracking-tight text-black md:text-5xl">
              {section.title}
            </h2>
          ) : null}
          {section.subtitle ? (
            <p className="mt-5 text-lg leading-8 text-gray-500">
              {section.subtitle}
            </p>
          ) : null}
        </div>

        <div className="space-y-6">
          {section.body ? renderBody(section.body) : null}
          {items.length ? (
            <ul className="grid gap-3">
              {items.map((item) => (
                <li key={item} className="flex gap-3 text-base font-medium leading-7 text-gray-800">
                  <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#ccff00]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {section.mediaRefs?.length ? <MediaRefs mediaRefs={section.mediaRefs} compact /> : null}
        </div>
      </div>
    </section>
  );
}

function MediaRefs({ mediaRefs, compact = false }: { mediaRefs: PageMediaRef[]; compact?: boolean }) {
  const visibleMediaRefs = bySortOrder(mediaRefs).filter((item) => item.url);

  if (!visibleMediaRefs.length) {
    return null;
  }

  return (
    <div className={compact ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-5 md:grid-cols-3'}>
      {visibleMediaRefs.map((item) => {
        const src = resolvePublicAssetUrl(item.url);
        return (
          <figure key={item.id || item.url} className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
            <img
              loading="lazy"
              src={src}
              alt={item.alt || item.caption || 'NEED page media'}
              className="aspect-[4/3] w-full object-cover"
            />
            {(item.caption || item.usage) ? (
              <figcaption className="space-y-1 px-4 py-3">
                {item.caption ? <p className="text-sm font-bold text-gray-900">{item.caption}</p> : null}
                {item.usage ? <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{item.usage}</p> : null}
              </figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}

function FaqList({ faqItems }: { faqItems: PageFaqItem[] }) {
  const visibleFaqItems = bySortOrder(faqItems).filter((item) => item.enabled && (item.question || item.answer));

  if (!visibleFaqItems.length) {
    return null;
  }

  return (
    <section className="border-t border-gray-100 py-12 md:py-16">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#7a9900]">FAQ</p>
          <h2 className="text-3xl font-black tracking-tight text-black md:text-5xl">常见问题</h2>
        </div>
      </div>
      <div className="grid gap-4">
        {visibleFaqItems.map((item) => (
          <article key={item.id || item.question} className="rounded-2xl border border-gray-100 bg-white p-6">
            {item.question ? <h3 className="text-xl font-black text-gray-950">{item.question}</h3> : null}
            {item.answer ? <p className="mt-3 text-base leading-8 text-gray-600">{item.answer}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function DynamicPage({ page, previewNotice }: DynamicPageProps) {
  const sections = bySortOrder(page.sections ?? []);
  const mediaRefs = bySortOrder(page.mediaRefs ?? []);

  return (
    <main className="min-h-screen bg-white text-black">
      {previewNotice ? (
        <div className="sticky top-0 z-[60] border-b border-black/10 bg-[#ccff00] px-6 py-3 text-center text-sm font-black text-black">
          {previewNotice}
        </div>
      ) : null}

      <header className="px-6 pb-14 pt-32 md:px-12 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-6xl">
          <p className="mb-5 text-xs font-black uppercase tracking-[0.28em] text-[#7a9900]">
            {page.pageType} / {page.status}
          </p>
          <h1 className="max-w-5xl text-5xl font-black leading-[0.95] tracking-tight text-black md:text-7xl lg:text-8xl">
            {page.heroTitle || page.title}
          </h1>
          {page.heroSubtitle ? (
            <p className="mt-8 max-w-3xl text-xl leading-9 text-gray-500 md:text-2xl">
              {page.heroSubtitle}
            </p>
          ) : null}
          {page.summary ? (
            <p className="mt-8 max-w-4xl text-lg leading-9 text-gray-700 md:text-xl">
              {page.summary}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-24 md:px-12">
        {mediaRefs.length ? (
          <section className="pb-12 md:pb-16">
            <MediaRefs mediaRefs={mediaRefs} />
          </section>
        ) : null}

        {sections.map((section) => (
          <DynamicSection key={section.id} section={section} />
        ))}

        <FaqList faqItems={page.faqItems ?? []} />
      </div>
    </main>
  );
}
