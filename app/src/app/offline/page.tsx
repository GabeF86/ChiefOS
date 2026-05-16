export const metadata = {
  title: "Offline · ChiefOS",
};

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-3">
        <p className="font-mono text-xs tracking-widest uppercase text-ink-3">
          ChiefOS
        </p>
        <h1 className="font-serif text-2xl text-ink">You&apos;re offline</h1>
        <p className="text-ink-2 text-sm">
          ChiefOS needs a connection to pull live data. Try again in a moment.
        </p>
      </div>
    </main>
  );
}
