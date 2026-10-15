import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Aplikasi Voting Online</h1>
        <p className="mt-3 text-slate-600">
          Satu pemilih, satu suara. Hasil final setelah voting ditutup.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/vote"
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto"
        >
          Masuk sebagai Pemilih
        </Link>
        <Link
          href="/admin/login"
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 sm:w-auto"
        >
          Masuk sebagai Admin
        </Link>
      </div>

      <Link href="/hasil" className="text-sm font-medium text-indigo-700 hover:underline">
        Lihat hasil voting
      </Link>
    </main>
  );
}
