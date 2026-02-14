
import { createClient } from '@/lib/supabase/server';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
        <Link className="flex items-center justify-center font-bold text-xl" href="/">
          LedgerFlow
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          {user ? (
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-sm font-medium hover:underline underline-offset-4">Dashboard</span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.user_metadata.avatar_url} alt={user.user_metadata.full_name || 'User'} />
                <AvatarFallback>{user.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Link className="text-sm font-medium hover:underline underline-offset-4" href="/login">
              Login
            </Link>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 flex items-center justify-center bg-background">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Your Modern Financial Workspace
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  {user
                    ? `Welcome back${user.user_metadata.full_name ? `, ${user.user_metadata.full_name}` : ''}! Ready to manage your finances?`
                    : "Manage your personal and business finances in one place. Track expenses, manage contacts, and gain insights with LedgerFlow."
                  }
                </p>
              </div>
              <div className="space-x-4">
                <Link href={user ? "/dashboard" : "/login"}>
                  <Button size="lg" className="h-11 px-8">
                    {user ? "Go to Dashboard" : "Get Started"}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} LedgerFlow. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4 text-muted-foreground" href="/terms">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4 text-muted-foreground" href="/privacy">
            Privacy Policy
          </Link>
        </nav>
      </footer>
    </div>
  );
}

