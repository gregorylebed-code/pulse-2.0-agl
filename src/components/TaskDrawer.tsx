import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  ClipboardList, Copy, Download, X, Plus, GripVertical, Palette
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { cn } from '../utils/cn';


interface Task {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  color?: string;
}

const TASK_COLORS: Record<string, any> = {
  default: { label: 'Default', bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-900', dot: 'bg-slate-400' },
  urgent: { label: 'Urgent', bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-slate-900', dot: 'bg-rose-500' },
  soon: { label: 'Soon', bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-slate-900', dot: 'bg-orange-500' },
  norush: { label: 'No Rush', bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-slate-900', dot: 'bg-yellow-500' },
  personal: { label: 'Personal', bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-slate-900', dot: 'bg-emerald-500' },
  misc: { label: 'Misc', bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-slate-900', dot: 'bg-blue-500' },
};

interface TaskDrawerProps {
  showTasks: boolean;
  setShowTasks: (v: boolean) => void;
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<any>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export default function TaskDrawer({
  showTasks,
  setShowTasks,
  tasks,
  addTask,
  updateTask,
  deleteTask,
}: TaskDrawerProps) {
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const [activeColorMenuId, setActiveColorMenuId] = useState<string | null>(null);
  const [taskUndoToast, setTaskUndoToast] = useState<{ label: string; onUndo: () => void } | null>(null);
  const taskUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>(() => tasks.map(t => t.id));
  const [hiddenTaskIds, setHiddenTaskIds] = useState<Set<string>>(new Set());

  // Keep localOrder in sync when tasks are added/removed externally
  useEffect(() => {
    setLocalOrder(prev => {
      const existingIds = new Set(prev);
      const newIds = tasks.filter(t => !existingIds.has(t.id)).map(t => t.id);
      const filtered = prev.filter(id => tasks.some(t => t.id === id));
      return [...newIds, ...filtered];
    });
  }, [tasks]);

  const orderedTasks = (localOrder.length > 0 ? localOrder : tasks.map(t => t.id))
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => !!t && !hiddenTaskIds.has(t.id));

  const hideWithUndo = (id: string, label: string) => {
    setHiddenTaskIds(prev => new Set([...prev, id]));
    if (taskUndoTimerRef.current) clearTimeout(taskUndoTimerRef.current);
    const timer = setTimeout(() => {
      deleteTask(id);
      setTaskUndoToast(null);
      setHiddenTaskIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 5000);
    taskUndoTimerRef.current = timer;
    setTaskUndoToast({
      label,
      onUndo: () => {
        clearTimeout(timer);
        setTaskUndoToast(null);
        setHiddenTaskIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      },
    });
  };

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    await addTask({
      text: newTaskText.trim(),
      completed: false,
      color: 'default'
    });
    setNewTaskText('');
  };

  const handleSetTaskColor = async (id: string, color: string) => {
    await updateTask(id, { color });
    setActiveColorMenuId(null);
  };

  const handleToggleTask = (id: string) => {
    hideWithUndo(id, 'Task completed! ✓');
  };

  const handleStartEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskText(task.text);
  };

  const handleUpdateTaskText = async () => {
    if (!editingTaskId) return;
    await updateTask(editingTaskId, { text: editTaskText.trim() || tasks.find(t => t.id === editingTaskId)?.text });
    setEditingTaskId(null);
    setEditTaskText('');
  };

  const handleCopyTasks = () => {
    const text = tasks.map(t => `${t.completed ? '✓' : '○'} ${t.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => toast.success('Tasks copied to clipboard!'));
  };

  const handleExportTasksPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    doc.setFontSize(16);
    doc.text('Daily Tasks', 20, 20);
    doc.setFontSize(10);
    doc.text(date, 20, 30);
    let y = 45;
    tasks.forEach(task => {
      const line = `${task.completed ? '✓' : '○'}  ${task.text}`;
      const lines = doc.splitTextToSize(line, 170);
      lines.forEach((l: string) => {
        doc.text(l, 20, y);
        y += 8;
        if (y > 270) { doc.addPage(); y = 20; }
      });
    });
    doc.save('tasks.pdf');
  };

  const handleOnDragEnd = (result: any) => {
    if (!result.destination) return;
    const newOrder = orderedTasks.map(t => t.id);
    const [moved] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, moved);
    setLocalOrder(newOrder);
  };

  return (
    <>
      <AnimatePresence>
        {showTasks && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTasks(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] no-print"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-cream-light z-[70] shadow-2xl p-6 flex flex-col no-print"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sage/10 rounded-xl">
                    <ClipboardList className="w-5 h-5 text-sage" />
                  </div>
                  <h2 className="text-2xl font-black text-sage" style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.35)' }}>Daily Tasks</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleCopyTasks} title="Copy to clipboard" className="p-2 text-slate-400 hover:text-sage rounded-full transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={handleExportTasksPDF} title="Export as PDF" className="p-2 text-slate-400 hover:text-sage rounded-full transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowTasks(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder="What needs doing?"
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-100 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-sage/20 shadow-inner"
                />
                <button
                  onClick={handleAddTask}
                  className="p-2.5 bg-sage text-white rounded-full hover:bg-sage-dark transition-all shadow-md shadow-sage/10"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {orderedTasks.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <p className="text-xs font-medium text-slate-400">All caught up!</p>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleOnDragEnd}>
                    <Droppable droppableId="tasks-list">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                          {orderedTasks.map((task, index) => (
                            <Draggable key={task.id} {...({ draggableId: task.id, index } as any)}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    "group flex items-start gap-3 p-4 rounded-[32px] border-2 transition-all relative hover:shadow-md",
                                    TASK_COLORS[task.color || 'default'].bg,
                                    TASK_COLORS[task.color || 'default'].border,
                                    snapshot.isDragging && "shadow-xl border-sage/40 ring-2 ring-sage/10 scale-[1.02] z-[100] cursor-grabbing"
                                  )}
                                >
                                  <div {...provided.dragHandleProps} className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing transition-colors">
                                    <GripVertical className="w-4 h-4" />
                                  </div>

                                  <div className="flex-1 flex items-start gap-4 min-w-0">
                                    <div className="flex flex-col items-center gap-2 mt-0.5 shrink-0">
                                      <button
                                        onClick={() => handleToggleTask(task.id)}
                                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all bg-white border-slate-200 hover:border-sage"
                                      >
                                      </button>

                                      <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveColorMenuId(activeColorMenuId === task.id ? null : task.id);
                                            }}
                                            className={cn(
                                              "p-1 transition-all rounded-lg priority-menu-trigger",
                                              activeColorMenuId === task.id ? "text-sage bg-sage/10" : "text-slate-300 hover:text-sage"
                                            )}
                                          >
                                            <Palette className="w-3.5 h-3.5" />
                                          </button>

                                          {activeColorMenuId === task.id && (
                                            <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl flex gap-1.5 p-2 transition-all z-[110] animate-in fade-in slide-in-from-top-1 duration-200 priority-menu">
                                              {(Object.keys(TASK_COLORS)).map(c => (
                                                <button
                                                  key={c}
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleSetTaskColor(task.id, c);
                                                  }}
                                                  className={cn(
                                                    "w-5 h-5 rounded-full border-2 transition-transform hover:scale-125",
                                                    TASK_COLORS[c].dot,
                                                    task.color === c || (!task.color && c === 'default')
                                                      ? "border-sage shadow-md scale-110"
                                                      : "border-white"
                                                  )}
                                                  title={TASK_COLORS[c].label}
                                                />
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0" onClick={() => handleStartEditingTask(task)}>
                                      {editingTaskId === task.id ? (
                                        <textarea
                                          autoFocus
                                          value={editTaskText}
                                          onChange={(e) => setEditTaskText(e.target.value)}
                                          onBlur={handleUpdateTaskText}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              handleUpdateTaskText();
                                            }
                                          }}
                                          className="w-full px-2 py-1 bg-white border border-sage rounded-lg text-xs font-medium focus:outline-none min-h-[60px] resize-none"
                                        />
                                      ) : (
                                        <div className="flex flex-col gap-1">
                                          <p className="text-sm font-bold cursor-pointer transition-all break-words leading-relaxed text-slate-800">
                                            {task.text}
                                          </p>
                                          {!task.completed && (
                                            <span className="text-[11px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    onClick={(e) => { e.stopPropagation(); hideWithUndo(task.id, 'Task deleted'); }}
                                    className="mt-0.5 p-1 text-slate-300 hover:text-terracotta transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </div>

              <AnimatePresence>
                {taskUndoToast && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="mt-4 flex items-center justify-between bg-slate-800 text-white px-4 py-3 rounded-2xl"
                  >
                    <span className="text-xs font-medium">{taskUndoToast.label}</span>
                    <button
                      onClick={() => { taskUndoToast.onUndo(); setTaskUndoToast(null); }}
                      className="text-teal-400 font-bold text-xs hover:text-teal-300 transition-colors ml-4"
                    >
                      Undo
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
