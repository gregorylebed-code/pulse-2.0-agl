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
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-colors duration-200 min-w-0 flex-1"
    >
      {active && (
        <motion.div
          layoutId="nav-active"
          className="absolute inset-0 bg-white rounded-2xl"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      {React.cloneElement(icon as React.ReactElement, {
        className: cn('w-5 h-5 relative z-10 transition-colors duration-200', active ? 'text-teal-600' : 'text-white'),
        strokeWidth: active ? 2.5 : 1.8,
      })}
      <span className={cn(
        'text-[10px] font-black tracking-wide relative z-10 transition-colors duration-200',
        active ? 'text-teal-600' : 'text-white'
      )}>
        {label}
      </span>
    </motion.button>
  );
}

export default function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 no-print flex items-center justify-around px-2"
      style={{ background: '#14B8A6', paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <NavButton active={activeTab === 'pulse'} onClick={() => setActiveTab('pulse')} icon={<Activity />} label="Log Notes" />
      <NavButton active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<Users />} label="Students" />
      {isFullMode && <NavButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={<BarChart2 />} label="Insights" />}
      {isFullMode && <NavButton active={activeTab === 'shoutouts'} onClick={() => setActiveTab('shoutouts')} icon={<Star />} label="Shoutouts" />}
      <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Settings" />
    </nav>
  );
}
