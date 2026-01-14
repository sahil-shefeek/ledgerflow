
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          LedgerFlow
        </h1>
        <p className="text-lg text-muted-foreground">
          Your modern financial management workspace.
        </p>
        <Link
          href="/login"
          className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
