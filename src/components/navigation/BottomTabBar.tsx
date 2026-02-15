'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface TabItem {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  badge?: number;
  /** Additional paths that should mark this tab as active */
  matchPaths?: string[];
}

interface BottomTabBarProps {
  tabs: TabItem[];
}

export function BottomTabBar({ tabs }: BottomTabBarProps) {
  const pathname = usePathname();

  const isActive = (tab: TabItem) => {
    // Exact path match
    if (tab.href && pathname === tab.href) return true;
    // matchPaths: explicit prefix matches
    if (tab.matchPaths?.some(p => pathname.startsWith(p))) return true;
    // Sub-path match (e.g. /admin/buyers matches /admin/buyers/*)
    if (tab.href && tab.href !== '/' && pathname.startsWith(tab.href + '/')) return true;
    return false;
  };

  // Find the most specific active tab (longest href match wins)
  const activeKey = tabs.reduce<string | null>((best, tab) => {
    if (!isActive(tab)) return best;
    if (!best) return tab.key;
    const bestTab = tabs.find(t => t.key === best);
    const bestLen = bestTab?.href?.length || 0;
    const thisLen = tab.href?.length || 0;
    return thisLen > bestLen ? tab.key : best;
  }, null);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-header md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 pb-safe">
      <div className="flex items-center justify-around h-14 px-1">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          const className = `flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
            active ? 'text-emerald-400' : 'text-slate-500'
          }`;

          const content = (
            <>
              <span className="relative">
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                    {tab.badge > 99 ? '99' : tab.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </>
          );

          if (tab.href) {
            return (
              <Link key={tab.key} href={tab.href} className={className}>
                {content}
              </Link>
            );
          }

          return (
            <button key={tab.key} onClick={tab.onClick} className={className}>
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
