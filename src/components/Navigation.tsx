import React from 'react';
import { Activity, Users, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';

interface NavigationProps {
  activeTab: 'pulse' | 'students' | 'settings';
  setActiveTab: (tab: 'pulse' | 'students' | 'settings') => void;
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 transition-all duration-300 relative',
        active ? 'text-[#4169E1]' : 'text-slate-400 hover:text-slate-500'
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-7 h-7', strokeWidth: 2.5 })}
      <span className={cn('text-sm font-black', !active && 'text-slate-500')}>{label}</span>
      {active && (
        <motion.div
          layoutId="nav-dot"
          className="absolute -bottom-2.5 w-2 h-2 bg-[#4169E1] rounded-full"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      )}
    </button>
  );
}

export default function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white shadow-[0_-2px_15px_rgba(0,0,0,0.05)] flex items-center justify-around px-8 z-50 no-print border-t border-slate-100">
      <NavButton active={activeTab === 'pulse'} onClick={() => setActiveTab('pulse')} icon={<Activity />} label="Pulse" />
      <NavButton active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<Users />} label="Students" />
      <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Settings" />
    </nav>
  );
}
