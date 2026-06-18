import {
  BarChart3,
  BookA,
  CalendarCheck,
  FlaskConical,
  Inbox,
  Layers,
  LayoutGrid,
  Library,
  MessagesSquare,
  PencilLine,
  Route,
  Settings,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  to: string;
  labelKey: string;
  icon: LucideIcon;
  primary: boolean;
}

export const navItems: readonly NavItem[] = [
  { key: 'topics', to: '/', labelKey: 'topics', icon: LayoutGrid, primary: true },
  { key: 'today', to: '/today', labelKey: 'today', icon: CalendarCheck, primary: true },
  { key: 'flashcards', to: '/flashcards', labelKey: 'flashcards', icon: Layers, primary: true },
  {
    key: 'interview',
    to: '/interview',
    labelKey: 'interview',
    icon: MessagesSquare,
    primary: true,
  },
  { key: 'progress', to: '/progress', labelKey: 'progress', icon: BarChart3, primary: true },
  { key: 'sandbox', to: '/sandbox', labelKey: 'sandbox', icon: FlaskConical, primary: false },
  { key: 'tracks', to: '/tracks', labelKey: 'tracks', icon: Route, primary: false },
  { key: 'map', to: '/map', labelKey: 'map', icon: Waypoints, primary: false },
  { key: 'library', to: '/library', labelKey: 'library', icon: Library, primary: false },
  { key: 'glossary', to: '/glossary', labelKey: 'glossary', icon: BookA, primary: false },
  { key: 'proposals', to: '/proposals', labelKey: 'proposals', icon: Inbox, primary: false },
  { key: 'submit', to: '/submit', labelKey: 'submit', icon: PencilLine, primary: false },
  { key: 'settings', to: '/settings', labelKey: 'settings', icon: Settings, primary: false },
] as const;

export const primaryNavItems: readonly NavItem[] = navItems.filter((item) => item.primary);

export const secondaryNavItems: readonly NavItem[] = navItems.filter((item) => !item.primary);
