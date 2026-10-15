import Image from "next/image";
import Link from "next/link";
import { CurrentYear } from "@/components/CurrentYear";

const steps = [
  { title: "Siapkan peserta", description: "Admin menambah daftar peserta untuk dipilih." },
  { title: "Mulai vote", description: "Pemilih mendaftar dengan nama, lalu memilih satu peserta." },
  { title: "Stop vote", description: "Admin menghentikan voting dengan konfirmasi." },
  { title: "Lihat hasil", description: "Suara, persentase, dan pemenang ditampilkan." },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[42rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-teal-200/50 via-emerald-100/40 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-gradient-to-tr from-emerald-200/40 to-transparent blur-3xl" />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-16 pt-12 text-center sm:pt-16">
        <header className="flex flex-col items-center gap-3">
          <Image
            src="/logo_nestecth.png"
            alt="Logo NesTech"
            width={265}
            height={207}
            priority
            className="h-auto w-40 sm:w-48"
          />
          <span className="rounded-full border border-teal-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-700">
            Voting Online
          </span>
        </header>

        <section className="mt-8">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Pemilihan{" "}
            <span className="bg-gradient-to-r from-teal-600 to-emerald-500 bg-clip-text text-transparent">
              sederhana &amp; adil
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
            Satu pemilih, satu suara — ditegakkan di server, bukan hanya di tampilan.
            Nyaman dipakai di HP, tablet, maupun desktop.
          </p>
        </section>

        <section className="mt-10 grid w-full gap-4 sm:grid-cols-3" aria-label="Pilihan masuk">
          <Link
            href="/vote"
            className="group flex min-h-11 flex-col items-center gap-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-teal-300"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span className="font-bold text-slate-900 group-hover:text-teal-700">Masuk sebagai Pemilih</span>
            <span className="text-sm text-slate-500">Daftar dengan nama, lalu pilih.</span>
          </Link>

          <Link
            href="/admin/login"
            className="group flex min-h-11 flex-col items-center gap-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-teal-300"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <span className="font-bold text-slate-900 group-hover:text-teal-700">Masuk sebagai Admin</span>
            <span className="text-sm text-slate-500">Kelola peserta &amp; jalankan voting.</span>
          </Link>

          <Link
            href="/hasil"
            className="group flex min-h-11 flex-col items-center gap-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-teal-300"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <span className="font-bold text-slate-900 group-hover:text-teal-700">Lihat Hasil</span>
            <span className="text-sm text-slate-500">Tersedia setelah voting ditutup.</span>
          </Link>
        </section>

        <section className="mt-14 w-full" aria-labelledby="cara-kerja">
          <h2 id="cara-kerja" className="text-lg font-bold text-slate-900 sm:text-xl">
            Cara kerja
          </h2>
          <ol className="mt-5 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200 backdrop-blur"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <p className="mt-2 font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm text-slate-600">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/60 py-5">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo_nestecth.png" alt="" width={72} height={56} className="h-9 w-auto" />
            <span className="text-sm text-slate-500">Dipandu oleh NesTech</span>
          </div>
          <p className="text-sm text-slate-400">
            © <CurrentYear /> Aplikasi Voting Online
          </p>
        </div>
      </footer>
    </div>
  );
}
