import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  History, 
  ChevronRight,
  Target,
  ArrowLeft,
  ShieldAlert
} from 'lucide-react';
import { Project, User, HistoryEntry, ProjectStatus } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import OwnerUpdateForm from './OwnerUpdateForm';
import ReviewForm from './ReviewForm';
import FinalDecisionForm from './FinalDecisionForm';

interface ProjectDetailProps {
  project: Project;
  user: User;
  onClose: () => void;
}

const STEPS = [
  { id: 1, label: 'Assigned', status: ['Assigned'] },
  { id: 2, label: 'Confirmed', status: ['Confirmed'] },
  { id: 3, label: 'In Progress', status: ['In Progress'] },
  { id: 4, label: 'Submitted', status: ['Submitted'] },
  { id: 5, label: 'Under Review', status: ['For Review'] },
  { id: 6, label: 'Approved/Returned', status: ['Approved', 'Returned'] },
  { id: 7, label: 'Closed', status: ['Closed', 'Accomplished'] }
];

export default function ProjectDetail({ project, user, onClose }: ProjectDetailProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showOverrideForm, setShowOverrideForm] = useState<'owner' | 'reviewer' | null>(null);
  const [showFinalDecisionForm, setShowFinalDecisionForm] = useState(false);

  useEffect(() => {
    if (!project.id) return;
    const q = query(
      collection(db, 'history'), 
      where('projectId', '==', project.id),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryEntry[];
      setHistory(historyData);
    }, (error) => {
      console.error("Error fetching history:", error);
    });

    return () => unsubscribe();
  }, [project.id]);

  const getCurrentStep = (status: ProjectStatus) => {
    const step = STEPS.find(s => s.status.includes(status));
    return step ? step.id : 1;
  };

  const currentStepId = getCurrentStep(project.Project_Status);

  const getDaysRemaining = (targetDate: string) => {
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const getDaysLeftInfo = (days: number | null) => {
    if (days === null) return { text: 'No date', color: 'bg-stone-100 text-stone-400' };
    if (days < 0) return { text: `${Math.abs(days)} days OVERDUE`, color: 'bg-red-600 text-white' };
    if (days <= 3) return { text: `URGENT — ${days} days left`, color: 'bg-orange-500 text-white' };
    if (days <= 7) return { text: `${days} days left`, color: 'bg-amber-400 text-stone-900' };
    return { text: `${days} days left`, color: 'bg-stone-100 text-stone-500' };
  };

  const renderField = (label: string, value: any, icon?: any) => {
    if (value === undefined || value === null || value === '') return null;
    const Icon = icon;
    return (
      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className="w-3 h-3 text-stone-400" />}
          <span className="text-[10px] uppercase text-stone-400 font-bold tracking-wider">{label}</span>
        </div>
        <p className="text-sm font-medium text-stone-800">{String(value)}</p>
      </div>
    );
  };

  const ZoneSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="mb-8">
      <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <div className="w-1 h-4 bg-stone-300 rounded-full" />
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      className="fixed inset-0 bg-stone-100 z-[100] overflow-y-auto pb-24"
    >
      {/* Header */}
      <div className={`sticky top-0 bg-white border-b border-stone-200 p-4 flex items-center justify-between z-10 border-l-4 ${
        project.Health_Status === 'Green' ? 'border-l-emerald-500' :
        project.Health_Status === 'Yellow' ? 'border-l-amber-400' :
        'border-l-red-500'
      }`}>
        <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6 text-stone-600" />
        </button>
        <div className="flex flex-col items-center overflow-hidden px-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-stone-900 truncate max-w-[150px]">{project.Project_Name}</h2>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter shrink-0 ${
              project.Priority_Level === 'A' ? 'bg-red-600 text-white' :
              project.Priority_Level === 'B' ? 'bg-orange-500 text-white' :
              'bg-stone-200 text-stone-600'
            }`}>
              PRIORITY {project.Priority_Level}
            </span>
          </div>
          {project.Health_Status_Reason && (
            <p className="text-[10px] italic text-stone-500 truncate max-w-full">
              {project.Health_Status} — {project.Health_Status_Reason}
            </p>
          )}
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="max-w-3xl mx-auto p-4 lg:p-8">
        {/* Trigger Alert Chip for Detail View */}
        {project.Trigger_Hit && project.Trigger_Hit !== 'None' && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-3xl flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Trigger Alert</h4>
              <p className="text-sm font-bold text-red-900">{project.Trigger_Hit}</p>
            </div>
          </div>
        )}

        {/* Why This Reached You Section for Founder */}
        {user.role === 'founder' && project.Project_Status === 'Escalated' && (
          <div className="mb-8 p-8 bg-stone-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="relative z-10">
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Why This Reached You
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.2em] mb-1">Escalated By</p>
                    <p className="text-xl font-bold">{project.Verified_By || 'System Trigger'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.2em] mb-1">Escalation Reason</p>
                    <p className="text-stone-300 leading-relaxed">{project.Escalation_Reason || 'The system has flagged this project for immediate MD intervention due to threshold violations.'}</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.2em] mb-1">Trigger Hit</p>
                    <p className="text-xl font-bold text-red-400">{project.Trigger_Hit || 'Manual Escalation'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.2em] mb-1">Consequence Level</p>
                    <p className="text-3xl font-black text-amber-400">LEVEL {project.Trigger_Consequence_Level || '4'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7-Step Progress Bar */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm mb-8 overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-between min-w-[600px] relative">
            {/* Connector Line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-stone-100 -z-0" />
            
            {STEPS.map((step) => {
              const isCompleted = step.id < currentStepId;
              const isCurrent = step.id === currentStepId;
              const isFuture = step.id > currentStepId;

              return (
                <div key={step.id} className="flex flex-col items-center gap-2 relative z-10 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isCompleted ? 'bg-emerald-500 text-white' :
                    isCurrent ? 'bg-stone-900 text-white scale-110 shadow-lg' :
                    'bg-stone-100 text-stone-400'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-bold">{step.id}</span>}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-tighter text-center max-w-[80px] ${
                    isCurrent ? 'text-stone-900' : 'text-stone-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Owner Success Definition */}
        {user.role === 'owner' && (
          <div className="bg-emerald-900 text-white p-6 rounded-3xl shadow-xl mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Target className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-[10px] uppercase font-black tracking-widest text-emerald-400 mb-1">
                  Ano ang tagumpay? (What does success look like?)
                </h4>
                <p className="text-lg font-bold leading-tight">
                  {project.Success_Definition}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Zone A: Core Details */}
        <ZoneSection title="Zone A: Core Specs">
          {renderField('Project ID', project.Project_ID)}
          {renderField('Type', project.Project_Type)}
          {renderField('Business Unit', project.Business_Unit)}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[10px] uppercase text-stone-400 font-bold tracking-wider block mb-1">Priority</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
              project.Priority_Level === 'A' ? 'bg-red-600 text-white' :
              project.Priority_Level === 'B' ? 'bg-orange-500 text-white' :
              'bg-stone-200 text-stone-600'
            }`}>
              PRIORITY {project.Priority_Level}
            </span>
          </div>
          {renderField('Assigned Leader', project.Assigned_Leader_Name || project.Assigned_Leader)}
          {renderField('Reviewer', project.Reviewer_Name_Display || project.Reviewer_Name)}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[10px] uppercase text-stone-400 font-bold tracking-wider block mb-1">Target End Date</span>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-stone-800">{project.Target_End_Date}</p>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getDaysLeftInfo(getDaysRemaining(project.Target_End_Date || '')).color}`}>
                {getDaysLeftInfo(getDaysRemaining(project.Target_End_Date || '')).text}
              </span>
            </div>
          </div>
        </ZoneSection>

        {/* Zone B: Execution */}
        <ZoneSection title="Zone B: Execution Status">
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[10px] uppercase text-stone-400 font-bold tracking-wider block mb-1">Status</span>
            <div className="flex items-center gap-2">
              <p className={`text-sm font-bold ${
                user.role === 'owner' && project.Project_Status === 'Returned' 
                ? 'text-orange-600' 
                : 'text-stone-800'
              }`}>
                {user.role === 'owner' && project.Project_Status === 'Returned' 
                  ? `Feedback Received — ${project.Return_Reason || 'Reviewer needs more info'}. Your reviewer wants to help you succeed.`
                  : project.Project_Status
                }
              </p>
            </div>
          </div>
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[10px] uppercase text-stone-400 font-bold tracking-wider block mb-1">Health</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                project.Health_Status === 'Green' ? 'bg-emerald-500' :
                project.Health_Status === 'Yellow' ? 'bg-amber-500' :
                'bg-red-500'
              }`} />
              <p className="text-sm font-medium text-stone-800">{project.Health_Status}</p>
            </div>
            {project.Health_Status_Reason && (
              <p className="text-[10px] italic text-stone-500 mt-1">{project.Health_Status_Reason}</p>
            )}
          </div>
          {renderField('Blocked Reason', project.Blocked_Reason)}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[10px] uppercase text-stone-400 font-bold tracking-wider block mb-1">Next Update Due</span>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-stone-800">{project.Next_Update_Due}</p>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getDaysLeftInfo(getDaysRemaining(project.Next_Update_Due || '')).color}`}>
                {getDaysLeftInfo(getDaysRemaining(project.Next_Update_Due || '')).text}
              </span>
            </div>
          </div>
          {renderField('Owner Restatement', project.Owner_Restatement)}
          {renderField('Execution Facts', project.Execution_Facts_Update)}
        </ZoneSection>

        {/* Action Forms */}
        {(user.role === 'admin' || user.role === 'reviewer' || user.role === 'sma') && (
          <ZoneSection title="Zone C: Review & Verification">
            {renderField('Complete With Proof?', project['Complete_With_Proof?'])}
            {renderField('On Time?', project['On_Time?'])}
            {renderField('Okay Quality?', project['Okay_Quality?'])}
            {renderField('Reviewer Decision', project.Reviewer_Decision)}
            {renderField('Return Reason', project.Return_Reason)}
            {renderField('Verified By', project.Verified_By)}
          </ZoneSection>
        )}

        {/* Zone D: SMA/Founder/GM */}
        {(user.role === 'admin' || user.role === 'founder' || user.role === 'sma' || user.role === 'gm' || user.role === 'bu_head') && (
          <ZoneSection title="Zone D: System Enforcement">
            {renderField('Trigger Hit', project.Trigger_Hit)}
            {renderField('Severity', project.Trigger_Severity)}
            {renderField('Consequence', project.Trigger_Consequence_Level)}
            {renderField('MD Intervention', project.MD_Intervention)}
            {renderField('Repeat Misses', project.Repeat_Miss_Count)}
          </ZoneSection>
        )}

        {/* Action Forms */}
        <div className="mt-12 pt-12 border-t border-stone-200">
          <h3 className="text-xl font-bold text-stone-900 mb-6">Take Action</h3>
          {user.role === 'owner' && project.Project_Status !== 'Closed' && project.Project_Status !== 'Accomplished' && (
            <OwnerUpdateForm 
              project={project} 
              onSuccess={onClose} 
              onCancel={onClose} 
            />
          )}
          {user.role === 'founder' && project.Project_Status === 'Escalated' && (
            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
              <FinalDecisionForm 
                project={project} 
                onSuccess={onClose} 
                onCancel={onClose} 
              />
            </div>
          )}
          {user.role === 'reviewer' && project.Project_Status === 'Submitted' && (
            <ReviewForm 
              project={project} 
              user={user} 
              onSuccess={onClose} 
              onCancel={onClose} 
            />
          )}
          {(user.role === 'admin' || user.role === 'sma') && (
            <div className="space-y-4">
              <p className="text-sm text-stone-500 italic">Admin/SMA can use the forms below to override status or review.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowOverrideForm('reviewer')}
                  className={`p-4 border rounded-2xl font-bold transition-all ${showOverrideForm === 'reviewer' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-900 hover:bg-stone-50'}`}
                >
                  Open Review Form
                </button>
                <button 
                  onClick={() => setShowOverrideForm('owner')}
                  className={`p-4 border rounded-2xl font-bold transition-all ${showOverrideForm === 'owner' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-900 hover:bg-stone-50'}`}
                >
                  Open Owner Update Form
                </button>
              </div>

              <AnimatePresence>
                {showOverrideForm === 'owner' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="p-6 bg-stone-50 rounded-3xl border border-stone-200 mt-4">
                      <OwnerUpdateForm project={project} onSuccess={onClose} onCancel={() => setShowOverrideForm(null)} />
                    </div>
                  </motion.div>
                )}
                {showOverrideForm === 'reviewer' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="p-6 bg-stone-50 rounded-3xl border border-stone-200 mt-4">
                      <ReviewForm project={project} user={user} onSuccess={onClose} onCancel={() => setShowOverrideForm(null)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Audit Trail */}
        <div className="mt-12">
          <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <History className="w-4 h-4" />
            Full History / Audit Trail
          </h3>
          <div className="space-y-4">
            {history.length > 0 ? history.map((entry) => (
              <div key={entry.id} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-stone-900 text-sm">{entry.userName}</span>
                  <span className="text-[10px] text-stone-400">{entry.timestamp?.toDate().toLocaleString()}</span>
                </div>
                <p className="text-xs text-stone-600 mb-2">{entry.action}</p>
                {entry.changes && (
                  <div className="space-y-1">
                    {Object.entries(entry.changes).map(([field, change]) => {
                      const c = change as { old: any; new: any };
                      return (
                        <div key={field} className="text-[10px] flex items-center gap-2">
                          <span className="font-bold text-stone-400 uppercase">{field.replace(/_/g, ' ')}:</span>
                          <span className="text-red-400 line-through">{String(c.old)}</span>
                          <ChevronRight className="w-2 h-2 text-stone-300" />
                          <span className="text-emerald-600 font-bold">{String(c.new)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )) : (
              <div className="text-center py-8 text-stone-400 text-sm italic">
                No history entries found for this project.
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
