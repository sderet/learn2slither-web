import Lab from "./components/Lab";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Learn2Slither
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          A Q-learning agent learns to play Snake from what it can see in four directions. Watch it
          learn live, or train many snakes in the background.
        </p>
      </header>
      <Lab />
    </main>
  );
}
