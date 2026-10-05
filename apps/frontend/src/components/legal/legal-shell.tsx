import Link from 'next/link';
import { ReactNode } from 'react';

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-primary text-newTextColor">
      <main className="mx-auto flex w-full max-w-[760px] flex-col px-[16px] py-[32px] sm:px-[24px] sm:py-[48px]">
        <img
          src="/crea8one-logo-horizontal-color-on-dark.svg"
          alt="Crea8one"
          width={877}
          height={263}
          className="h-[36px] w-auto max-w-[180px] object-contain object-left"
        />
        <h1 className="mt-[12px] text-[32px] font-[500] leading-tight tracking-[-0.4px] sm:text-[40px]">
          {title}
        </h1>
        <p className="mt-[12px] text-[14px] text-gray">
          Last updated: October 5, 2026
        </p>
        <div className="mt-[28px] rounded-[12px] border border-newBorder bg-newBgColorInner p-[20px] sm:p-[32px]">
          <article className="flex flex-col gap-[14px] text-[15px] leading-[1.7]">
            {children}
          </article>
        </div>
        <nav
          aria-label="Legal documents"
          className="mt-[24px] flex flex-wrap gap-x-[16px] gap-y-[8px] text-[13px] text-gray"
        >
          <Link className="underline hover:text-newTextColor" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="underline hover:text-newTextColor" href="/terms">
            Terms of Service
          </Link>
          <Link
            className="underline hover:text-newTextColor"
            href="/data-deletion"
          >
            Data Deletion
          </Link>
        </nav>
      </main>
    </div>
  );
}

export function LegalH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-[12px] text-[20px] font-[500] leading-snug text-newTextColor">
      {children}
    </h2>
  );
}

export function LegalH3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-[4px] text-[16px] font-[500] leading-snug text-newTextColor">
      {children}
    </h3>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-[6px] ps-[20px]">{children}</ul>
  );
}

export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const className = 'text-forth underline break-words';
  if (href.startsWith('/')) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }
  return (
    <a className={className} href={href} rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function LegalOperator() {
  return (
    <address className="not-italic">
      Harsh Verma, sole proprietor, trading as Zero Print Plus
      <br />
      Greater Noida, Uttar Pradesh, India
      <br />
      Email:{' '}
      <LegalLink href="mailto:support@crea8.one">support@crea8.one</LegalLink>
      <br />
      Grievance Officer (India DPDP Act 2023 and the IT Rules): Harsh Verma,
      at the same email address
    </address>
  );
}
