import Link from "next/link";
import {
  CloudSun,
  MessageCircle,
  ShieldAlert,
  Sprout,
  TrendingUp,
} from "lucide-react";

const topics = [
  {
    icon: MessageCircle,
    label: "Community discussions",
    description: "Talk with farmers in your area about what's working.",
  },
  {
    icon: TrendingUp,
    label: "Market prices",
    description: "Know what crops are fetching before you sell.",
  },
  {
    icon: CloudSun,
    label: "Weather & planting guidance",
    description: "Plan planting and harvest around local conditions.",
  },
  {
    icon: ShieldAlert,
    label: "Crop health alerts",
    description: "Hear about pests and disease early from your circle.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-6 sm:px-10">
        <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
        <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
          Shamba Circle
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 pb-20 sm:px-10">
        <section className="flex flex-col items-start gap-6 pt-8 sm:pt-16">
          <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-5xl">
            A community built by and for farmers.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-shamba-ink-soft">
            Shamba Circle connects farmers to share what they know — market
            prices, planting timing, and the alerts that matter — so no one
            has to farm without a community behind them.
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
            >
              Join Shamba Circle
            </Link>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-card"
            >
              Explore as a guest
            </button>
          </div>
        </section>

        <section
          aria-label="What the community shares"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {topics.map(({ icon: Icon, label, description }) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-6"
            >
              <Icon className="size-6 text-shamba-ochre" aria-hidden="true" />
              <h2 className="font-display text-base font-medium text-shamba-ink">
                {label}
              </h2>
              <p className="text-sm leading-6 text-shamba-ink-soft">
                {description}
              </p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
