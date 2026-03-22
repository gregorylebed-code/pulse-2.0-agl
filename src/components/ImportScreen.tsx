import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, CheckCircle2, ArrowRight, Mail, Phone, Cake, Users, School } from 'lucide-react';
import { toast } from 'sonner';
import { magicImport, parseBirthdays } from '../lib/gemini';
import { Student } from '../types';
import { supabase } from '../lib/supabase';

interface ImportScreenProps {
  onImportComplete: () => void;
  classes: string[];
  students: Student[];
  addStudent: (s: Omit<Student, 'id'>) => Promise<Student | null>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  userId: string;
}

export default function ImportScreen({ onImportComplete, classes, students, addStudent, updateStudent, userId }: ImportScreenProps) {
  const [rosterText, setRosterText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [matches, setMatches] = useState<{ imported: any, existing: any }[]>([]);
  const [newStudents, setNewStudents] = useState<any[]>([]);
  const [step, setStep] = useState<'input' | 'preview' | 'success'>('input');
  const [importSummary, setImportSummary] = useState<{ updated: number, added: number } | null>(null);
  const [defaultClassPeriod, setDefaultClassPeriod] = useState(classes[0] || 'Class 1');
  const [activeTab, setActiveTab] = useState<'roster' | 'birthdays' | 'google'>('roster');

  // Google Classroom state
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [gcCourses, setGcCourses] = useState<any[]>([]);
  const [gcLoadingCourses, setGcLoadingCourses] = useState(false);
  const [gcSelectedCourse, setGcSelectedCourse] = useState<any>(null);
  const [gcStudents, setGcStudents] = useState<{ name: string; email: string; photoUrl: string | null }[]>([]);
  const [gcLoadingStudents, setGcLoadingStudents] = useState(false);
  const [gcImporting, setGcImporting] = useState(false);
  const [gcClassPeriod, setGcClassPeriod] = useState(classes[0] || 'Class 1');
  const [gcNewClassName, setGcNewClassName] = useState('');

  // Birthday import state
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [birthdayText, setBirthdayText] = useState('');
  const [birthdayParsing, setBirthdayParsing] = useState(false);
  const [birthdayPreview, setBirthdayPreview] = useState<Array<{ studentName: string; birthMonth: number; birthDay: number; matchedId: string | null; manualId?: string }> | null>(null);
  const [birthdaySaving, setBirthdaySaving] = useState(false);

  // Check Google connection on mount; auto-switch tab if redirected back from Google
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === 'connected') {
      setActiveTab('google');
      // Clean up query param without reloading
      window.history.replaceState({}, '', window.location.pathname);
      toast.success('Google Classroom connected!');
    }
    if (params.get('google') === 'error') {
      window.history.replaceState({}, '', window.location.pathname);
      toast.error('Google connection failed. Please try again.');
    }

    supabase
      .from('google_tokens')
      .select('user_id')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => setGoogleConnected(!!data));
  }, [userId]);

  // Load courses when Google tab is opened and connected
  useEffect(() => {
    if (activeTab !== 'google' || !googleConnected) return;
    setGcLoadingCourses(true);
    fetch(`/api/google/courses?userId=${userId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setGcCourses(data);
      })
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setGcLoadingCourses(false));
  }, [activeTab, googleConnected, userId]);

  const handleSelectCourse = async (course: any) => {
    setGcSelectedCourse(course);
    setGcStudents([]);
    setGcLoadingStudents(true);
    try {
      const res = await fetch(`/api/google/students?userId=${userId}&courseId=${course.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setGcStudents(data);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setGcLoadingStudents(false);
    }
  };

  const handleGcImport = async () => {
    if (!gcStudents.length) return;
    const targetClass = gcClassPeriod === '__new__' ? gcNewClassName.trim() : gcClassPeriod;
    if (!targetClass) {
      toast.error('Please enter a class name.');
      return;
    }
    setGcImporting(true);
    try {
      let added = 0;
      let skipped = 0;
      const existingNames = students.map(s => s.name.toLowerCase().trim());
      for (const s of gcStudents) {
        if (!s.name) continue;
        if (existingNames.includes(s.name.toLowerCase().trim())) { skipped++; continue; }
        await addStudent({
          name: s.name,
          class_period: targetClass,
          parent_guardian_names: [],
          parent_emails: s.email ? [{ value: s.email, label: 'Email' }] : [],
          parent_phones: [],
          photo_url: s.photoUrl ?? null,
        } as Omit<Student, 'id' | 'created_at' | 'user_id'>);
        added++;
      }
      const msg = skipped > 0
        ? `Added ${added} new students (${skipped} already in roster)`
        : `Imported ${added} students from Google Classroom!`;
      toast.success(msg);
      setGcSelectedCourse(null);
      setGcStudents([]);
      onImportComplete();
    } catch {
      toast.error('Import failed. Please try again.');
    } finally {
      setGcImporting(false);
    }
  };

  const handleParseBirthdays = async () => {
    if (!birthdayText.trim()) return;
    setBirthdayParsing(true);
    try {
      const results = await parseBirthdays(birthdayText, students.map(s => s.name));
      const withMatch = results.map(r => {
        const aiMatch = r.matchedName ? students.find(s => s.name.toLowerCase() === r.matchedName!.toLowerCase()) : null;
        const localMatch = !aiMatch ? students.find(s =>
          s.name.toLowerCase().includes(r.studentName.toLowerCase()) ||
          r.studentName.toLowerCase().includes(s.name.toLowerCase())
        ) : null;
        return { studentName: r.studentName, birthMonth: r.birthMonth, birthDay: r.birthDay, matchedId: (aiMatch ?? localMatch)?.id ?? null };
      });
      setBirthdayPreview(withMatch);
    } catch {
      toast.error('Failed to parse birthdays');
    } finally {
      setBirthdayParsing(false);
    }
  };

  const handleSaveBirthdays = async () => {
    if (!birthdayPreview) return;
    setBirthdaySaving(true);
    const matched = birthdayPreview.filter(b => b.manualId || b.matchedId);
    try {
      for (const b of matched) {
        await updateStudent((b.manualId || b.matchedId)!, { birth_month: b.birthMonth, birth_day: b.birthDay });
      }
      toast.success(`Saved ${matched.length} birthday${matched.length !== 1 ? 's' : ''}!`);
      setBirthdayText('');
      setBirthdayPreview(null);
    } catch {
      toast.error('Failed to save birthdays');
    } finally {
      setBirthdaySaving(false);
    }
  };

  // Simple fallback: reads one student name per line, extracts email/phone if present.
  // Works with lists like: "John Smith" or "Maria G - maria@email.com - 555-1234"
  const parseRosterManually = (text: string): any[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Strip leading numbers/bullets
        const cleaned = line.replace(/^[\d]+[.)]\s*/, '').replace(/^[-*•]\s*/, '');
        const parts = cleaned.split(/\s*[-–|]\s*|\s*[,]\s*/);
        const name = parts[0].trim();
        if (!name) return null;
        const emailMatch = line.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
        const phoneMatch = line.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
        return {
          name,
          parent_emails: emailMatch ? [emailMatch[0]] : [],
          parent_phones: phoneMatch ? [phoneMatch[0]] : [],
          parent_guardian_names: []
        };
      })
      .filter(Boolean);
  };

  const handleProcess = async () => {
    if (!rosterText.trim()) return;
    setIsProcessing(true);
    let data: any[] = [];
    try {
      data = await magicImport(rosterText);
      if (!data || data.length === 0) throw new Error('AI returned empty');
    } catch (aiError) {
      console.warn('AI import unavailable, using line parser:', aiError);
      data = parseRosterManually(rosterText);
      if (data.length === 0) {
        toast.error('No names found. Put each student on a separate line.');
        setIsProcessing(false);
        return;
      }
      toast.info(`Simple import: ${data.length} students found.`, { duration: 3000 });
    }
    try {
      const existingStudents: Student[] = students;

      const foundMatches: { imported: any, existing: any }[] = [];
      const foundNew: any[] = [];

      data.forEach((importedStudent: any) => {
        const importedName = importedStudent.name.trim();
        const match = existingStudents.find(s => {
          const sName = s.name.trim().toLowerCase();
          const iName = importedName.toLowerCase();
          if (sName === iName) return true;
          const sParts = sName.split(' ');
          const iParts = iName.split(' ');
          const sFirstName = sParts[0];
          const iFirstName = iParts[0];
          if (sFirstName !== iFirstName) return false;
          const sLastName = sParts.slice(1).join(' ');
          const iLastName = iParts.slice(1).join(' ');
          if (!sLastName || !iLastName) return true;
          if (sLastName[0] === iLastName[0]) return true;
          return false;
        });
        if (match) {
          foundMatches.push({ imported: importedStudent, existing: match });
        } else {
          foundNew.push(importedStudent);
        }
      });

      setMatches(foundMatches);
      setNewStudents(foundNew);
      setStep('preview');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to parse text.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      let updatedCount = 0;
      let addedCount = 0;

      const extractString = (val: any) => {
        if (!val) return val;
        if (typeof val === 'object') return val.value || val.label || '';
        return String(val);
      };

      // Update existing matched students
      for (const match of matches) {
        const { imported, existing } = match;
        const updatedEmails = [...(existing.parent_emails || [])];
        if (imported.parent_emails) {
          imported.parent_emails.forEach((e: any) => {
            if (!updatedEmails.some(ex => (typeof ex === 'object' ? ex.value : ex) === (typeof e === 'object' ? e.value : e))) {
              updatedEmails.push(e);
            }
          });
        }
        const updatedPhones = [...(existing.parent_phones || [])];
        if (imported.parent_phones) {
          imported.parent_phones.forEach((p: any) => {
            if (!updatedPhones.some(ex => (typeof ex === 'object' ? ex.value : ex) === (typeof p === 'object' ? p.value : p))) {
              updatedPhones.push(p);
            }
          });
        }
        await updateStudent(existing.id, {
          parent_emails: updatedEmails,
          parent_phones: updatedPhones,
          class_period: defaultClassPeriod,
        });
        updatedCount++;
      }

      // Add brand-new students
      for (const s of newStudents) {
        await addStudent({
          name: extractString(s.name),
          class_period: defaultClassPeriod,
          parent_guardian_names: Array.isArray(s.parent_guardian_names) ? s.parent_guardian_names.map(extractString) : [],
          parent_emails: Array.isArray(s.parent_emails) ? s.parent_emails : [],
          parent_phones: Array.isArray(s.parent_phones) ? s.parent_phones : [],
        } as Omit<Student, 'id' | 'created_at' | 'user_id'>);
        addedCount++;
      }

      setImportSummary({ updated: updatedCount, added: addedCount });
      setStep('success');
      toast.success('Import completed successfully!');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('An error occurred during import.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      {/* Tab switcher */}
      <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-100">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'roster' ? 'bg-sage text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Users className="w-3.5 h-3.5" /> Roster
        </button>
        <button
          onClick={() => setActiveTab('birthdays')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'birthdays' ? 'bg-pink-400 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Cake className="w-3.5 h-3.5" /> Birthdays
        </button>
        <button
          onClick={() => setActiveTab('google')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'google' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <School className="w-3.5 h-3.5" /> Google
        </button>
      </div>

      {/* Birthday import tab */}
      {activeTab === 'birthdays' && (
        <div className="bg-white rounded-[32px] p-8 card-shadow border border-sage/5 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Import Birthdays</h2>
            <p className="text-xs text-slate-500 mt-1">Paste any list of names and birthdays — AI will figure it out.</p>
          </div>
          {!birthdayPreview ? (
            <>
              <textarea
                value={birthdayText}
                onChange={e => setBirthdayText(e.target.value)}
                placeholder={"Sarah Johnson - March 14\nMike Chen 5/22\nEmma Davis, born April 3rd..."}
                rows={8}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium focus:outline-none focus:border-pink-200 resize-none"
              />
              <button
                onClick={handleParseBirthdays}
                disabled={!birthdayText.trim() || birthdayParsing}
                className="w-full py-4 bg-pink-400 text-white rounded-[24px] font-bold text-sm hover:bg-pink-500 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {birthdayParsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</> : <><Sparkles className="w-4 h-4" /> Parse with AI</>}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {birthdayPreview.map((b, i) => {
                  const resolved = b.manualId || b.matchedId;
                  const resolvedName = resolved ? students.find(s => s.id === resolved)?.name : null;
                  return (
                    <div key={i} className={`px-3 py-2 rounded-xl text-xs font-medium ${resolved ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'}`}>
                      <div className="flex items-center justify-between">
                        <span className={resolved ? 'text-slate-700' : 'text-amber-600'}>{b.studentName}</span>
                        <span className="text-slate-500 ml-2">{MONTH_NAMES[b.birthMonth - 1]} {b.birthDay}</span>
                      </div>
                      {!b.matchedId && (
                        <select
                          value={b.manualId || ''}
                          onChange={e => setBirthdayPreview(prev => prev!.map((x, j) => j === i ? { ...x, manualId: e.target.value || undefined } : x))}
                          className="mt-1.5 w-full px-2 py-1 bg-white border border-amber-200 rounded-lg text-[11px] font-medium focus:outline-none focus:border-pink-300"
                        >
                          <option value="">— pick student —</option>
                          {students.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      )}
                      {b.matchedId && resolvedName && resolvedName !== b.studentName && (
                        <p className="text-[10px] text-green-500 mt-0.5">→ {resolvedName}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400">{birthdayPreview.filter(b => b.manualId || b.matchedId).length} of {birthdayPreview.length} ready to save.</p>
              <div className="flex gap-2">
                <button onClick={() => setBirthdayPreview(null)} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-full font-bold text-sm hover:bg-slate-50 transition-colors">
                  Back
                </button>
                <button
                  onClick={handleSaveBirthdays}
                  disabled={birthdaySaving || birthdayPreview.filter(b => b.manualId || b.matchedId).length === 0}
                  className="flex-1 py-3 bg-pink-400 text-white rounded-full font-bold text-sm hover:bg-pink-500 transition-colors disabled:opacity-40"
                >
                  {birthdaySaving ? 'Saving...' : 'Save Birthdays'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Google Classroom tab */}
      {activeTab === 'google' && (
        <div className="bg-white rounded-[32px] p-8 card-shadow border border-sage/5 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Google Classroom</h2>
            <p className="text-xs text-slate-500 mt-1">Import your class roster directly from Google Classroom.</p>
          </div>

          {/* Not yet connected */}
          {googleConnected === false && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-700 font-medium">
                Connect your Google account to import students from any of your active classes.
              </div>
              <button
                onClick={() => window.location.href = `/api/google/auth?userId=${userId}`}
                className="w-full py-4 bg-blue-500 text-white rounded-[24px] font-bold text-sm hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <School className="w-4 h-4" /> Connect Google Classroom
              </button>
            </div>
          )}

          {/* Loading connection status */}
          {googleConnected === null && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
          )}

          {/* Connected — course picker */}
          {googleConnected === true && !gcSelectedCourse && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your Active Classes</p>
              {gcLoadingCourses ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : gcCourses.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No active classes found in Google Classroom.</p>
              ) : (
                <div className="space-y-2">
                  {gcCourses.map(course => (
                    <button
                      key={course.id}
                      onClick={() => handleSelectCourse(course)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50 transition-all group"
                    >
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700">{course.name}</p>
                        {course.section && <p className="text-xs text-slate-400 mt-0.5">{course.section}</p>}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400" />
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  setGoogleConnected(false);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Disconnect Google Classroom
              </button>
            </div>
          )}

          {/* Students preview */}
          {googleConnected === true && gcSelectedCourse && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">{gcSelectedCourse.name}</p>
                  <p className="text-xs text-slate-400">{gcStudents.length} students</p>
                </div>
                <button
                  onClick={() => { setGcSelectedCourse(null); setGcStudents([]); }}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  ← Back
                </button>
              </div>

              {gcLoadingStudents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {gcStudents.map((s, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-xl">
                        <span className="text-sm font-medium text-slate-700">{s.name}</span>
                        {s.email && <span className="text-[10px] text-slate-400 ml-2 truncate max-w-[140px]">{s.email}</span>}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Assign to:</label>
                      <select
                        value={gcClassPeriod}
                        onChange={e => setGcClassPeriod(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-600 focus:outline-none"
                      >
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__new__">+ New class...</option>
                      </select>
                    </div>
                    {gcClassPeriod === '__new__' && (
                      <input
                        autoFocus
                        type="text"
                        value={gcNewClassName}
                        onChange={e => setGcNewClassName(e.target.value)}
                        placeholder="Class name (e.g. Period 4)"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-blue-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-400"
                      />
                    )}
                  </div>

                  <button
                    onClick={handleGcImport}
                    disabled={gcImporting || gcStudents.length === 0 || (gcClassPeriod === '__new__' && !gcNewClassName.trim())}
                    className="w-full py-4 bg-blue-500 text-white rounded-[24px] font-bold text-sm hover:bg-blue-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {gcImporting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                      : <><CheckCircle2 className="w-4 h-4" /> Import {gcStudents.length} Students</>
                    }
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'roster' && <div className="bg-white rounded-[32px] p-8 card-shadow border border-sage/5 space-y-6">
        {step === 'input' && (
          <>
            <div>
              <h2 className="text-xl font-bold text-sage-dark">Batch Import Roster</h2>
              <p className="text-xs text-slate-500 mt-1">Paste names, emails, and phone numbers below. Our AI will extract the details for you.</p>
            </div>

            <textarea
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              placeholder="e.g. John Smith - jsmith@email.com&#10;Brianna S. (brianna.s@web.com)..."
              className="w-full min-h-[240px] p-6 bg-slate-50 border border-slate-100 rounded-3xl focus:outline-none focus:ring-4 focus:ring-sage/5 focus:border-sage transition-all text-sm resize-none leading-relaxed"
            />

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Assign to Class Period:</label>
                <select
                  value={defaultClassPeriod}
                  onChange={(e) => setDefaultClassPeriod(e.target.value)}
                  className="flex-1 sm:w-40 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-600 focus:outline-none"
                >
                  {classes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleProcess}
                disabled={isProcessing || !rosterText.trim()}
                className="w-full sm:w-auto px-8 py-3.5 bg-slate-400 text-white rounded-[24px] font-bold text-sm uppercase tracking-widest hover:bg-slate-500 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Process with AI</>}
              </button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-sage-dark">Review Matches</h2>
              <button onClick={() => setStep('input')} className="text-xs text-terracotta font-bold hover:underline">
                Cancel
              </button>
            </div>

            {matches.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Matches Found ({matches.length})</h3>
                <p className="text-xs text-slate-500">These imported students match existing roster entries. Their profiles will be updated.</p>
                {matches.map((m, i) => (
                  <div key={i} className="bg-sage/5 p-4 rounded-2xl border border-sage/20 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sage-dark text-sm">{m.imported.name} <span className="text-slate-400 font-normal text-xs ml-2">(Existing: {m.existing.name})</span></h4>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {m.imported.parent_emails && m.imported.parent_emails.map((email: any, idx: number) => {
                          const emailStr = typeof email === 'object' ? email.value : email;
                          return emailStr ? <span key={`email-${idx}`} className="text-[9px] text-slate-500 flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {emailStr}</span> : null;
                        })}
                        {m.imported.parent_phones && m.imported.parent_phones.map((phone: any, idx: number) => {
                          const phoneStr = typeof phone === 'object' ? phone.value : phone;
                          return phoneStr ? <span key={`phone-${idx}`} className="text-[9px] text-slate-500 flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {phoneStr}</span> : null;
                        })}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-sage/20 text-sage-dark text-[8px] font-bold uppercase tracking-widest rounded-md">
                      Update
                    </span>
                  </div>
                ))}
              </div>
            )}

            {newStudents.length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="text-sm font-bold text-slate-700">New Students ({newStudents.length})</h3>
                <p className="text-xs text-slate-500">These students will be added as new entries.</p>
                {newStudents.map((s, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{s.name}</h4>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {s.parent_emails && s.parent_emails.map((email: any, idx: number) => {
                          const emailStr = typeof email === 'object' ? email.value : email;
                          return emailStr ? <span key={`email-${idx}`} className="text-[9px] text-slate-400 flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {emailStr}</span> : null;
                        })}
                        {s.parent_phones && s.parent_phones.map((phone: any, idx: number) => {
                          const phoneStr = typeof phone === 'object' ? phone.value : phone;
                          return phoneStr ? <span key={`phone-${idx}`} className="text-[9px] text-slate-400 flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {phoneStr}</span> : null;
                        })}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-slate-200 text-slate-600 text-[8px] font-bold uppercase tracking-widest rounded-md">
                      New
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="w-full py-5 bg-sage text-white rounded-[24px] font-bold text-sm uppercase tracking-widest hover:bg-sage-dark transition-all shadow-xl shadow-sage/20 flex items-center justify-center gap-3 disabled:opacity-50 mt-6"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirm All</>}
            </button>
          </div>
        )}

        {step === 'success' && importSummary && (
          <div className="space-y-6">
            <div className="p-6 bg-sage/10 border border-sage/20 rounded-3xl flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-sage/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-sage" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-sage-dark">Import Complete</h4>
                <p className="text-sm text-sage mt-2">
                  Updated {importSummary.updated} existing students.<br />
                  Added {importSummary.added} new students.
                </p>
              </div>
            </div>
            <button
              onClick={onImportComplete}
              className="w-full py-5 bg-sage text-white rounded-[24px] font-bold text-sm uppercase tracking-widest hover:bg-sage-dark transition-all shadow-xl shadow-sage/20 flex items-center justify-center gap-3"
            >
              Go to Roster <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>}
    </motion.div>
  );
}
