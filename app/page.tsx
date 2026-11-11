import Link from "next/link";
import { ConversationDemo } from "@/components/ConversationDemo";
import { CASES, CONTACT, FEATURED, FOOTER, HERO, NAV, SERVICES, SITE, STRENGTHS } from "@/content/home";

// トップページ（デザイン案G）。文言は content/home.ts、会話デモは components/ に置く
const wrap = "px-8 sp:px-4";
const inner = "mx-auto max-w-[1240px]";

export default function Home() {
  return (
    <>
      <header className={`${wrap} flex h-16 items-center justify-between gap-6`}>
        <Link href="/" aria-label={`${SITE.name} トップ`} className="flex items-baseline gap-2.5">
          <span className="text-[17px] font-bold tracking-[0.12em]">{SITE.name}</span>
          <span className="text-xs text-faint">{SITE.nameKana}</span>
        </Link>
        <nav aria-label="メインメニュー" className="flex gap-7 text-sm sp:hidden">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href="#contact"
          className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-white"
        >
          {SITE.contactLabel}
        </a>
      </header>

      <main>
        <section
          aria-label="ファーストビュー"
          className={`${wrap} flex min-h-[860px] flex-col items-center justify-center gap-7 pt-12 pb-24 sp:min-h-[800px]`}
        >
          <h1 className="m-0 text-center text-[34px] font-medium tracking-[0.02em] sp:text-[26px]">{HERO.heading}</h1>
          <ConversationDemo />
          <a href="#contact" className="border-b border-[#A3A3A3] text-sm text-muted">
            {HERO.tryLink}
          </a>
        </section>

        <section aria-labelledby="featured-heading" className={`${wrap} pt-6 pb-24`}>
          <div className={inner}>
            <h2 id="featured-heading" className="sr-only">
              {FEATURED.heading}
            </h2>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8 sp:grid-cols-1">
              <a href="#cases" className="flex flex-col gap-4">
                <div className="flex aspect-video items-center justify-center rounded-2xl bg-ph text-[13px] text-faint">
                  {FEATURED.main.image}
                </div>
                <span className="text-[26px] leading-normal font-medium">{FEATURED.main.title}</span>
                <span className="text-[13px] text-faint">{FEATURED.main.meta}</span>
              </a>
              <div className="flex flex-col gap-8">
                <a href="#cases" className="flex flex-col gap-3">
                  <div className="aspect-[4/3] rounded-2xl bg-ph" />
                  <span className="text-base leading-[1.6] font-medium">{FEATURED.side[0].title}</span>
                  <span className="text-[13px] text-faint">{FEATURED.side[0].meta}</span>
                </a>
                <a href="#cases" className="flex flex-col gap-1.5 border-t border-line pt-5">
                  <span className="text-base leading-[1.6] font-medium">{FEATURED.side[1].title}</span>
                  <span className="text-[13px] text-faint">{FEATURED.side[1].meta}</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className={`${wrap} pt-12 pb-24`}>
          <div className={`${inner} flex flex-col gap-7`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="m-0 text-[22px] font-medium">{SERVICES.heading}</h2>
              <a href="#services" className="text-[13px] text-muted">
                {SERVICES.more}
              </a>
            </div>
            <div className="grid grid-cols-3 gap-6 sp:grid-cols-1">
              {SERVICES.items.map((s) => (
                <a key={s.title} href="#services" className="flex flex-col gap-3">
                  <div className="aspect-square rounded-2xl bg-ph sp:aspect-video" />
                  <span className="text-[17px] font-medium">{s.title}</span>
                  <span className="text-sm text-muted">{s.body}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className={`${wrap} pt-12 pb-24`}>
          <div className={`${inner} flex flex-col gap-7`}>
            <h2 className="m-0 text-[22px] font-medium">{STRENGTHS.heading}</h2>
            <div className="grid grid-cols-3 gap-6 border-t border-line pt-6 sp:grid-cols-1">
              {STRENGTHS.items.map((s) => (
                <div key={s.title} className="flex flex-col gap-1.5">
                  <span className="text-[17px] font-medium">{s.title}</span>
                  <span className="text-sm text-muted">{s.body}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cases" className={`${wrap} pt-12 pb-24`}>
          <div className={`${inner} flex flex-col gap-7`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="m-0 text-[22px] font-medium">{CASES.heading}</h2>
              <a href="#cases" className="text-[13px] text-muted">
                {CASES.more}
              </a>
            </div>
            <p className="m-0 text-[13px] text-dummy">{CASES.dummyNote}</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 sp:grid-cols-1">
              {CASES.items.map((c) => (
                <a key={c.title} href="#cases" className="flex items-center gap-5">
                  <div className="aspect-[4/3] w-40 shrink-0 rounded-xl bg-ph sp:w-[104px]" />
                  <div className="flex flex-col gap-1">
                    <span className="text-base leading-[1.6] font-medium">{c.title}</span>
                    <span className="text-[13px] text-faint">{c.meta}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className={`${wrap} pt-6 pb-24`}>
          <div
            className={`${inner} box-border flex flex-col items-center gap-5 rounded-3xl bg-sub px-6 py-[88px] text-center`}
          >
            <h2 className="m-0 text-[30px] leading-normal font-medium">{CONTACT.heading}</h2>
            <p className="m-0 text-muted">{CONTACT.body}</p>
            <a
              href="#contact"
              className="inline-flex min-h-12 items-center rounded-full bg-ink px-7 font-medium text-white"
            >
              {SITE.contactLabel}
            </a>
          </div>
        </section>
      </main>

      <footer className={`${wrap} pt-12 pb-10`}>
        <div className={`${inner} flex flex-col gap-12`}>
          <div className="grid grid-cols-4 gap-8 sp:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold tracking-[0.12em]">{SITE.name}</span>
              <span className="text-[13px] text-faint">{SITE.company}</span>
            </div>
            {FOOTER.menus.map((menu) => (
              <nav key={menu.label} aria-label={menu.label} className="flex flex-col text-sm">
                {menu.links.map((link) => (
                  <Link key={link.href} href={link.href} className="py-1.5">
                    {link.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
          <small className="text-xs text-faint">{SITE.copyright}</small>
        </div>
      </footer>
    </>
  );
}
