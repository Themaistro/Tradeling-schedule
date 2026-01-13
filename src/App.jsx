import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { Settings, AlertCircle, CheckCircle, Calendar, Users, TrendingUp, RefreshCw, X, Plus, Info, Moon, Sun, Clock, Layout, Plane, BarChart2, Trash2, Edit3, Briefcase, Download, Upload, FileText, Save, List, ShieldAlert, Phone, MessageSquare, FileQuestion, Monitor, Award, PieChart, Copy, ChevronRight, Menu, Zap, Search, Filter, ZoomIn, ZoomOut, Loader2, AlertTriangle, Check, AlertOctagon, ArrowRight, Shuffle, Activity, History, PlayCircle, RotateCcw, Lock } from 'lucide-react';

// --- CONSTANTS ---
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TASK_TYPES = ['Calls', 'Chats', 'Tickets', 'Admin', 'Training']; 
const COLOR_OPTIONS = ['orange', 'blue', 'slate', 'emerald', 'rose', 'purple', 'cyan'];
const YEAR_OPTIONS = Array.from({length: 5}, (_, i) => new Date().getFullYear() + i);

// --- STORAGE KEYS ---
const CONFIG_KEY = 'tradeling_config_v63';
const AGENTS_KEY = 'tradeling_agents_v63';
const SCHEDULE_PREFIX = 'tradeling_schedule_v63_';

const DEFAULT_SHIFTS = [
    { id: 'am', name: 'Morning', start: '09:00', end: '18:00', color: 'orange' },
    { id: 'pm', name: 'Evening', start: '13:00', end: '22:00', color: 'blue' }
];

const DEFAULT_CONFIG = {
    projectStartDate: new Date().toISOString().split('T')[0], 
    scheduleBuildCutoff: 20,
    maxConsecutiveDays: 5,
    generationScope: 'full', // 'full', 'half_1', 'half_2'
    shifts: DEFAULT_SHIFTS,
    rules: ALL_DAYS.reduce((acc, day) => {
        const isWeekend = day === 'Saturday' || day === 'Sunday';
        const target = isWeekend ? 3 : 4; 
        acc[day] = {
            am: { minStaff: target, calls: Math.max(1, Math.floor(target/2)), chats: 1, tickets: 0 },
            pm: { minStaff: target, calls: Math.max(1, Math.floor(target/2)), chats: 1, tickets: 0 }
        };
        return acc;
    }, {})
};

const DEFAULT_AGENTS = [
    { name: 'John Smith', shiftId: 'am', preferredDaysOff1: ['Saturday', 'Sunday'], preferredDaysOff2: ['Friday', 'Saturday'], pto: [], errors: {} },
    { name: 'Sarah Johnson', shiftId: 'am', preferredDaysOff1: ['Saturday', 'Sunday'], preferredDaysOff2: ['Sunday', 'Monday'], pto: [], errors: {} },
    { name: 'Mike Davis', shiftId: 'pm', preferredDaysOff1: ['Friday', 'Saturday'], preferredDaysOff2: ['Thursday', 'Friday'], pto: [], errors: {} },
    { name: 'Emily Chen', shiftId: 'any', preferredDaysOff1: ['Sunday', 'Monday'], preferredDaysOff2: ['Saturday', 'Sunday'], pto: [], errors: {} }, 
    { name: 'David Brown', shiftId: 'pm', preferredDaysOff1: ['Monday', 'Tuesday'], preferredDaysOff2: ['Sunday', 'Monday'], pto: [], errors: {} },
    { name: 'Alex Wilson', shiftId: 'am', preferredDaysOff1: ['Wednesday', 'Thursday'], preferredDaysOff2: ['Tuesday', 'Wednesday'], pto: [], errors: {} },
    { name: 'Lisa Ray', shiftId: 'pm', preferredDaysOff1: ['Tuesday', 'Wednesday'], preferredDaysOff2: ['Wednesday', 'Thursday'], pto: [], errors: {} },
    { name: 'Tom Hiddleston', shiftId: 'any', preferredDaysOff1: ['Thursday', 'Friday'], preferredDaysOff2: ['Friday', 'Saturday'], pto: [], errors: {} },
    { name: 'Chris Evans', shiftId: 'am', preferredDaysOff1: ['Saturday', 'Sunday'], preferredDaysOff2: ['Friday', 'Saturday'], pto: [], errors: {} },
    { name: 'Scarlett Jo', shiftId: 'pm', preferredDaysOff1: ['Sunday', 'Monday'], preferredDaysOff2: ['Saturday', 'Sunday'], pto: [], errors: {} },
    { name: 'Mark Ruffalo', shiftId: 'am', preferredDaysOff1: ['Friday', 'Saturday'], preferredDaysOff2: ['Thursday', 'Friday'], pto: [], errors: {} },
    { name: 'Jeremy Renner', shiftId: 'pm', preferredDaysOff1: ['Monday', 'Tuesday'], preferredDaysOff2: ['Tuesday', 'Wednesday'], pto: [], errors: {} },
    { name: 'Paul Rudd', shiftId: 'any', preferredDaysOff1: ['Wednesday', 'Thursday'], preferredDaysOff2: ['Thursday', 'Friday'], pto: [], errors: {} }
];

// --- SAFETY UTILS ---
const repairConfig = (loadedConfig) => {
    try {
        const safe = { ...DEFAULT_CONFIG, ...loadedConfig };
        if (!Array.isArray(safe.shifts)) safe.shifts = DEFAULT_SHIFTS;
        if (!safe.rules) safe.rules = {};
        if (!safe.generationScope) safe.generationScope = 'full';
        ALL_DAYS.forEach(day => {
            if (!safe.rules[day]) safe.rules[day] = {};
            safe.shifts.forEach(shift => {
                if (!safe.rules[day][shift.id]) safe.rules[day][shift.id] = { minStaff: 3, calls: 1, chats: 1, tickets: 0 };
            });
        });
        if (!safe.projectStartDate) safe.projectStartDate = new Date().toISOString().split('T')[0];
        return safe;
    } catch (e) { return DEFAULT_CONFIG; }
};

const repairAgents = (loadedAgents) => {
    if (!Array.isArray(loadedAgents)) return DEFAULT_AGENTS;
    return loadedAgents.map(a => ({
        ...a,
        pto: Array.isArray(a.pto) ? a.pto : [],
        preferredDaysOff1: Array.isArray(a.preferredDaysOff1) ? a.preferredDaysOff1 : ['Saturday', 'Sunday'],
        preferredDaysOff2: Array.isArray(a.preferredDaysOff2) ? a.preferredDaysOff2 : ['Friday', 'Saturday'],
        errors: a.errors || {}
    }));
};

// --- HOOKS ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

function useTheme() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        try {
            const saved = localStorage.getItem('theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch (e) { return true; }
    });

    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(prev => !prev);
    return { isDarkMode, toggleTheme };
}

// --- STYLED COMPONENTS ---
const GlassCard = ({ children, className = "", isDarkMode = true }) => (
    <div className={`backdrop-blur-xl border shadow-2xl rounded-2xl transition-all duration-300 ${isDarkMode ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-slate-200/60 shadow-xl'} ${className}`}>
        {children}
    </div>
);

const ToastContainer = ({ toasts, removeToast }) => (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
            <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border border-white/10 text-sm font-bold text-white transform transition-all duration-300 animate-in slide-in-from-right-10 ${toast.type === 'error' ? 'bg-red-500/90' : toast.type === 'warning' ? 'bg-orange-500/90' : toast.type === 'success' ? 'bg-emerald-500/90' : 'bg-slate-800/90'}`}>
                {toast.type === 'error' ? <AlertOctagon className="w-5 h-5" /> : toast.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                {toast.message}
                <button onClick={() => removeToast(toast.id)} className="ml-2 hover:opacity-75"><X className="w-4 h-4" /></button>
            </div>
        ))}
    </div>
);

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, type = 'danger', isDarkMode }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <GlassCard className="w-full max-w-sm p-6" isDarkMode={isDarkMode}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${type === 'danger' ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'}`}>
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className={`flex-1 py-2.5 rounded-lg font-bold transition ${isDarkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}>Cancel</button>
                    <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-lg font-bold text-white transition shadow-lg ${type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}>Confirm</button>
                </div>
            </GlassCard>
        </div>
    );
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { 
      console.error("Scheduler Crashed:", error, errorInfo); 
      localStorage.clear();
  }
  handleReset = () => { localStorage.clear(); window.location.reload(); };
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans overflow-hidden">
          <div className="bg-slate-900/50 backdrop-blur-lg p-8 rounded-2xl border border-white/10 max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-8 h-8 text-red-500" /></div>
            <h1 className="text-2xl font-bold mb-2">Critical Error</h1>
            <p className="text-slate-400 mb-6 text-sm">The application state has become corrupted.</p>
            <button onClick={this.handleReset} className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 rounded-xl font-bold transition text-white">Reset Application</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- SUB-COMPONENT: AGENT CARD ---
const AgentCard = memo(({ agent, index, shifts, updateAgent, updateAgentPreferredDays, onDeleteClick, setPtoModalAgentIndex, isDarkMode }) => {
  const safeShifts = Array.isArray(shifts) ? shifts : [];
  const currentShiftId = agent.shiftId || 'am';
  const pref1 = agent.preferredDaysOff1 || ['Saturday', 'Sunday'];
  const pref2 = agent.preferredDaysOff2 || ['Friday', 'Saturday'];

  const cardBg = isDarkMode ? 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10' : 'bg-white/50 hover:bg-white/80 border-slate-200';
  const labelColor = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDarkMode ? 'bg-slate-950/50 border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400';
  const btnBg = isDarkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200';

  return (
    <div className={`${cardBg} border hover:border-orange-500/50 p-4 rounded-xl transition-all duration-300 group relative backdrop-blur-md shadow-sm`}>
      {agent.missedOffDayStreak >= 2 && <div className="absolute top-0 right-0 bg-orange-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl shadow-lg flex items-center gap-1 animate-pulse"><ShieldAlert className="w-3 h-3" /> PRIORITY</div>}
      <div className="flex gap-3 mb-4 items-end">
        <div className="flex-1">
            <label className={`text-[10px] uppercase font-bold mb-1.5 block tracking-wider ${labelColor}`}>Agent Name</label>
            <div className="relative">
                <input value={agent.name} onChange={(e) => updateAgent(index, 'name', e.target.value)} className={`w-full px-3 py-2 text-sm font-medium focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition rounded-lg placeholder-slate-600 border ${agent.errors?.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : inputBg}`} placeholder={`Agent ${index + 1}`} />
                {agent.errors?.name && <div className="absolute top-full left-0 mt-1 text-[10px] text-red-500 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {agent.errors.name}</div>}
            </div>
        </div>
        <div className="w-32"><label className="text-[10px] text-orange-500 uppercase font-bold mb-1.5 block tracking-wider">Shift</label>
            <div className="relative">
                <select value={currentShiftId} onChange={(e) => updateAgent(index, 'shiftId', e.target.value)} className={`w-full px-3 py-2 text-sm font-medium focus:border-orange-500 outline-none transition appearance-none cursor-pointer rounded-lg border ${inputBg}`}>
                    {safeShifts.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    <option value="any">No Preference (Flex)</option>
                </select>
                <div className="absolute right-2 top-2.5 pointer-events-none text-slate-500"><ChevronRight className="w-4 h-4 rotate-90" /></div>
            </div>
        </div>
        <div className="flex gap-1"><button onClick={() => setPtoModalAgentIndex(index)} className={`h-[38px] px-3 rounded-lg text-xs font-bold flex items-center justify-center transition border border-transparent ${btnBg}`} title="Manage PTO"><Plane className="w-4 h-4" /> {agent.pto?.length > 0 && <span className="ml-1">{agent.pto.length}</span>}</button><button onClick={() => onDeleteClick(index)} className={`h-[38px] px-3 border border-transparent hover:text-white hover:bg-red-500/80 rounded-lg transition ${btnBg}`}><Trash2 className="w-4 h-4" /></button></div>
      </div>
      <div className={`grid grid-cols-2 gap-3 p-3 rounded-lg border mt-2 ${isDarkMode ? 'bg-slate-950/30 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
        <div><label className="text-[9px] text-emerald-500 font-bold mb-1.5 flex items-center gap-1 uppercase"><CheckCircle className="w-3 h-3" /> Target Off</label><div className="flex gap-1"><select value={pref1[0]} onChange={(e) => updateAgentPreferredDays(index, 1, 0, e.target.value)} className={`w-full rounded px-1 py-1.5 text-xs focus:border-orange-500 outline-none transition border ${inputBg}`}>{ALL_DAYS.map(d => <option key={d} value={d}>{d.substring(0,3)}</option>)}</select><select value={pref1[1]} onChange={(e) => updateAgentPreferredDays(index, 1, 1, e.target.value)} className={`w-full rounded px-1 py-1.5 text-xs focus:border-orange-500 outline-none transition border ${inputBg}`}>{ALL_DAYS.map(d => <option key={d} value={d}>{d.substring(0,3)}</option>)}</select></div></div>
        <div><label className="text-[9px] text-blue-500 font-bold mb-1.5 flex items-center gap-1 uppercase"><Info className="w-3 h-3" /> Backup</label><div className="flex gap-1"><select value={pref2[0]} onChange={(e) => updateAgentPreferredDays(index, 2, 0, e.target.value)} className={`w-full rounded px-1 py-1.5 text-xs focus:border-blue-500 outline-none transition border ${inputBg}`}>{ALL_DAYS.map(d => <option key={d} value={d}>{d.substring(0,3)}</option>)}</select><select value={pref2[1]} onChange={(e) => updateAgentPreferredDays(index, 2, 1, e.target.value)} className={`w-full rounded px-1 py-1.5 text-xs focus:border-blue-500 outline-none transition border ${inputBg}`}>{ALL_DAYS.map(d => <option key={d} value={d}>{d.substring(0,3)}</option>)}</select></div></div>
      </div>
    </div>
  );
});

// --- SUB-COMPONENT: SCHEDULE CELL ---
const ScheduleCell = memo(({ agentName, assignment, date, dayIndex, onClick, config, isDarkMode, isLocked }) => {
    let style = isDarkMode ? "bg-slate-800 text-slate-500 border-slate-700" : "bg-slate-100 text-slate-400 border-slate-200"; 
    let text = "OFF"; let icon = null; let subText = null;

    if (assignment?.status === 'WORKING' && assignment.shiftId) {
        const shift = config.shifts.find(s => s.id === assignment.shiftId);
        if (shift) {
            const color = shift.color || 'blue';
            style = `bg-${color}-500/10 text-${color}-500 border-l-4 border-${color}-500`;
            text = assignment.task;
            icon = '⚡';
            subText = `${shift.start}-${shift.end}`;
        }
    } else if (assignment?.status === 'PTO') { text = "PTO"; style = isDarkMode ? "bg-slate-800/50 text-slate-600 font-bold opacity-50" : "bg-slate-200/50 text-slate-400 font-bold opacity-50"; icon = "🌴"; }
    else if (assignment?.status === 'OFF' && assignment.isForcedRest) { text = "REST"; style = "bg-red-950/20 text-red-500/50"; icon = "🛑"; }

    return (
        <td className={`p-1 border-l ${isDarkMode ? 'border-white/5' : 'border-slate-100'} ${isLocked ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => !isLocked && onClick(dayIndex, agentName, assignment, date)}>
            <div className={`px-2 py-3 text-[10px] flex flex-col items-center justify-center gap-1 font-bold transition-all hover:scale-[1.02] cursor-pointer shadow-sm rounded ${style}`}>
                <div className="flex items-center gap-1 uppercase tracking-wide"><span>{icon}</span><span>{text}</span></div>
                {subText && <div className="text-[8px] opacity-60 font-mono tracking-tighter">{subText}</div>}
            </div>
        </td>
    );
});

// --- SUB-COMPONENT: SCHEDULE TABLE ---
const ScheduleTable = memo(({ schedule, visibleAgents, config, isDarkMode, zoomLevel, setZoomLevel, onCellClick, onDayClick }) => {
    if (!schedule) return null;

    const getSafeStats = (day, shiftId) => {
        try {
            const dayName = new Date(day.fullDate).toLocaleDateString('en-US', { weekday: 'long' });
            return config.rules?.[dayName]?.[shiftId]?.minStaff || 0;
        } catch(e) { return 0; }
    };

    return (
        <GlassCard className="p-0 overflow-hidden border-t-4 border-t-orange-500" isDarkMode={isDarkMode}>
            <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className={`text-xl font-bold flex items-center gap-3 uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}><TrendingUp className="w-6 h-6 text-orange-500" /> Master Schedule</h3>
                <div className="flex items-center gap-6">
                    <div className={`flex items-center gap-2 border-r pr-6 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))} className={`p-1 hover:text-orange-500 transition ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}><ZoomOut className="w-4 h-4" /></button>
                        <span className={`text-[10px] font-mono w-8 text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{Math.round(zoomLevel * 100)}%</span>
                        <button onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))} className={`p-1 hover:text-orange-500 transition ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}><ZoomIn className="w-4 h-4" /></button>
                    </div>
                    {config.shifts?.map(s => (
                        <div key={s.id} className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><div className={`w-2 h-2 rounded-full bg-${s.color}-500 shadow-[0_0_8px_currentColor]`}></div> {s.name}</div>
                    ))}
                </div>
            </div>
            <div className="relative overflow-auto custom-scrollbar max-h-[75vh]" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left', width: `${100 / zoomLevel}%` }}>
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className={`sticky top-0 z-20 border-b ${isDarkMode ? 'bg-slate-950/80 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                            <th className={`p-5 min-w-[120px] sticky left-0 z-30 font-black uppercase tracking-[0.1em] text-[10px] ${isDarkMode ? 'bg-slate-950 text-slate-500' : 'bg-white text-slate-400'}`}>Date</th>
                            {visibleAgents.map((agent, i) => (<th key={i} className={`p-5 min-w-[140px] text-[10px] font-black uppercase tracking-[0.1em] border-l ${isDarkMode ? 'text-slate-300 border-white/5' : 'text-slate-700 border-slate-200'}`}>{agent.name}</th>))}
                            <th className={`p-5 min-w-[120px] font-black uppercase tracking-[0.1em] text-[10px] border-l text-center ${isDarkMode ? 'text-slate-500 border-white/5' : 'text-slate-400 border-slate-200'}`}>Coverage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {schedule.map((day, idx) => (
                            <tr key={idx} className={`border-b transition group ${isDarkMode ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-100 hover:bg-slate-50'}`}>
                                <td className={`p-4 sticky left-0 border-r z-10 transition-colors cursor-pointer ${isDarkMode ? 'bg-slate-900 group-hover:bg-[#0f172a] border-white/5' : 'bg-white group-hover:bg-slate-50 border-slate-200'} ${!day.isCurrentMonth ? 'opacity-50 bg-slate-100/5' : ''}`} onClick={() => onDayClick(day)}>
                                    <div className="text-[12px] uppercase font-black text-orange-500 mb-0.5">{day.monthName} {day.dayNum}</div>
                                    <div className="text-[10px] text-slate-500 font-bold tracking-widest">{day.day.substring(0,3)}</div>
                                </td>
                                {visibleAgents.map((agent, i) => (
                                    <ScheduleCell 
                                        key={i} 
                                        dayIndex={idx}
                                        agentName={agent.name}
                                        assignment={day.assignments[agent.name]}
                                        date={day.date}
                                        onClick={onCellClick}
                                        config={config}
                                        isDarkMode={isDarkMode}
                                        isLocked={day.isLocked}
                                    />
                                ))}
                                <td className={`p-4 cursor-pointer border-l ${isDarkMode ? 'border-white/5 bg-slate-900/30' : 'border-slate-200 bg-white'}`} onClick={() => onDayClick(day)}>
                                   <div className="flex flex-col gap-2">
                                     {config.shifts?.map(shift => {
                                         const count = day.shiftCoverage[shift.id] || 0;
                                         const req = getSafeStats(day, shift.id);
                                         const percent = req > 0 ? Math.min((count / req) * 100, 100) : 0;
                                         const isLow = count < req;
                                         return (
                                             <div key={shift.id} className="w-full">
                                                 <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider mb-1">
                                                     <span className="text-slate-500">{shift.name}</span>
                                                     <span className={`${isLow ? "text-red-500" : "text-emerald-500"}`}>{count}/{req}</span>
                                                 </div>
                                                 <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                     <div className={`h-full ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${percent}%`}}></div>
                                                 </div>
                                             </div>
                                         )
                                     })}
                                   </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
});

const WorkforceSchedulerContent = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  // --- STATE ---
  const [config, setConfig] = useState(() => {
      try {
          const saved = localStorage.getItem(CONFIG_KEY);
          return saved ? repairConfig(JSON.parse(saved)) : DEFAULT_CONFIG;
      } catch (e) { return DEFAULT_CONFIG; }
  });

  const [agents, setAgents] = useState(() => {
      try {
          const saved = localStorage.getItem(AGENTS_KEY);
          return saved ? repairAgents(JSON.parse(saved)) : DEFAULT_AGENTS;
      } catch (e) { return DEFAULT_AGENTS; }
  });

  const [schedule, setSchedule] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [progress, setProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [transitionData, setTransitionData] = useState(null);
  const [midMonthTransition, setMidMonthTransition] = useState(false); // New flag for mid-month trigger

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [warnings, setWarnings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activePanel, setActivePanel] = useState(null);
  const [selectedRuleDay, setSelectedRuleDay] = useState('Monday'); 
  const [dayStats, setDayStats] = useState(null); 
  const [processing, setProcessing] = useState(false);
  const [editingCell, setEditingCell] = useState(null); 
  const [ptoModalAgentIndex, setPtoModalAgentIndex] = useState(null); 
  const [ptoRangeStart, setPtoRangeStart] = useState('');
  const [ptoRangeEnd, setPtoRangeEnd] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [teamZoom, setTeamZoom] = useState(1);
  const [transZoom, setTransZoom] = useState(1);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // --- AUTO-SAVE ---
  useEffect(() => {
    setSaveStatus('unsaved');
    const handler = setTimeout(() => {
        setSaveStatus('saving');
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
        localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
        setTimeout(() => setSaveStatus('saved'), 500);
    }, 1000);
    return () => clearTimeout(handler);
  }, [agents, config]);

  // Load specific month schedule
  useEffect(() => {
      const key = `${SCHEDULE_PREFIX}${selectedYear}_${selectedMonth}`;
      const saved = localStorage.getItem(key);
      if(saved) {
          const data = JSON.parse(saved);
          setSchedule(data.schedule);
          setSummary(data.summary);
          setWarnings(data.warnings);
      } else {
          setSchedule(null);
          setSummary(null);
          setWarnings([]);
      }
  }, [selectedMonth, selectedYear]);

  // --- ACTIONS ---
  const addToast = (message, type = 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  const openConfirm = (title, message, onConfirm, type='danger') => { setConfirmDialog({ title, message, onConfirm, type, isOpen: true }); };
  const closeConfirm = () => { setConfirmDialog(null); };

  const updateAgent = useCallback((index, field, value) => {
    setAgents(prev => {
        const updated = [...prev];
        const newErrors = { ...updated[index].errors };
        if (field === 'name') {
            const isDuplicate = prev.some((a, i) => i !== index && a.name.toLowerCase() === value.toLowerCase());
            if (isDuplicate) newErrors.name = "Duplicate Name";
            else delete newErrors.name;
        }
        updated[index] = { ...updated[index], [field]: value, errors: newErrors };
        return updated;
    });
  }, []);

  const updateAgentPreferredDays = useCallback((index, prefNumber, dayIndex, newDay) => {
    setAgents(prev => {
        const updated = [...prev];
        const field = `preferredDaysOff${prefNumber}`;
        const currentDays = [...updated[index][field]];
        currentDays[dayIndex] = newDay;
        updated[index] = { ...updated[index], [field]: currentDays };
        return updated;
    });
  }, []);

  const handleRemoveAgent = (index) => {
      openConfirm("Delete Agent?", `Remove ${agents[index].name}?`, () => {
          setAgents(prev => prev.filter((_, i) => i !== index));
          addToast("Agent removed", "success");
          closeConfirm();
      }, 'danger', isDarkMode);
  };

  const addShift = () => {
      const newId = `shift_${Date.now()}`;
      const newShift = { id: newId, name: 'New Shift', start: '09:00', end: '17:00', color: 'emerald' };
      const updatedRules = { ...config.rules };
      ALL_DAYS.forEach(day => { if(!updatedRules[day]) updatedRules[day] = {}; updatedRules[day][newId] = { minStaff: 3, calls: 1, chats: 0, tickets: 0 }; });
      setConfig(prev => ({ ...prev, shifts: [...prev.shifts, newShift], rules: updatedRules }));
      addToast("New shift added", "success");
  };

  const handleRemoveShift = (id) => {
      if (config.shifts.length <= 1) return addToast("Must have at least one shift", "error");
      openConfirm("Delete Shift?", "Agents will be reassigned.", () => {
         const updatedShifts = config.shifts.filter(s => s.id !== id);
         const fallbackShiftId = updatedShifts[0].id;
         const updatedRules = { ...config.rules };
         ALL_DAYS.forEach(day => { if (updatedRules[day]) delete updatedRules[day][id]; });
         setConfig(prev => ({ ...prev, shifts: updatedShifts, rules: updatedRules }));
         setAgents(prev => prev.map(a => a.shiftId === id ? { ...a, shiftId: fallbackShiftId } : a));
         addToast("Shift removed", "success");
         closeConfirm();
      }, 'danger', isDarkMode);
  };

  const updateShift = (id, field, value) => {
      setConfig(prev => {
          const newShifts = prev.shifts.map(s => s.id === id ? { ...s, [field]: value } : s);
          return { ...prev, shifts: newShifts };
      });
  };

  const updateDayRule = (day, shiftId, field, value) => {
      const numValue = parseInt(value) || 0; 
      setConfig(prev => ({ ...prev, rules: { ...prev.rules, [day]: { ...prev.rules[day], [shiftId]: { ...prev.rules[day][shiftId], [field]: numValue } } } }));
  };

  const copyDayRules = (sourceDay, targetDays) => {
      const sourceRules = config.rules[sourceDay];
      const updatedRules = { ...config.rules };
      targetDays.forEach(day => { updatedRules[day] = JSON.parse(JSON.stringify(sourceRules)); });
      setConfig(prev => ({ ...prev, rules: updatedRules }));
      addToast(`Rules copied`, "success");
  };

  const getReqs = (dateObj, config) => {
      try {
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          return config.rules?.[dayName] || {};
      } catch (e) { return {}; }
  };

  // --- PTO ---
  const togglePtoDay = (day, month, year) => {
      if (ptoModalAgentIndex === null) return;
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setAgents(prev => {
          const updated = [...prev];
          const agent = updated[ptoModalAgentIndex];
          if (agent.pto.includes(dateKey)) agent.pto = agent.pto.filter(d => d !== dateKey);
          else agent.pto = [...agent.pto, dateKey].sort();
          return updated;
      });
  };

  const addPtoRange = () => {
      if (!ptoRangeStart || !ptoRangeEnd || ptoModalAgentIndex === null) return;
      const start = new Date(ptoRangeStart);
      const end = new Date(ptoRangeEnd);
      if (end < start) return addToast("Invalid range", "error");
      
      const newDates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
           newDates.push(d.toISOString().split('T')[0]);
      }
      setAgents(prev => {
          const updated = [...prev];
          const agent = updated[ptoModalAgentIndex];
          agent.pto = [...new Set([...agent.pto, ...newDates])].sort();
          return updated;
      });
      addToast("Range added", "success");
  };

  const removePto = (date) => {
      setAgents(prev => {
          const updated = [...prev];
          updated[ptoModalAgentIndex].pto = updated[ptoModalAgentIndex].pto.filter(d => d !== date);
          return updated;
      });
  };

  const addAgent = () => {
      const newName = `Agent ${agents.length + 1}`;
      setAgents(prev => [...prev, { name: newName, shiftId: config.shifts[0].id, preferredDaysOff1: ['Saturday', 'Sunday'], preferredDaysOff2: ['Friday', 'Saturday'], pto: [], errors: {} }]);
      addToast("Agent added", "success");
  };

  const handleExportBackup = () => {
      const blob = new Blob([JSON.stringify({ agents, config }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tradeling_backup.json`;
      link.click();
      addToast("Backup downloaded", "success");
  };

  const handleImportBackup = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const parsed = JSON.parse(e.target.result);
              if (parsed.agents && parsed.config) {
                  setAgents(repairAgents(parsed.agents));
                  setConfig(repairConfig(parsed.config));
                  addToast("Restored", "success");
              }
          } catch { addToast("Invalid file", "error"); }
      };
      reader.readAsText(file);
  };

  const handleExportCSV = () => {
      if (!schedule) return;
      let csv = "Date,Day,Total Staff," + agents.map(a => a.name).join(",") + "\n";
      schedule.forEach(day => {
          if (!day) return;
          let row = `${day.date},${day.day},${day.total}`;
          agents.forEach(agent => {
              const assign = day.assignments[agent.name];
              let val = "OFF";
              if (assign?.status === 'WORKING') val = `${assign.task}`;
              else if (assign?.status === 'PTO') val = "PTO";
              row += `,${val}`;
          });
          csv += row + "\n";
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `schedule_v63_${MONTH_NAMES[selectedMonth]}.csv`;
      link.click();
      addToast("CSV Exported", "success");
  };

  const shuffleArray = (array) => {
      let currentIndex = array.length, randomIndex;
      while (currentIndex !== 0) {
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;
          [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
      }
      return array;
  };

  const assignTasksForShift = (workingAgents, reqs) => {
      let taskPool = [];
      for(let i=0; i<(reqs.calls || 0); i++) taskPool.push('Calls');
      for(let i=0; i<(reqs.chats || 0); i++) taskPool.push('Chats');
      for(let i=0; i<(reqs.tickets || 0); i++) taskPool.push('Tickets');

      while(taskPool.length < workingAgents.length) {
          const rand = Math.random();
          if(rand < 0.6) taskPool.push('Calls'); 
          else if(rand < 0.9) taskPool.push('Chats'); 
          else taskPool.push('Tickets'); 
      }
      taskPool = shuffleArray(taskPool);
      const shuffledAgents = shuffleArray([...workingAgents]);
      const assignments = {};
      shuffledAgents.forEach((agent, i) => { assignments[agent.name] = taskPool[i] || 'Calls'; });
      return assignments;
  };

  const getTransitionDays = (startFromMidMonth = false) => {
      if (!startFromMidMonth) {
          // Standard: Get last 7 days of PREVIOUS month
          const prevMonth = new Date(selectedYear, selectedMonth - 1, 1);
          const lastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
          const days = [];
          for(let i=6; i>=0; i--) {
              const d = new Date(lastDay);
              d.setDate(lastDay.getDate() - i);
              days.push(d);
          }
          return days;
      } else {
          // Mid-Month: Get days 9-15 of CURRENT month
          const days = [];
          for(let i=9; i<=15; i++) {
              days.push(new Date(selectedYear, selectedMonth, i));
          }
          return days;
      }
  };

  const handleGenerateClick = () => {
      if(schedule) {
          openConfirm("Regenerate?", "Overwrite existing schedule?", () => { closeConfirm(); checkHistoryAndGenerate(); }, 'warning', isDarkMode);
      } else {
          checkHistoryAndGenerate();
      }
  };

  const checkHistoryAndGenerate = () => {
      const mode = config.generationScope; // 'full', 'half_1', 'half_2'

      // If generating Phase 2, we need Phase 1 history
      if (mode === 'half_2') {
          // Check if we have valid data for Day 15
          if (schedule && schedule.length >= 15 && schedule[14]?.dateStr) {
              // We have local data, use it (compute state automatically)
              generateSchedule(null, true); // true = use existing schedule for state
              return;
          } else {
              // No local data for Phase 1. Force manual input for Days 9-15.
              setMidMonthTransition(true);
              const days = getTransitionDays(true);
              setTransitionData({
                  days: days.map(d => ({ date: d, str: d.toLocaleDateString('en-US', {weekday:'short', day:'numeric'}) })),
                  values: agents.reduce((acc, a) => ({ ...acc, [a.name]: Array(7).fill(true) }), {}) 
              });
              setTransitionModalOpen(true);
              return;
          }
      }

      // Standard Month Start Logic
      const projectStart = new Date(config.projectStartDate);
      const currentStart = new Date(selectedYear, selectedMonth, 1);
      
      if (currentStart <= projectStart) {
          generateSchedule();
          return;
      }

      const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
      const prevKey = `${SCHEDULE_PREFIX}${prevDate.getFullYear()}_${prevDate.getMonth()}`;
      const savedPrev = localStorage.getItem(prevKey);
      
      if(!savedPrev) {
          setMidMonthTransition(false);
          const days = getTransitionDays(false);
          setTransitionData({ 
              days: days.map(d => ({ date: d, str: d.toLocaleDateString('en-US', {weekday:'short', day:'numeric'}) })),
              values: agents.reduce((acc, a) => ({ ...acc, [a.name]: Array(7).fill(true) }), {}) 
          });
          setTransitionModalOpen(true);
      } else {
          const parsed = JSON.parse(savedPrev);
          generateSchedule(parsed.finalState);
      }
  };

  const handleTransitionSubmit = () => {
      const computedState = {};
      agents.forEach(a => {
          const history = transitionData.values[a.name]; 
          let streak = 0;
          for(let i=6; i>=0; i--) {
              if(history[i]) streak++;
              else break;
          }
          // Calculate weekly load
          let weekly = 0;
          if (midMonthTransition) {
             // For mid-month, count from most recent Monday in the 9-15 range
             let mondayIndex = -1;
             transitionData.days.forEach((d, idx) => { if(d.date.getDay() === 1) mondayIndex = idx; });
             if (mondayIndex !== -1) {
                 for(let i=mondayIndex; i<7; i++) if(history[i]) weekly++;
             } else {
                 weekly = history.filter(Boolean).length; // Fallback
             }
          } else {
             weekly = history.filter(Boolean).length; 
          }
          computedState[a.name] = { consecutive: streak, weekly };
      });
      setTransitionModalOpen(false);
      generateSchedule(computedState);
  };

  const generateSchedule = async (initialState = {}, useExistingSchedule = false) => {
    setProcessing(true);
    setWarnings([]);
    setProgress(10);
    
    setTimeout(() => {
      try {
        const weeks = [];
        const firstDay = new Date(selectedYear, selectedMonth, 1);
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
        let current = new Date(firstDay);
        const startOffset = (current.getDay() + 6) % 7;
        current.setDate(current.getDate() - startOffset);
        const end = new Date(lastDay);
        end.setDate(end.getDate() + ((7 - lastDay.getDay()) % 7));

        while (current <= end) {
            const week = [];
            for(let i=0; i<7; i++) {
                week.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
            weeks.push(week);
        }
        setProgress(30);

        const scheduleData = [];
        const newWarnings = [];
        const agentWeeklyWork = {}; 
        const agentConsecutiveDays = {};
        
        // Initialize State
        if (useExistingSchedule && schedule) {
            // Re-hydrate from existing Day 15 state
            // Logic: Scan 1-15, calc stats, continue
            // Simplification: We will just run the logic from scratch for 1-15 to rebuild state, but KEEP the assignments if locked
        } 
        
        agents.forEach(a => {
            if(initialState && initialState[a.name]) {
                agentConsecutiveDays[a.name] = initialState[a.name].consecutive || 0;
                agentWeeklyWork[a.name] = initialState[a.name].weekly || 0; 
            } else {
                agentConsecutiveDays[a.name] = 0;
                agentWeeklyWork[a.name] = 0;
            }
        });

        weeks.forEach((weekDates, wIdx) => {
             // Reset weekly on Monday
             if (weekDates[0].getDay() === 1) { // Logic fix: weekDates[0] is always Monday in our loop
                 agents.forEach(a => agentWeeklyWork[a.name] = 0);
             }

             const weeklyOffs = {};
             const currentDailyOffs = {}; 
             const dayRequirements = {};  

             // Pre-calc capacity
             weekDates.forEach(date => {
                 const dName = date.toLocaleDateString('en-US', { weekday: 'long' });
                 const reqs = getReqs(date, config);
                 let totalNeeded = 0;
                 Object.values(reqs).forEach(r => totalNeeded += (r.minStaff || 0));
                 dayRequirements[dName] = Math.max(0, agents.length - totalNeeded);
                 currentDailyOffs[dName] = 0;
             });

             // Assign PTO
             agents.forEach(agent => {
                 const ptoDays = weekDates.filter(d => {
                     const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                     return agent.pto.includes(k);
                 }).map(d => d.toLocaleDateString('en-US', { weekday: 'long' }));
                 weeklyOffs[agent.name] = [...ptoDays];
                 ptoDays.forEach(d => currentDailyOffs[d]++);
             });

             // Assign Preferred Offs (Capacity First)
             const shuffledAgents = shuffleArray([...agents]);
             shuffledAgents.forEach(agent => {
                 if(weeklyOffs[agent.name].length >= 2) return; 
                 const pref1 = agent.preferredDaysOff1;
                 const canTake1 = pref1.every(d => (currentDailyOffs[d] || 0) < dayRequirements[d]);
                 
                 if(canTake1) {
                     weeklyOffs[agent.name] = pref1;
                     pref1.forEach(d => currentDailyOffs[d] = (currentDailyOffs[d] || 0) + 1);
                     return;
                 }
                 const pref2 = agent.preferredDaysOff2;
                 const canTake2 = pref2.every(d => (currentDailyOffs[d] || 0) < dayRequirements[d]);
                 if(canTake2) {
                     weeklyOffs[agent.name] = pref2;
                     pref2.forEach(d => currentDailyOffs[d] = (currentDailyOffs[d] || 0) + 1);
                     return;
                 }
                 const bestDays = ALL_DAYS.filter(d => !weeklyOffs[agent.name].includes(d))
                     .sort((a,b) => {
                         const slackA = (dayRequirements[a] || 0) - (currentDailyOffs[a] || 0);
                         const slackB = (dayRequirements[b] || 0) - (currentDailyOffs[b] || 0);
                         return slackB - slackA; 
                     }).slice(0, 2 - weeklyOffs[agent.name].length);

                 weeklyOffs[agent.name] = [...weeklyOffs[agent.name], ...bestDays];
                 bestDays.forEach(d => currentDailyOffs[d] = (currentDailyOffs[d] || 0) + 1);
             });

             // Daily Fill
             weekDates.forEach(date => {
                 const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                 const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
                 const dayNum = date.getDate();
                 const isCurrentMonth = date.getMonth() === selectedMonth;
                 
                 // ** SCOPE LOGIC **
                 let isLocked = false;
                 let skipGeneration = false;

                 if (config.generationScope === 'half_1' && dayNum > 15 && isCurrentMonth) skipGeneration = true;
                 if (config.generationScope === 'half_2' && dayNum <= 15 && isCurrentMonth) isLocked = true;

                 // If Locked (Phase 1 during Phase 2 generation):
                 // We must retrieve the EXISTING assignment to keep state consistent
                 if (isLocked && schedule && schedule[scheduleData.length]) {
                     const existingDay = schedule[scheduleData.length];
                     scheduleData.push({...existingDay, isLocked: true});
                     
                     // Update counters based on existing data
                     Object.keys(existingDay.assignments).forEach(name => {
                         const assign = existingDay.assignments[name];
                         if (assign.status === 'WORKING') {
                             agentWeeklyWork[name]++;
                             agentConsecutiveDays[name]++;
                         } else {
                             agentConsecutiveDays[name] = 0;
                         }
                     });
                     return; // Skip generation logic for this day
                 }

                 if (skipGeneration || (!isCurrentMonth && config.generationRange !== 'full')) return;

                 // ** REGULAR GENERATION LOGIC **
                 const reqs = getReqs(date, config);
                 const dailyAssigns = {};
                 
                 const available = agents.filter(a => !weeklyOffs[a.name].includes(dayName));
                 const eligible = available.filter(a => agentWeeklyWork[a.name] < 5); // 5-Day Cap
                 
                 const fixedAgents = eligible.filter(a => a.shiftId !== 'any');
                 const floaters = eligible.filter(a => a.shiftId === 'any');
                 
                 config.shifts.forEach(shift => {
                     const sReq = reqs[shift.id] || { minStaff: 0 };
                     shift.tempGroup = [];
                     fixedAgents.forEach(a => {
                         if(a.shiftId === shift.id && !dailyAssigns[a.name]) {
                             shift.tempGroup.push(a);
                             dailyAssigns[a.name] = true;
                             agentWeeklyWork[a.name]++;
                             agentConsecutiveDays[a.name]++;
                         }
                     });
                 });

                 floaters.forEach(f => {
                     let targetShift = config.shifts[0];
                     let maxNeed = -999;
                     config.shifts.forEach(s => {
                         const req = reqs[s.id]?.minStaff || 1;
                         const current = s.tempGroup.length;
                         const needScore = (req - current) / req; 
                         if(needScore > maxNeed) { maxNeed = needScore; targetShift = s; }
                     });
                     targetShift.tempGroup.push(f);
                     dailyAssigns[f.name] = true;
                     agentWeeklyWork[f.name]++;
                     agentConsecutiveDays[f.name]++;
                 });

                 const shiftCounts = {};
                 let totalStaff = 0;
                 
                 config.shifts.forEach(shift => {
                     const sReq = reqs[shift.id] || { minStaff: 0 };
                     const tasks = assignTasksForShift(shift.tempGroup, sReq);
                     shift.tempGroup.forEach(a => {
                         dailyAssigns[a.name] = { status: 'WORKING', shiftId: shift.id, task: tasks[a.name] };
                     });
                     if(shift.tempGroup.length < sReq.minStaff) {
                         newWarnings.push(`${dateStr} (${shift.name}): Short Staffed (${shift.tempGroup.length}/${sReq.minStaff})`);
                     }
                     shiftCounts[shift.id] = shift.tempGroup.length;
                     totalStaff += shift.tempGroup.length;
                 });

                 agents.forEach(a => {
                     if(!dailyAssigns[a.name]) {
                         const isPTO = weeklyOffs[a.name].includes(dayName) && a.pto.find(p => p.endsWith(String(date.getDate()).padStart(2,'0'))); 
                         dailyAssigns[a.name] = { status: isPTO ? 'PTO' : 'OFF' };
                         agentConsecutiveDays[a.name] = 0;
                     }
                 });

                 const hasShortage = config.shifts.some(s => {
                     const req = getReqs(date, config)[s.id]?.minStaff || 0;
                     return (shiftCounts[s.id] || 0) < req;
                 });

                 scheduleData.push({
                     date: dateStr,
                     day: dayName,
                     fullDate: date.toDateString(),
                     dateStr: dateStr, 
                     assignments: dailyAssigns,
                     total: totalStaff,
                     shiftCoverage: shiftCounts,
                     isCurrentMonth,
                     monthName: date.toLocaleDateString('en-US', { month: 'short' }),
                     dayNum: String(date.getDate()).padStart(2, '0'),
                     hasShortage,
                     isLocked // For rendering
                 });
             });
             setProgress(30 + Math.round((wIdx / weeks.length) * 60));
        });

        // Save State
        const finalState = {};
        agents.forEach(a => {
            finalState[a.name] = {
                consecutive: agentConsecutiveDays[a.name],
                weekly: agentWeeklyWork[a.name]
            };
        });

        const totalDaysInMonth = scheduleData.filter(d => d.isCurrentMonth).length;
        const criticalDaysCount = scheduleData.filter(d => d.isCurrentMonth && d.hasShortage).length;
        const optimalDaysCount = totalDaysInMonth - criticalDaysCount;
        const healthScore = totalDaysInMonth > 0 ? Math.round((optimalDaysCount / totalDaysInMonth) * 100) : 0;

        const summaryData = {
            healthScore,
            totalDays: totalDaysInMonth * config.shifts.length,
            optimalDays: optimalDaysCount,
            criticalDays: criticalDaysCount
        };

        const key = `${SCHEDULE_PREFIX}${selectedYear}_${selectedMonth}`;
        localStorage.setItem(key, JSON.stringify({ schedule: scheduleData, summary: summaryData, warnings: newWarnings, finalState }));
        
        setSchedule(scheduleData);
        setWarnings(newWarnings);
        setSummary(summaryData);
        setProgress(100);
        addToast("Schedule generated!", "success");
      } catch (error) { console.error(error); addToast("Generation failed", "error"); } 
      finally { setProcessing(false); }
    }, 500);
  };

  const loadSampleData = () => {
      openConfirm("Reset Data?", "This will delete all current agents and settings and reload default data.", () => {
          setAgents(DEFAULT_AGENTS);
          setConfig(DEFAULT_CONFIG);
          setWarnings([]);
          setSchedule(null);
          setSummary(null);
          closeConfirm();
          addToast("Reset complete", "success");
      }, 'danger', isDarkMode);
  };

  const handleHardReset = () => {
      openConfirm("Factory Reset?", "This will wipe ALL data, including saved schedules and agents. Irreversible.", () => {
          localStorage.clear();
          window.location.reload();
      }, 'danger', isDarkMode);
  };

  const handleCellClick = (dayIndex, agentName, currentAssignment, date) => {
    const agent = agents.find(a => a.name === agentName);
    setEditingCell({
        dayIndex,
        agentName,
        dateStr: date,
        ...currentAssignment,
        status: currentAssignment?.status || 'OFF',
        task: currentAssignment?.task || 'Calls',
        shiftId: currentAssignment?.shiftId || agent?.shiftId || config.shifts[0].id
    });
  };

  const handleDayStatsClick = (dayData) => { 
      if(dayData && dayData.fullDate) {
          setDayStats(dayData); 
      }
  };

  const saveManualOverride = () => {
    if (!editingCell || !schedule) return;
    const newSchedule = [...schedule];
    const dayData = newSchedule[editingCell.dayIndex];
    dayData.assignments[editingCell.agentName] = {
        status: editingCell.status,
        task: editingCell.status === 'WORKING' ? editingCell.task : null,
        shiftId: editingCell.status === 'WORKING' ? editingCell.shiftId : null,
        preferenceUsed: 0,
        isManual: true 
    };
     
    const newCoverage = {};
    let total = 0;
    config.shifts.forEach(s => newCoverage[s.id] = 0);
    Object.values(dayData.assignments).forEach(assign => {
        if (assign.status === 'WORKING' && assign.shiftId) {
            newCoverage[assign.shiftId] = (newCoverage[assign.shiftId] || 0) + 1;
            total++;
        }
    });
    dayData.shiftCoverage = newCoverage;
    dayData.total = total;
    
    const key = `${SCHEDULE_PREFIX}${selectedYear}_${selectedMonth}`;
    const currentData = JSON.parse(localStorage.getItem(key)) || {};
    currentData.schedule = newSchedule;
    localStorage.setItem(key, JSON.stringify(currentData));

    setSchedule(newSchedule);
    setEditingCell(null);
    addToast("Assignment updated", "success");
  };

  const visibleAgents = useMemo(() => {
      return agents
        .filter(a => a.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
        .filter(a => shiftFilter === 'all' || a.shiftId === shiftFilter || (shiftFilter === 'any' && a.shiftId === 'any'));
  }, [agents, debouncedSearchTerm, shiftFilter]);

  const getCalendarDays = () => {
      const days = [];
      const firstDay = new Date(selectedYear, selectedMonth, 1);
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const startOffset = (firstDay.getDay() + 6) % 7; 
      for(let i=0; i<startOffset; i++) days.push(null); 
      for(let i=1; i<=daysInMonth; i++) days.push(i);
      return days;
  };

  return (
    <div className={`min-h-screen w-screen font-sans relative pb-20 overflow-x-hidden transition-colors duration-300 selection:bg-orange-500 selection:text-white ${isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-900'}`} style={isDarkMode ? {
        backgroundImage: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%)',
        backgroundAttachment: 'fixed'
    } : {}}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmModal 
        isOpen={confirmDialog?.isOpen} 
        title={confirmDialog?.title} 
        message={confirmDialog?.message} 
        onConfirm={confirmDialog?.onConfirm} 
        onCancel={closeConfirm}
        type={confirmDialog?.type}
        isDarkMode={isDarkMode}
      />

      {/* BACKGROUND & MAIN CONTENT */}
      {isDarkMode && (
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[100px]"></div>
        </div>
      )}

      <div className="w-full w-full p-6 relative z-10">
        
        {/* HEADER */}
        <div className={`flex flex-col md:flex-row justify-between items-center gap-6 mb-10 pb-6 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Zap className="w-8 h-8 text-white" />
                </div>
                <div>
                    <h1 className={`text-4xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        <span className="text-orange-500">Tradeling</span>.com
                    </h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1">Workforce Management</p>
                </div>
            </div>
            
            <div className="flex gap-4 items-center">
                <button onClick={toggleTheme} className={`p-2 rounded-lg transition ${isDarkMode ? 'bg-white/10 text-yellow-400 hover:bg-white/20' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                <div className={`flex items-center rounded-lg p-1 backdrop-blur-md border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className={`bg-transparent text-sm font-bold px-4 py-2 outline-none cursor-pointer hover:text-orange-500 transition uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                    <div className={`h-4 w-[1px] ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}></div>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className={`bg-transparent text-sm font-bold px-4 py-2 outline-none cursor-pointer hover:text-orange-500 transition ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setActivePanel(activePanel === 'data' ? null : 'data')} className={`px-6 py-2.5 font-bold flex items-center gap-2 transition-all duration-300 rounded-lg shadow-lg border ${activePanel === 'data' ? 'bg-orange-500 text-white border-transparent' : isDarkMode ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border-white/5' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}><Save className="w-4 h-4" /> DATA</button>
                    <button onClick={() => setActivePanel(activePanel === 'config' ? null : 'config')} className={`px-6 py-2.5 font-bold flex items-center gap-2 transition-all duration-300 rounded-lg shadow-lg border ${activePanel === 'config' ? 'bg-blue-600 text-white border-transparent' : isDarkMode ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border-white/5' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}><Settings className="w-4 h-4" /> CONFIG</button>
                    <button onClick={loadSampleData} className={`px-4 py-2.5 rounded-lg font-bold transition border ${isDarkMode ? 'bg-slate-800/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border-white/10' : 'bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 border-slate-200'}`}><RefreshCw className="w-4 h-4" /></button>
                </div>
            </div>
        </div>

        {/* DATA PANEL */}
        {activePanel === 'data' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-in fade-in slide-in-from-top-4 duration-300">
                <GlassCard className="text-center hover:border-orange-500/50 transition group p-8" isDarkMode={isDarkMode}>
                    <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition border border-orange-500/20"><Download className="w-6 h-6 text-orange-500"/></div>
                    <h4 className={`font-bold mb-2 uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Backup</h4>
                    <p className="text-xs text-slate-400 mb-6">Save configuration to local file</p>
                    <button onClick={handleExportBackup} className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:to-orange-700 rounded-xl text-sm text-white font-bold uppercase tracking-wider transition shadow-lg shadow-orange-500/20">Download JSON</button>
                </GlassCard>
                <GlassCard className="text-center hover:border-blue-500/50 transition group p-8" isDarkMode={isDarkMode}>
                    <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition border border-blue-500/20"><Upload className="w-6 h-6 text-blue-500"/></div>
                    <h4 className={`font-bold mb-2 uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Restore</h4>
                    <p className="text-xs text-slate-400 mb-6">Load configuration from file</p>
                    <label className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:to-blue-400 rounded-xl text-sm text-white font-bold uppercase tracking-wider transition cursor-pointer block shadow-lg shadow-blue-500/20">
                        Upload File <input type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
                    </label>
                </GlassCard>
                <GlassCard className="text-center hover:border-emerald-500/50 transition group p-8" isDarkMode={isDarkMode}>
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition border border-emerald-500/20"><FileText className="w-6 h-6 text-emerald-500"/></div>
                    <h4 className={`font-bold mb-2 uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Export</h4>
                    <p className="text-xs text-slate-400 mb-6">Download Schedule as CSV</p>
                    <button onClick={handleExportCSV} disabled={!schedule} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:to-emerald-400 rounded-xl text-sm text-white font-bold uppercase tracking-wider transition disabled:opacity-50 shadow-lg shadow-emerald-500/20">Export CSV</button>
                </GlassCard>
            </div>
        )}

        {/* CONFIG PANEL */}
        {activePanel === 'config' && (
          <GlassCard className="mb-10 p-8 animate-in fade-in slide-in-from-top-4 duration-300" isDarkMode={isDarkMode}>
            {/* Global Settings */}
            <div className={`mb-8 pb-8 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><List className="w-4 h-4 text-orange-500" /> Global Settings</h4>
                 <div className="flex flex-wrap gap-8 items-center">
                     <div className={`flex items-center gap-3 px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-slate-950/50 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                         <Calendar className="w-5 h-5 text-orange-500" />
                         <span className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Project Start</span>
                         <input type="date" value={config.projectStartDate} onChange={(e) => setConfig({...config, projectStartDate: e.target.value})} className={`border px-2 py-1 text-sm focus:border-orange-500 outline-none transition rounded ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                     </div>
                     <div className={`flex items-center gap-3 px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-slate-950/50 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                         <ShieldAlert className="w-5 h-5 text-orange-500" />
                         <span className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Max Streak</span>
                         <input type="number" min="1" max="21" value={config.maxConsecutiveDays} onChange={(e) => setConfig({...config, maxConsecutiveDays: parseInt(e.target.value) || 5})} className={`w-16 border px-2 py-1 text-sm focus:border-orange-500 outline-none transition text-center rounded ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                     </div>
                     <div className={`flex items-center gap-3 px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-slate-950/50 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                         <Lock className="w-5 h-5 text-blue-500" />
                         <span className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Gen Scope</span>
                         <select value={config.generationScope} onChange={(e) => setConfig({...config, generationScope: e.target.value})} className={`border px-2 py-1 text-sm focus:border-blue-500 outline-none transition rounded ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                             <option value="full">Full Month</option>
                             <option value="half_1">1st - 15th Only</option>
                             <option value="half_2">16th - End (Locks 1-15)</option>
                         </select>
                     </div>
                 </div>
            </div>

            {/* Shift Definitions */}
            <div className={`mb-8 pb-8 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> Shift Definitions</h4>
                <div className="space-y-3">
                    {config.shifts?.map((shift) => (
                        <div key={shift.id} className={`grid grid-cols-12 gap-4 items-center p-4 rounded-xl border hover:border-orange-500/50 transition ${isDarkMode ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="col-span-3">
                                <label className="text-[9px] text-slate-500 uppercase font-bold mb-1 block">Name</label>
                                <input value={shift.name} onChange={(e) => updateShift(shift.id, 'name', e.target.value)} className={`w-full bg-transparent border-b text-sm font-bold focus:border-orange-500 outline-none py-1 transition ${isDarkMode ? 'border-slate-700 text-white' : 'border-slate-300 text-slate-900'}`} />
                            </div>
                            <div className="col-span-4">
                                <label className="text-[9px] text-slate-500 uppercase font-bold mb-1 block">Time</label>
                                <div className="flex items-center gap-2">
                                    <input type="time" value={shift.start} onChange={(e) => updateShift(shift.id, 'start', e.target.value)} className={`border px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                                    <span className="text-slate-600">-</span>
                                    <input type="time" value={shift.end} onChange={(e) => updateShift(shift.id, 'end', e.target.value)} className={`border px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                                </div>
                            </div>
                            <div className="col-span-3">
                                <label className="text-[9px] text-slate-500 uppercase font-bold mb-1 block">Color</label>
                                <select value={shift.color} onChange={(e) => updateShift(shift.id, 'color', e.target.value)} className={`w-full border px-2 py-1 text-xs capitalize rounded ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                                    {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 flex justify-end items-end">
                                <button onClick={() => handleRemoveShift(shift.id)} className="text-slate-600 hover:text-red-400 transition p-2"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                    <button onClick={addShift} className={`w-full py-4 border border-dashed text-sm font-bold flex items-center justify-center gap-2 transition uppercase tracking-widest rounded-xl ${isDarkMode ? 'border-slate-700 text-slate-500 hover:text-white hover:bg-white/5' : 'border-slate-300 text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}><Plus className="w-4 h-4" /> Add New Shift</button>
                </div>
            </div>

            {/* Staffing Rules */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Briefcase className="w-4 h-4 text-emerald-400" /> Daily Staffing Rules</h4>
                    <div className={`flex gap-2 p-1 rounded-lg border ${isDarkMode ? 'bg-slate-950/50 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                        {ALL_DAYS.map(day => (
                            <button key={day} onClick={() => setSelectedRuleDay(day)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition rounded-md ${selectedRuleDay === day ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-slate-900'}`}>
                                {day.substring(0,3)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end mb-4">
                    <button onClick={() => copyDayRules(selectedRuleDay, ALL_DAYS.filter(d => d !== selectedRuleDay && !['Saturday','Sunday'].includes(d)))} className={`text-xs flex items-center gap-1.5 transition px-4 py-2 border uppercase font-bold tracking-wide rounded-lg ${isDarkMode ? 'text-slate-400 hover:text-white bg-slate-950/50 border-white/10 hover:bg-white/5' : 'text-slate-500 hover:text-slate-700 bg-white border-slate-200 hover:bg-slate-50'}`}><Copy className="w-3 h-3"/> Copy {selectedRuleDay} to Weekdays</button>
                </div>

                <div className={`p-6 border rounded-2xl ${isDarkMode ? 'bg-slate-950/30 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {config.shifts?.map((shift) => (
                            <div key={shift.id} className={`p-5 rounded-xl border hover:border-orange-500/50 transition group shadow-lg ${isDarkMode ? 'bg-slate-900/80 border-white/5' : 'bg-white border-slate-100'}`}>
                                <div className={`font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wide pb-2 border-b ${isDarkMode ? 'text-white border-white/5' : 'text-slate-900 border-slate-100'}`}>
                                    <div className={`w-2 h-2 rounded-full ${getLegendColor(shift.color)} shadow-[0_0_10px_currentColor]`}></div>
                                    {shift.name}
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Min Staff</label>
                                        <input type="number" value={config.rules?.[selectedRuleDay]?.[shift.id]?.minStaff || 0} onChange={(e) => updateDayRule(selectedRuleDay, shift.id, 'minStaff', e.target.value)} className={`w-16 border px-2 py-1 text-sm text-right focus:border-orange-500 outline-none rounded ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 pt-2">
                                        <div><label className="text-[9px] text-slate-500 block mb-1 uppercase text-center">Calls</label><input type="number" value={config.rules?.[selectedRuleDay]?.[shift.id]?.calls || 0} onChange={(e) => updateDayRule(selectedRuleDay, shift.id, 'calls', e.target.value)} className={`w-full border px-1 py-1 text-xs text-center rounded ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} /></div>
                                        <div><label className="text-[9px] text-slate-500 block mb-1 uppercase text-center">Chats</label><input type="number" value={config.rules?.[selectedRuleDay]?.[shift.id]?.chats || 0} onChange={(e) => updateDayRule(selectedRuleDay, shift.id, 'chats', e.target.value)} className={`w-full border px-1 py-1 text-xs text-center rounded ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} /></div>
                                        <div><label className="text-[9px] text-slate-500 block mb-1 uppercase text-center">Tickets</label><input type="number" value={config.rules?.[selectedRuleDay]?.[shift.id]?.tickets || 0} onChange={(e) => updateDayRule(selectedRuleDay, shift.id, 'tickets', e.target.value)} className={`w-full border px-1 py-1 text-xs text-center rounded ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} /></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                     <button onClick={handleHardReset} className="px-6 py-3 border border-red-500 text-red-500 hover:bg-red-500/10 rounded-xl text-xs font-bold uppercase tracking-widest transition flex items-center gap-2"><RotateCcw className="w-4 h-4"/> Factory Reset</button>
                </div>
            </div>
          </GlassCard>
        )}

        {/* TEAM MANAGEMENT */}
        <GlassCard className="mb-10 p-6" isDarkMode={isDarkMode}>
          <div className={`flex justify-between items-center mb-6 border-b pb-4 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold flex items-center gap-3 text-orange-500 uppercase tracking-wider"><Users className="w-6 h-6" /> Team Management <span className={`text-xs px-2 py-1 rounded border ${isDarkMode ? 'bg-white/10 text-slate-300 border-white/5' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{agents.length} AGENTS</span></h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setTeamZoom(Math.max(0.5, teamZoom - 0.1))} className="p-1 hover:text-orange-500"><ZoomOut className="w-4 h-4" /></button>
                    <span className="text-xs font-mono">{Math.round(teamZoom * 100)}%</span>
                    <button onClick={() => setTeamZoom(Math.min(1.5, teamZoom + 0.1))} className="p-1 hover:text-orange-500"><ZoomIn className="w-4 h-4" /></button>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={addAgent} className={`px-5 py-2.5 text-xs font-bold flex items-center gap-2 transition uppercase tracking-widest border rounded-lg shadow-lg ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}><Plus className="w-4 h-4" /> Add Agent</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar" style={{ transform: `scale(${teamZoom})`, transformOrigin: 'top left', width: `${100 / teamZoom}%` }}>
            {agents.map((agent, index) => (
                <AgentCard key={index} index={index} agent={agent} shifts={config.shifts} updateAgent={updateAgent} updateAgentPreferredDays={updateAgentPreferredDays} onDeleteClick={handleRemoveAgent} setPtoModalAgentIndex={setPtoModalAgentIndex} isDarkMode={isDarkMode} />
            ))}
          </div>
        </GlassCard>

        {/* GENERATE BUTTON */}
        <button 
            onClick={handleGenerateClick} 
            disabled={processing} 
            className="w-full py-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:to-orange-700 rounded-2xl font-black text-xl text-white shadow-xl shadow-orange-900/20 flex justify-center items-center gap-4 transition-all transform hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50 disabled:cursor-not-allowed mb-12 uppercase tracking-[0.2em] border border-white/10 backdrop-blur-sm relative overflow-hidden"
        >
            {processing ? (
                <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="z-10">GENERATING... {progress}%</span>
                    <div className="absolute left-0 top-0 h-full bg-white/20 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </>
            ) : (
                <>
                    <Calendar className="w-6 h-6" /> GENERATE SCHEDULE
                </>
            )}
        </button>

        {/* RESULTS SECTION (DASHBOARD) */}
        {schedule && summary && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 mt-8">
            {/* STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <GlassCard className="flex flex-col items-center justify-center p-6 border-t-4 border-t-orange-500" isDarkMode={isDarkMode}><div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Health Score</div><div className={`text-5xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{summary.healthScore}%</div></GlassCard>
                <GlassCard className="flex flex-col items-center justify-center p-6 border-t-4 border-t-emerald-500" isDarkMode={isDarkMode}><div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Optimal Days</div><div className="text-5xl font-black text-emerald-400">{summary.optimalDays}</div></GlassCard>
                <GlassCard className="flex flex-col items-center justify-center p-6 border-t-4 border-t-red-500" isDarkMode={isDarkMode}><div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Critical Days</div><div className="text-5xl font-black text-red-400">{summary.criticalDays}</div></GlassCard>
                <GlassCard className="flex flex-col items-center justify-center p-6 border-t-4 border-t-blue-500" isDarkMode={isDarkMode}><div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Shifts</div><div className="text-5xl font-black text-blue-400">{summary.totalDays}</div></GlassCard>
            </div>

            {/* WARNINGS */}
            {warnings.length > 0 && (
                <GlassCard className="bg-red-950/20 p-6 border border-red-500/20" isDarkMode={isDarkMode}>
                <h3 className="text-lg font-bold text-red-500 mb-4 flex items-center gap-2 uppercase tracking-wide"><AlertCircle className="w-5 h-5" /> Conflicts Found</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                    {warnings.map((w, i) => (
                        <div key={i} className="text-sm text-red-200 py-2 flex items-start gap-3 border-b border-red-500/10 last:border-0">
                            <span className="text-red-500 font-bold">•</span> {w}
                        </div>
                    ))}
                </div>
                </GlassCard>
            )}
            </div>
        )}

        {/* SCHEDULE TABLE */}
        <ScheduleTable 
            schedule={schedule} 
            visibleAgents={visibleAgents} 
            config={config} 
            isDarkMode={isDarkMode} 
            zoomLevel={zoomLevel} 
            setZoomLevel={setZoomLevel}
            onCellClick={handleCellClick} 
            onDayClick={handleDayStatsClick} 
        />

        {/* DAY STATS MODAL */}
        {dayStats && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <GlassCard className="w-full max-w-lg border-slate-700 shadow-2xl" isDarkMode={isDarkMode}>
                    <div className={`flex justify-between items-center mb-8 p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <div><h3 className={`text-2xl font-black flex items-center gap-3 uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}><PieChart className="w-6 h-6 text-orange-500" /> Daily Breakdown</h3><p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-[0.2em]">{dayStats.date} • {dayStats.day}</p></div>
                        <button onClick={() => setDayStats(null)} className="p-2 hover:opacity-75 rounded-full transition"><X className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} /></button>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className={`p-5 border-l-4 border-orange-500 text-center rounded-r-xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}><div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Total Staff</div><div className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{dayStats.total}</div></div>
                            <div className={`p-5 border-l-4 border-emerald-500 text-center rounded-r-xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}><div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Efficiency</div><div className="text-2xl font-black text-emerald-400">100%</div></div>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Shift Coverage</h4>
                        <div className="space-y-4 mb-8">
                            {config.shifts?.map(shift => {
                                const count = dayStats.shiftCoverage[shift.id] || 0;
                                const req = config.rules?.[dayStats.day]?.[shift.id]?.minStaff || 0;
                                const percent = req > 0 ? Math.min((count / req) * 100, 100) : 0;
                                const isLow = count < req;
                                return (
                                    <div key={shift.id}>
                                        <div className="flex justify-between text-xs mb-2"><span className={`font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{shift.name}</span><span className={count < req ? "text-red-500 font-bold" : "text-emerald-500 font-bold"}>{count} / {req}</span></div>
                                        <div className={`h-2 overflow-hidden rounded-full border ${isDarkMode ? 'bg-slate-950 border-white/5' : 'bg-slate-200 border-slate-300'}`}><div className={`h-full transition-all duration-500 ${count < req ? "bg-red-600" : "bg-emerald-600"}`} style={{width: `${percent}%`}}></div></div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </GlassCard>
            </div>
        )}

        {/* PTO MODAL */}
        {ptoModalAgentIndex !== null && agents[ptoModalAgentIndex] && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             <GlassCard className="w-full max-w-xl border-slate-700 shadow-2xl" isDarkMode={isDarkMode}>
                 <div className={`flex justify-between items-center p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                        <div><h3 className={`text-xl font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Manage PTO</h3><p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">for {agents[ptoModalAgentIndex].name}</p></div>
                        <div className={`px-2 py-1 rounded text-[10px] font-bold ${isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800'}`}>{agents[ptoModalAgentIndex].pto.length} Days Selected</div>
                    </div>
                    <button onClick={() => setPtoModalAgentIndex(null)}><X className={`w-5 h-5 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`} /></button>
                 </div>
                 <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                         <h4 className={`text-xs font-bold uppercase mb-4 tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Select Days (Click to Toggle)</h4>
                         <div className="grid grid-cols-7 gap-1 text-center mb-2">{['M','T','W','T','F','S','S'].map((d,i) => <div key={i} className="text-[10px] font-bold text-slate-500">{d}</div>)}</div>
                         <div className="grid grid-cols-7 gap-1">
                             {getCalendarDays().map((d, i) => {
                                 if(!d) return <div key={i}></div>;
                                 const y = selectedYear;
                                 const m = selectedMonth;
                                 const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                 const isSelected = agents[ptoModalAgentIndex].pto.includes(dateKey);
                                 return <button key={i} onClick={() => togglePtoDay(d, m, y)} className={`h-8 w-8 rounded text-xs font-bold transition flex items-center justify-center ${isSelected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{d}</button>
                             })}
                         </div>
                     </div>
                     <div className={`border-l pl-6 flex flex-col ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                         <h4 className={`text-xs font-bold uppercase mb-4 tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Bulk Add Range</h4>
                         <div className="flex gap-2 mb-2">
                             <input type="date" value={ptoRangeStart} onChange={(e) => setPtoRangeStart(e.target.value)} className={`w-full p-2 rounded text-xs border outline-none focus:border-orange-500 ${isDarkMode ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-slate-300'}`} />
                             <span className="self-center text-slate-500"><ArrowRight className="w-4 h-4"/></span>
                             <input type="date" value={ptoRangeEnd} onChange={(e) => setPtoRangeEnd(e.target.value)} className={`w-full p-2 rounded text-xs border outline-none focus:border-orange-500 ${isDarkMode ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-slate-300'}`} />
                         </div>
                         <button onClick={addPtoRange} className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded mb-6 transition">Add Range</button>
                         <div className="flex justify-between items-center mb-2"><h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Selected Dates</h4><span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Total: {agents[ptoModalAgentIndex].pto.length}</span></div>
                         <div className={`flex-1 overflow-y-auto max-h-[150px] custom-scrollbar border rounded p-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            {agents[ptoModalAgentIndex].pto.length === 0 && <div className="text-center text-xs text-slate-500 py-4">No PTO added yet.</div>}
                            {agents[ptoModalAgentIndex].pto.map(date => (<div key={date} className={`flex justify-between items-center p-2 mb-1 rounded text-xs font-mono font-bold ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600 border border-slate-100'}`}>{date}<button onClick={() => removePto(date)} className="text-slate-500 hover:text-red-500"><X className="w-3 h-3" /></button></div>))}
                         </div>
                     </div>
                 </div>
                 <div className={`p-6 pt-0 flex justify-end`}><button onClick={() => setPtoModalAgentIndex(null)} className={`px-8 py-3 font-bold transition text-xs uppercase tracking-widest border rounded-lg ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}>Done</button></div>
             </GlassCard>
          </div>
        )}

        {/* TRANSITION MODAL */}
        {transitionModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                <GlassCard className="w-full max-w-2xl p-8" isDarkMode={isDarkMode}>
                    <div className="flex items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-500/20 rounded-full text-orange-500"><History className="w-8 h-8"/></div>
                            <div>
                                <h3 className="text-2xl font-bold text-white">Missing History Detected</h3>
                                <p className="text-slate-400">{midMonthTransition ? "Please enter status for DAYS 9-15 to ensure continuity." : "Please confirm schedule for last week to ensure continuity."}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setTransZoom(Math.max(0.5, transZoom - 0.1))} className="p-1 hover:text-orange-500"><ZoomOut className="w-4 h-4" /></button>
                            <span className="text-xs font-mono">{Math.round(transZoom * 100)}%</span>
                            <button onClick={() => setTransZoom(Math.min(1.5, transZoom + 0.1))} className="p-1 hover:text-orange-500"><ZoomIn className="w-4 h-4" /></button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto custom-scrollbar mb-8 border border-white/10 rounded-xl" style={{ transform: `scale(${transZoom})`, transformOrigin: 'top left', width: `${100 / transZoom}%` }}>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white/5 text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="p-4">Agent</th>
                                    {transitionData.days.map((d, i) => <th key={i} className="p-4 text-center min-w-[80px]">{d.str}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {agents.map(agent => (
                                    <tr key={agent.name} className="hover:bg-white/5">
                                        <td className="p-4 font-bold text-white">{agent.name}</td>
                                        {transitionData.days.map((_, i) => (
                                            <td key={i} className="p-2 text-center">
                                                <button 
                                                    onClick={() => {
                                                        const newData = {...transitionData};
                                                        newData.values[agent.name][i] = !newData.values[agent.name][i];
                                                        setTransitionData(newData);
                                                    }}
                                                    className={`w-8 h-8 rounded font-bold transition ${transitionData.values[agent.name][i] ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}
                                                >
                                                    {transitionData.values[agent.name][i] ? 'W' : 'O'}
                                                </button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button onClick={() => setTransitionModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:bg-white/5 transition">Cancel</button>
                        <button onClick={handleTransitionSubmit} className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition transform hover:scale-105">Confirm & Generate</button>
                    </div>
                </GlassCard>
            </div>
        )}

        {editingCell && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <GlassCard className="w-full max-w-md border-slate-700 shadow-2xl" isDarkMode={isDarkMode}>
               <div className={`flex justify-between items-center p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}><h3 className={`text-xl font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Edit Assignment</h3><button onClick={() => setEditingCell(null)}><X className={`w-5 h-5 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`} /></button></div>
               <div className="p-6 space-y-6">
                  <div className={`flex justify-between text-sm p-4 border-l-4 border-orange-500 rounded-r-lg shadow-inner ${isDarkMode ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-600'}`}><span className="font-mono">{editingCell.dateStr}</span><span className={`font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{editingCell.agentName}</span></div>
                  <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Status</label>
                      <select value={editingCell.status} onChange={(e) => setEditingCell({...editingCell, status: e.target.value})} className={`w-full border p-3 outline-none focus:border-orange-500 transition text-sm font-medium rounded-lg ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                          <option value="WORKING">Working</option>
                          <option value="OFF">OFF</option>
                          <option value="PTO">PTO / Sick</option>
                      </select>
                  </div>
                  {editingCell.status === 'WORKING' && (
                      <>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Shift</label>
                            <select value={editingCell.shiftId} onChange={(e) => setEditingCell({...editingCell, shiftId: e.target.value})} className={`w-full border p-3 outline-none focus:border-orange-500 transition text-sm font-medium rounded-lg ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                                {config.shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Task</label>
                            <select value={editingCell.task} onChange={(e) => setEditingCell({...editingCell, task: e.target.value})} className={`w-full border p-3 outline-none focus:border-orange-500 transition text-sm font-medium rounded-lg ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                      </>
                  )}
                  <div className="flex gap-4 pt-4">
                      <button onClick={() => setEditingCell(null)} className={`flex-1 py-3 font-bold transition uppercase tracking-wider rounded-lg ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>Cancel</button>
                      <button onClick={saveManualOverride} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition uppercase tracking-wider rounded-lg shadow-lg shadow-orange-500/20">Save Changes</button>
                  </div>
               </div>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
};

// --- WRAPPER EXPORT ---
const WorkforceScheduler = () => (
  <ErrorBoundary>
    <WorkforceSchedulerContent />
  </ErrorBoundary>
);

export default WorkforceScheduler;