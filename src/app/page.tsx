import Image from "next/image";
import Link from "next/link";
import { CurrentYear } from "@/components/CurrentYear";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[42rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-teal-200/50 via-emerald-100/40 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-gradient-to-tr from-emerald-200/40 to-transparent blur-3xl" />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <Image
          src="/logo_nestecth.png"
          alt="Logo NesTech"
          width={265}
          height={207}
          priority
          className="h-auto w-44 sm:w-52"
        />
        <Image
          src="/5th.png"
          alt="Anniversary ke-5"
          width={250}
          height={291}
          priority
          className="mt-5 h-auto w-36 sm:w-44"
        />

        <div className="mt-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/vote"
            className="flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-10 py-3 font-semibold text-white shadow-md shadow-teal-200 transition hover:opacity-90"
          >
            Mulai Vote
          </Link>
          <Link
            href="/hasil"
            className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-10 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Lihat Hasil
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/60 py-5">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo_nestecth.png" alt="" width={72} height={56} className="h-9 w-auto" />
            <span className="text-sm text-slate-500">Dipandu oleh NesTech</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/login" className="text-slate-500 hover:text-teal-700 hover:underline">
              Masuk admin
            </Link>
            <p className="text-slate-400">
              © <CurrentYear /> Aplikasi Voting Online
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
