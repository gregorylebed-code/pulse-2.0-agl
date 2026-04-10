import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Student } from '../types';
import { getDisplayName } from '../utils/getDisplayName';
import { useAliasMode } from '../context/AliasModeContext';
import { cn } from '../utils/cn';

interface SeatingChartProps {
  students: Student[];
  seatingChart: Record<string, { x: number; y: number }>;
  saveSeatingChart: (chart: Record<string, { x: number; y: number }>) => Promise<void>;
  onStudentClick: (id: string) => void;
  statusDot: Record<string, string>;
  getStudentStatus: (name: string) => string;
}

export default function SeatingChart({ students, seatingChart, saveSeatingChart, onStudentClick, statusDot, getStudentStatus }: SeatingChartProps) {
  const { aliasMode } = useAliasMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [localChart, setLocalChart] = useState(seatingChart);

  const handleDragEnd = (studentId: string, info: any) => {
    // Info contains the absolute offset to add from current x,y
    const current = localChart[studentId] || { x: 0, y: 0 };
    const newX = current.x + info.offset.x;
    const newY = current.y + info.offset.y;
    
    // Snap to grid of 10px could be nice but let's keep it freeform
    const updated = { ...localChart, [studentId]: { x: newX, y: newY } };
    setLocalChart(updated);
    saveSeatingChart(updated);
  };

  const getAvatarColor = (name: string) => {
    const avatarColors = [
      'bg-blue-100 text-blue-600 border-blue-200',
      'bg-green-100 text-green-600 border-green-200',
      'bg-amber-100 text-amber-600 border-amber-200',
      'bg-purple-100 text-purple-600 border-purple-200',
      'bg-rose-100 text-rose-600 border-rose-200',
      'bg-cyan-100 text-cyan-600 border-cyan-200'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[600px] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-inner"
    >
      <div className="absolute top-4 left-4 text-xs font-black text-slate-400 bg-white/80 px-3 py-1.5 rounded-full z-0">
        FRONT OF ROOM
      </div>
      
      {students.map(s => {
        const coords = localChart[s.id] || { x: 50, y: 50 }; // default to top left roughly
        const status = getStudentStatus(s.name);
        
        return (
          <motion.div
            key={s.id}
            drag
            dragMomentum={false}
            dragConstraints={containerRef}
            onDragEnd={(e, info) => handleDragEnd(s.id, info)}
            initial={{ x: coords.x, y: coords.y }}
            animate={{ x: coords.x, y: coords.y }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute z-10 w-20 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:z-20"
          >
            <div 
              className={cn(
                "bg-white p-1 rounded-2xl shadow-sm border-2 flex flex-col items-center gap-1 w-full relative",
                "border-slate-200 hover:border-sage/50 transition-colors"
              )}
              onClick={(e) => {
                // Ignore clicks that were drags
                if (e.detail === 0) return; 
                onStudentClick(s.id);
              }}
            >
              <span className={cn('absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white', statusDot[status])} />
              
              {s.photo_url ? (
                <img src={s.photo_url} alt={s.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center border text-[13px] font-black', getAvatarColor(s.name))} style={{ fontFamily: "'Boogaloo', cursive" }}>
                  {aliasMode ? getDisplayName(s, true).substring(0, 2).toUpperCase() : s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
              )}
              
              <h4 className="text-[10px] font-bold text-slate-700 leading-tight text-center line-clamp-2 w-full break-words">
                {getDisplayName(s, aliasMode)}
              </h4>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
