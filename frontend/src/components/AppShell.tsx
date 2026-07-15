import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const NAV_ITEMS = [
  { to: '/', label: 'لوحة التحكم', end: true },
  { to: '/explorer', label: 'مستكشف الأسهم' },
  { to: '/watchlist', label: 'قائمة المراقبة' },
  { to: '/dividends', label: 'تقويم التوزيعات' },
  { to: '/settings', label: 'الإعدادات' },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 border-l border-slate-200 bg-white md:block">
        <div className="flex h-16 items-center px-6">
          <span className="text-lg font-bold text-brand-700">سهمي</span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-3">
          <button
            onClick={() => signOut(auth)}
            className="w-full rounded-lg px-3 py-2 text-right text-sm text-slate-500 hover:bg-slate-100"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
          <span className="text-lg font-bold text-brand-700">سهمي</span>
          <button onClick={() => signOut(auth)} className="text-sm text-slate-500">
            خروج
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
