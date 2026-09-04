'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Icon } from "@/components/ui/icon";
import { Cancel01Icon, MenuIcon } from "@hugeicons/core-free-icons";

interface LandingHeaderProps {
  user?: {
    id: string;
    name?: string | null;
    image?: string | null;
    email?: string | null;
  } | null;
}

export function LandingHeader({ user }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-200 border-b pt-[env(safe-area-inset-top,0px)]',
        scrolled
          ? 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm border-border'
          : 'bg-background border-transparent'
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2 font-bold text-2xl tracking-tight text-primary">
            <span>LedgerFlow</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#personal-features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Personal Features
            </Link>
            <Link href="#social-ledger" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Social Splits
            </Link>
            <Link href="#business-mode" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Business Mode
            </Link>
            <Link href="#security" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Privacy & Security
            </Link>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <Link href="/dashboard" className="flex items-center gap-2">
              <Button variant="ghost" className="text-sm font-medium">
                Dashboard
              </Button>
              <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
                <AvatarFallback>{user.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="default" size="sm" className="h-9 px-4 font-medium">
                Access Workspace
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-muted-foreground hover:text-foreground focus:outline-none"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <Icon icon={Cancel01Icon} className="h-6 w-6" /> : <Icon icon={MenuIcon} className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-background px-4 py-4 space-y-3">
          <Link
            href="#personal-features"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Personal Features
          </Link>
          <Link
            href="#social-ledger"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Social Splits
          </Link>
          <Link
            href="#business-mode"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Business Mode
          </Link>
          <Link
            href="#security"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy & Security
          </Link>
          <div className="pt-4 border-t border-border flex items-center justify-between">
            {user ? (
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 w-full justify-between">
                <span className="text-sm font-semibold text-foreground">Open Dashboard</span>
                <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                  <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
                  <AvatarFallback>{user.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
                <Button variant="default" className="w-full h-10 font-medium">
                  Access Workspace
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
