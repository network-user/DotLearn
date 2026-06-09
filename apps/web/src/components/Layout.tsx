import type { ReactNode } from 'react';

import { Link } from '@tanstack/react-router';

import { AddTopicButton } from './AddTopicButton';
import { Breadcrumbs } from './Breadcrumbs';

type LayoutProps = {
  children: ReactNode;
};

export const Layout = ({ children }: LayoutProps) => (
  <div className="min-h-full flex flex-col">
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="size-7 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600" />
          <span className="font-semibold tracking-tight text-zinc-100 group-hover:text-white">
            DotLearn
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-md text-sm text-zinc-300 hover:text-white hover:bg-zinc-900"
          >
            Topics
          </Link>
          <Link
            to="/progress"
            className="px-3 py-1.5 rounded-md text-sm text-zinc-300 hover:text-white hover:bg-zinc-900"
          >
            Progress
          </Link>
          <Link
            to="/admin"
            className="px-3 py-1.5 rounded-md text-sm text-zinc-300 hover:text-white hover:bg-zinc-900"
          >
            Admin
          </Link>
          <Link
            to="/settings"
            className="px-3 py-1.5 rounded-md text-sm text-zinc-300 hover:text-white hover:bg-zinc-900"
          >
            Settings
          </Link>
          <AddTopicButton />
        </nav>
      </div>
    </header>
    <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8 space-y-6">
      <Breadcrumbs />
      {children}
    </main>
    <footer className="border-t border-zinc-800">
      <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-zinc-500 flex items-center justify-between">
        <span>DotLearn · local-first learning workbench</span>
        <a
          href="https://github.com/your-org/dotlearn"
          className="hover:text-zinc-300"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  </div>
);
