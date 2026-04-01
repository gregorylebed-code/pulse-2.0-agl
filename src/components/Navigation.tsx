import React from 'react';
import { Activity, Users, Settings, BarChart2, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';
import { isFullMode } from '../lib/mode';

interface NavigationProps {
  activeTab: 'pulse' | 'students' | 'insights' | 'shoutouts' | 'settings';
  setActiveTab: (tab: 'pulse' | 'students' | 'insights' | 'shoutouts' | 'settings') => void;
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className="flex flex-col items-center gap-1.5 transition-all duration-200 relative px-5 py-1"
    >
      <div className="relative flex items-center justify-center">
        {active && (
          <motion.div
            layoutId="nav-pill"
            className="absolute inset-0 -mx-3 -my-1 bg-sage/10 rounded-2xl"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        {React.cloneElement(icon as React.ReactElement, {
          className: cn('w-6 h-6 relative z-10 transition-colors duration-200', active ? 'text-sage' : 'text-slate-400'),
          strokeWidth: active ? 2.5 : 1.8,
        })}
      </div>
      <span className={cn(
        'text-[11px] font-bold tracking-wide transition-colors duration-200',
        active ? 'text-sage' : 'text-slate-400'
      )}>
        {label}
      </span>
      <motion.div
        className="h-1 w-1 rounded-full bg-sage"
        animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      />
    </motion.button>
  );
}

export default function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 z-50 no-print nav-frosted" style={{ height: '68px' }}>
      <NavButton active={activeTab === 'pulse'} onClick={() => setActiveTab('pulse')} icon={<Activity />} label="Notes" />
      <NavButton active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<Users />} label="Students" />
      {isFullMode && <NavButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={<BarChart2 />} label="Insights" />}
      <NavButton active={activeTab === 'shoutouts'} onClick={() => setActiveTab('shoutouts')} icon={<Star />} label="Shoutouts" />
      <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Settings" />
    </nav>
  );
}
