import { NavLink } from 'react-router-dom';
import { Home, Search, Plus, Heart, User } from 'lucide-react';
import { cn } from '../../lib/utils';

const tabs = [
  { to: '/', icon: Home },
  { to: '/search', icon: Search },
  { to: '/my-recipes', icon: Plus },
  { to: '/saved', icon: Heart },
  { to: '/profile', icon: User },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 glass border-t border-white/20 z-40">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors',
                isActive ? 'text-primary' : 'text-stone-400'
              )
            }
          >
            <Icon size={24} />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
