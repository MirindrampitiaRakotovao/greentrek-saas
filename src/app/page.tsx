// Page d'accueil provisoire (étape E0) : vérifie que Tailwind, les tokens de couleur
// et les polices sont bien branchés. Elle sera remplacée par la landing SaaS (E11).

const swatches = [
  { name: "teal-400", className: "bg-gt-teal-400" },
  { name: "teal-500", className: "bg-gt-teal-500" },
  { name: "teal-600", className: "bg-gt-teal-600" },
  { name: "teal-700", className: "bg-gt-teal-700" },
  { name: "teal-800", className: "bg-gt-teal-800" },
  { name: "teal-900", className: "bg-gt-teal-900" },
  { name: "teal-card", className: "bg-gt-teal-card" },
  { name: "sand-300", className: "bg-gt-sand-300" },
  { name: "sand-200", className: "bg-gt-sand-200" },
  { name: "cream", className: "bg-gt-cream" },
  { name: "mist", className: "bg-gt-mist" },
  { name: "sky", className: "bg-gt-sky" },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="rounded-2xl bg-gt-teal-500 px-6 py-10">
        <h1 className="font-script text-4xl text-gt-cream sm:text-5xl">Green Trek</h1>
        <p className="mt-3 inline-block rounded-full bg-gt-sand-200 px-4 py-1 text-sm font-medium text-gt-teal-900">
          Initialisation du projet (étape E0)
        </p>
      </header>

      <section aria-labelledby="palette-title">
        <h2 id="palette-title" className="text-xl font-semibold text-gt-teal-700">
          Palette
        </h2>
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {swatches.map((swatch) => (
            <li key={swatch.name} className="text-xs">
              <div className={`h-12 rounded-lg border border-gt-mist ${swatch.className}`} />
              <span className="mt-1 block">{swatch.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <a
        href="/api/health"
        className="self-start rounded-full bg-gt-teal-700 px-6 py-3 font-medium text-white hover:bg-gt-teal-800"
      >
        Vérifier la connexion MySQL
      </a>
    </main>
  );
}
