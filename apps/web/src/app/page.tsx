import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">AWS DevLab</h1>
      <p className="max-w-md text-slate-600">
        Learn AWS by doing AWS. Structured content, hands-on labs and practice for the AWS
        Certified Developer – Associate (DVA-C03).
      </p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold transition hover:bg-slate-100"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
