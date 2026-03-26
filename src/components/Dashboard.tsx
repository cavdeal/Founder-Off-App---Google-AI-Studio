import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { User, Project, ProjectStatus, HealthStatus } from '../types';
import { 
  LogOut, 
  LayoutDashboard, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  Menu, 
  X,
  Search,
  Filter,
  Users,
  Clock,
  ShieldAlert,
  ChevronRight,
  Home,
  ArrowLeft,
  User as UserIcon,
  BarChart3,
  ListTodo,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpDown,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
import ProjectForm from './ProjectForm';
import OwnerUpdateForm from './OwnerUpdateForm';
import ReviewForm from './ReviewForm';
import ProjectDetail from './ProjectDetail';
import FinalDecisionForm from './FinalDecisionForm';

interface DashboardProps {
  user: User;
}

type FilterType = 'all' | 'red' | 'yellow' | 'green' | 'overdue' | 'review' | 'my-tasks' | 'my-bu';

export default function Dashboard({ user }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'projects' | 'create' | 'review' | 'founder' | 'profile'>('projects');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [buFilter, setBuFilter] = useState<string>(user.business_unit || 'All');
  const [redBannerDismissed, setRedBannerDismissed] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    return localStorage.getItem(`onboarding_dismissed_${user.uid}`) === 'true';
  });
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    return (localStorage.getItem(`view_mode_${user.uid}`) as 'card' | 'table') || 'card';
  });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    localStorage.setItem(`view_mode_${user.uid}`, viewMode);
  }, [viewMode, user.uid]);

  useEffect(() => {
    // Set initial tab based on role
    if (user.role === 'founder') {
      setActiveTab('founder');
    } else if (user.role === 'reviewer') {
      setActiveTab('review');
    }
  }, [user.role]);

  useEffect(() => {
    setLoading(true);
    let q;

    // Role-based query logic
    if (user.role === 'admin' || user.role === 'sma') {
      q = query(collection(db, 'projects'), orderBy('Last_Updated_Date', 'desc'));
    } else if (user.role === 'founder') {
      // Founder view is more complex, we'll fetch all and filter in memory for the "Founder" tab
      // or fetch a broader set. For simplicity in this demo, fetch all projects and filter.
      q = query(collection(db, 'projects'), orderBy('Last_Updated_Date', 'desc'));
    } else if (user.role === 'gm' || user.role === 'bu_head') {
      q = query(collection(db, 'projects'), where('Business_Unit', '==', user.business_unit), orderBy('Last_Updated_Date', 'desc'));
    } else if (user.role === 'reviewer') {
      q = query(collection(db, 'projects'), where('Project_Status', '==', 'Submitted'), orderBy('Last_Updated_Date', 'desc'));
    } else {
      // Owner - filter by Assigned_Leader (using name for now as per previous implementation)
      q = query(collection(db, 'projects'), where('Assigned_Leader', '==', user.name), orderBy('Last_Updated_Date', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching projects:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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

  const stats = {
    total: projects.length,
    red: projects.filter(p => p.Health_Status === 'Red').length,
    overdue: projects.filter(p => {
      const days = getDaysRemaining(p.Target_End_Date || '');
      return days !== null && days < 0 && p.Project_Status !== 'Closed';
    }).length,
    awaitingReview: projects.filter(p => p.Project_Status === 'Submitted').length,
    mdIntervention: projects.filter(p => p.MD_Intervention === 'Yes').length
  };

  const getStepInfo = (status: ProjectStatus) => {
    switch (status) {
      case 'Assigned': return { step: 1, label: 'Confirm Project' };
      case 'Confirmed': return { step: 2, label: 'Start Execution' };
      case 'In Progress': return { step: 3, label: 'Update & Submit' };
      case 'Submitted': return { step: 4, label: 'Awaiting Review' };
      case 'Returned': return { step: 5, label: 'Fix & Resubmit' };
      case 'Approved': return { step: 6, label: 'Finalizing' };
      case 'Closed':
      case 'Accomplished': return { step: 7, label: 'Done' };
      default: return { step: 1, label: 'Assigned' };
    }
  };

  const handleDismissOnboarding = () => {
    setOnboardingDismissed(true);
    localStorage.setItem(`onboarding_dismissed_${user.uid}`, 'true');
  };

  const getTimeSinceSubmission = (dateStr?: string) => {
    if (!dateStr) return null;
    const submittedDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - submittedDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    return `Received ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  };

  const isOverdueForReview = (dateStr?: string) => {
    if (!dateStr) return false;
    const submittedDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - submittedDate.getTime();
    return diffMs > (48 * 60 * 60 * 1000);
  };

  const getCardBgColor = (health?: HealthStatus) => {
    switch (health) {
      case 'Green': return 'bg-emerald-50';
      case 'Yellow': return 'bg-amber-50';
      case 'Red': return 'bg-red-50';
      default: return 'bg-white';
    }
  };

  const getNextAction = (project: Project) => {
    switch (project.Project_Status) {
      case 'Assigned': return "Step 2: Write your Restatement to confirm you understand this project.";
      case 'Confirmed': return "Step 3: Start work and post your first update.";
      case 'In Progress': return `Step 3: Post your weekly update before ${project.Next_Update_Due}.`;
      case 'Returned': return `Feedback Received — ${project.Return_Reason || 'Reviewer needs more info'}. Your reviewer wants to help you succeed.`;
      case 'Submitted': return "Step 4: Waiting for reviewer. No action needed yet.";
      case 'Approved': return "Step 7: Mark this as Closed.";
      default: return "";
    }
  };

  const handleQuickAction = async (projectId: string, field: string, value: any) => {
    try {
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, { [field]: value, Last_Updated_Date: serverTimestamp() });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  const interventionsThisWeek = projects.filter(p => 
    p.MD_Intervention === 'Yes' && 
    p.Last_Updated_Date && 
    (new Date().getTime() - p.Last_Updated_Date.toDate().getTime()) < (7 * 24 * 60 * 60 * 1000)
  ).length;

  const filteredProjects = projects.filter(p => {
    if (user.role === 'founder') {
      return p.Project_Status === 'Escalated' || p.MD_Intervention === 'Yes';
    }
    
    if (user.role === 'reviewer') {
      return p.Project_Status === 'Submitted';
    }

    if (user.role === 'owner') {
      if (currentFilter === 'my-tasks') return p.Assigned_Leader === user.name;
    }

    if (user.role === 'gm' || user.role === 'bu_head') {
      if (p.Business_Unit !== user.business_unit) return false;
    }
    
    // Apply summary card filters
    if (currentFilter === 'red') return p.Health_Status === 'Red';
    if (currentFilter === 'yellow') return p.Health_Status === 'Yellow';
    if (currentFilter === 'green') return p.Health_Status === 'Green';
    if (currentFilter === 'overdue') {
      const days = getDaysRemaining(p.Target_End_Date || '');
      return days !== null && days < 0 && p.Project_Status !== 'Closed';
    }
    if (currentFilter === 'review') return p.Project_Status === 'Submitted';
    if (currentFilter === 'my-tasks') return p.Assigned_Leader === user.name;
    if (currentFilter === 'my-bu') return p.Business_Unit === user.business_unit;
    
    return true;
  }).sort((a, b) => {
    if (sortConfig) {
      const { key, direction } = sortConfig;
      let aValue: any = a[key as keyof Project];
      let bValue: any = b[key as keyof Project];

      if (key === 'daysRemaining') {
        aValue = getDaysRemaining(a.Target_End_Date || '') || 999;
        bValue = getDaysRemaining(b.Target_End_Date || '') || 999;
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    }

    if (user.role === 'sma') {
      const severityMap: any = { 'Critical': 3, 'High': 2, 'Medium': 1, 'Low': 0 };
      return (severityMap[b.Trigger_Severity || 'Low'] || 0) - (severityMap[a.Trigger_Severity || 'Low'] || 0);
    }
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 text-stone-900" /> : <ChevronDown className="w-3 h-3 ml-1 text-stone-900" />;
  };

  const handleSignOut = () => signOut(auth);

  const NavItem = ({ tab, icon: Icon, label, onClick }: { tab: any, icon: any, label: string, onClick?: () => void }) => (
    <button 
      onClick={onClick || (() => { setActiveTab(tab); setSelectedProject(null); setCurrentFilter('all'); })}
      className={`flex flex-col items-center justify-center flex-1 min-h-[56px] min-w-[44px] gap-1 transition-all ${
        activeTab === tab ? 'text-stone-900' : 'text-stone-400'
      }`}
    >
      <Icon className={`w-6 h-6 ${activeTab === tab ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {activeTab === tab && (
        <motion.div layoutId="nav-indicator" className="absolute bottom-0 w-1 h-1 bg-stone-900 rounded-full" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-stone-100 pb-20 lg:pb-0">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-stone-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <button 
          onClick={() => { setActiveTab('projects'); setSelectedProject(null); setCurrentFilter('all'); }}
          className="flex items-center gap-2"
        >
          <div className="w-8 h-8 bg-stone-800 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">FO</span>
          </div>
          <span className="font-bold text-stone-900">Founder-Off</span>
        </button>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${
              activeTab === 'profile' ? 'bg-stone-800 text-white border-stone-800' : 'bg-stone-100 text-stone-600 border-stone-200'
            }`}
          >
            {user.name.charAt(0)}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Hidden on mobile, shown on desktop */}
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-stone-200 h-screen sticky top-0">
          <button 
            onClick={() => { setActiveTab('projects'); setSelectedProject(null); setCurrentFilter('all'); }}
            className="p-6 flex items-center gap-3 mb-8 w-full text-left hover:bg-stone-50 transition-colors"
          >
            <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-white font-bold">FO</span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-stone-900 leading-none">Founder-Off</span>
              <span className="text-[10px] text-stone-500 uppercase tracking-wider mt-1 truncate">Lotus Development</span>
            </div>
          </button>

          <nav className="px-4 space-y-2 flex-1">
            <button 
              onClick={() => { setActiveTab('projects'); setSelectedProject(null); setCurrentFilter('all'); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[44px] ${activeTab === 'projects' ? 'bg-stone-100 text-stone-900 font-medium' : 'text-stone-500 hover:bg-stone-50'}`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>
            
            {user.role === 'founder' && (
              <button 
                onClick={() => { setActiveTab('founder'); setSelectedProject(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[44px] ${activeTab === 'founder' ? 'bg-stone-900 text-white font-medium' : 'text-stone-500 hover:bg-stone-50'}`}
              >
                <ShieldAlert className="w-5 h-5" />
                Founder View
              </button>
            )}

            {(user.role === 'admin' || user.role === 'gm' || user.role === 'bu_head') && (
              <button 
                onClick={() => { setActiveTab('create'); setSelectedProject(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[44px] ${activeTab === 'create' ? 'bg-stone-100 text-stone-900 font-medium' : 'text-stone-500 hover:bg-stone-50'}`}
              >
                <PlusCircle className="w-5 h-5" />
                New Project
              </button>
            )}

            {(user.role === 'admin' || user.role === 'reviewer' || user.role === 'sma') && (
              <button 
                onClick={() => { setActiveTab('review'); setSelectedProject(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[44px] ${activeTab === 'review' ? 'bg-stone-100 text-stone-900 font-medium' : 'text-stone-500 hover:bg-stone-50'}`}
              >
                <CheckCircle2 className="w-5 h-5" />
                Review Queue
              </button>
            )}
          </nav>

          <div className="p-4 border-t border-stone-100 bg-white">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-2 min-h-[44px] ${activeTab === 'profile' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-50'}`}
            >
              <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center text-stone-600 font-bold text-xs">
                {user.name.charAt(0)}
              </div>
              <span className="font-medium truncate">{user.name}</span>
            </button>
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all min-h-[44px]"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Bottom Navigation for Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex items-center justify-around px-2 z-50 h-[64px]">
          {user.role === 'owner' ? (
            <>
              <NavItem tab="projects" icon={Home} label="Home" />
              <NavItem tab="projects" icon={ListTodo} label="My Tasks" onClick={() => { setActiveTab('projects'); setCurrentFilter('my-tasks'); setSelectedProject(null); }} />
              <NavItem tab="profile" icon={UserIcon} label="Profile" />
            </>
          ) : (user.role === 'gm' || user.role === 'bu_head') ? (
            <>
              <NavItem tab="projects" icon={Home} label="Home" />
              <NavItem tab="projects" icon={Users} label="My BU" onClick={() => { setActiveTab('projects'); setCurrentFilter('my-bu'); setSelectedProject(null); }} />
              <NavItem tab="create" icon={PlusCircle} label="New" />
              <NavItem tab="projects" icon={BarChart3} label="Reports" onClick={() => { setActiveTab('projects'); setCurrentFilter('all'); setSelectedProject(null); }} />
            </>
          ) : user.role === 'founder' ? (
            <>
              <NavItem tab="founder" icon={ShieldAlert} label="Intervene" />
              <NavItem tab="projects" icon={Home} label="Home" />
              <NavItem tab="review" icon={CheckCircle2} label="Review" />
              <NavItem tab="profile" icon={UserIcon} label="Profile" />
            </>
          ) : user.role === 'sma' ? (
            <>
              <NavItem tab="projects" icon={ShieldAlert} label="Enforce" />
              <NavItem tab="projects" icon={Home} label="Home" />
              <NavItem tab="review" icon={CheckCircle2} label="Review" />
              <NavItem tab="profile" icon={UserIcon} label="Profile" />
            </>
          ) : (
            <>
              <NavItem tab="projects" icon={Home} label="Home" />
              <NavItem tab="review" icon={CheckCircle2} label="Review" />
              <NavItem tab="create" icon={PlusCircle} label="New" />
              <NavItem tab="profile" icon={UserIcon} label="Profile" />
            </>
          )}
        </nav>

        {/* Floating Action Button for GM/BU Head */}
        {(user.role === 'gm' || user.role === 'bu_head' || user.role === 'admin') && activeTab === 'projects' && !selectedProject && (
          <button 
            onClick={() => setActiveTab('create')}
            className="lg:hidden fixed bottom-20 right-6 w-14 h-14 bg-stone-900 text-white rounded-full shadow-2xl flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
          >
            <PlusCircle className="w-8 h-8" />
          </button>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          {/* Onboarding Card */}
          {!onboardingDismissed && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 p-8 bg-stone-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <LayoutDashboard className="w-6 h-6 text-amber-400" />
                  </div>
                  <button 
                    onClick={handleDismissOnboarding}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <h2 className="text-2xl font-bold mb-4">Welcome to Founder-Off</h2>
                <p className="text-stone-300 text-lg leading-relaxed mb-6">
                  "Green, Yellow, Red are signals — not grades. Red means the system is helping you, not judging you. Declare blockers early — it's a sign of good judgment, not weakness."
                </p>
                <button 
                  onClick={handleDismissOnboarding}
                  className="px-6 py-3 bg-white text-stone-900 rounded-xl font-bold hover:bg-stone-100 transition-all"
                >
                  Got it, let's go
                </button>
              </div>
            </motion.div>
          )}

          {/* MD Interventions Gauge - Top of Screen for Founder */}
          {user.role === 'founder' && activeTab === 'founder' && (
            <div className="mb-8 bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col">
                  <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight">MD Command Center</h2>
                  <p className="text-sm text-stone-500 font-medium">Only escalated items reach here. Everything else has been handled.</p>
                </div>
                <div className="text-right">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                    interventionsThisWeek >= 3 ? 'bg-red-100 text-red-600' : 
                    interventionsThisWeek === 2 ? 'bg-amber-100 text-amber-600' : 
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    This week: {interventionsThisWeek} of 2 interventions used
                  </span>
                </div>
              </div>
              <div className="w-full h-6 bg-stone-100 rounded-full overflow-hidden p-1 border border-stone-200">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((interventionsThisWeek / 2) * 100, 100)}%` }}
                  className={`h-full rounded-full transition-all duration-700 ${
                    interventionsThisWeek >= 3 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 
                    interventionsThisWeek === 2 ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 
                    'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  }`}
                />
              </div>
              <div className="flex justify-between mt-3 px-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">0 used</span>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">2 Target</span>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Limit Reached</span>
              </div>
            </div>
          )}

          {/* Red Health Banner */}
          {!redBannerDismissed && projects.some(p => p.Health_Status === 'Red') && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-red-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                <p className="font-bold">🔴 Red is a signal — not a punishment. This is help.</p>
              </div>
              <button 
                onClick={() => setRedBannerDismissed(true)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* Role-Specific Headers */}
          {user.role === 'founder' && activeTab === 'founder' && (
            null // Moved to top
          )}

          {user.role === 'owner' && activeTab === 'projects' && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900">Mga Trabaho Ko (My Tasks)</h2>
            </div>
          )}

          {user.role === 'reviewer' && activeTab === 'review' && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900">Review Queue</h2>
            </div>
          )}

          {(user.role === 'gm' || user.role === 'bu_head') && activeTab === 'projects' && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900">BU Command Center</h2>
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
                {['all', 'green', 'yellow', 'red'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setCurrentFilter(f as FilterType)}
                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${
                      currentFilter === f 
                      ? 'bg-stone-900 text-white border-stone-900' 
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {user.role === 'sma' && activeTab === 'projects' && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900">System Enforcement Center</h2>
            </div>
          )}

          {/* Summary Bar for GM/Admin/SMA */}
          {['gm', 'bu_head', 'admin', 'sma'].includes(user.role) && activeTab === 'projects' && !selectedProject && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <button 
                onClick={() => setCurrentFilter('all')}
                className={`p-4 rounded-2xl border transition-all text-left min-h-[80px] ${currentFilter === 'all' ? 'bg-stone-900 text-white border-stone-900 shadow-lg' : 'bg-white border-stone-200 text-stone-900 hover:border-stone-300'}`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`p-2 rounded-lg ${currentFilter === 'all' ? 'bg-white/10 text-white' : 'bg-stone-100 text-stone-600'}`}>
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${currentFilter === 'all' ? 'text-stone-400' : 'text-stone-500'}`}>Total Active</span>
                </div>
                <div className="text-2xl font-bold">{stats.total}</div>
              </button>

              <button 
                onClick={() => setCurrentFilter('red')}
                className={`p-4 rounded-2xl border transition-all text-left min-h-[80px] ${currentFilter === 'red' ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-white border-stone-200 text-stone-900 hover:border-stone-300'}`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`p-2 rounded-lg ${currentFilter === 'red' ? 'bg-white/10 text-white' : 'bg-red-100 text-red-600'}`}>
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${currentFilter === 'red' ? 'text-red-200' : 'text-stone-500'}`}>Red Count</span>
                </div>
                <div className="text-2xl font-bold">{stats.red}</div>
              </button>

              <button 
                onClick={() => setCurrentFilter('overdue')}
                className={`p-4 rounded-2xl border transition-all text-left min-h-[80px] ${currentFilter === 'overdue' ? 'bg-orange-600 text-white border-orange-600 shadow-lg' : 'bg-white border-stone-200 text-stone-900 hover:border-stone-300'}`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`p-2 rounded-lg ${currentFilter === 'overdue' ? 'bg-white/10 text-white' : 'bg-orange-100 text-orange-600'}`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${currentFilter === 'overdue' ? 'text-orange-200' : 'text-stone-500'}`}>Overdue</span>
                </div>
                <div className="text-2xl font-bold">{stats.overdue}</div>
              </button>

              <button 
                onClick={() => setCurrentFilter('review')}
                className={`p-4 rounded-2xl border transition-all text-left min-h-[80px] ${currentFilter === 'review' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white border-stone-200 text-stone-900 hover:border-stone-300'}`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`p-2 rounded-lg ${currentFilter === 'review' ? 'bg-white/10 text-white' : 'bg-blue-100 text-blue-600'}`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${currentFilter === 'review' ? 'text-blue-200' : 'text-stone-500'}`}>Awaiting Review</span>
                </div>
                <div className="text-2xl font-bold">{stats.awaitingReview}</div>
              </button>
            </div>
          )}

          {/* Founder Intervention Monitor - Removed as it's redundant now */}
          {user.role === 'founder' && activeTab === 'founder' && (
            null
          )}

          <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              {(activeTab !== 'projects' || selectedProject) && (
                <button 
                  onClick={() => { setActiveTab('projects'); setSelectedProject(null); }}
                  className="p-3 bg-white border border-stone-200 rounded-2xl hover:bg-stone-50 text-stone-600 transition-all shadow-sm group"
                  title="Back to Dashboard"
                >
                  <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              )}
              <div>
                <h1 className="text-3xl font-bold text-stone-900">
                  {activeTab === 'projects' && (selectedProject ? 'Project Update' : 'Project Dashboard')}
                  {activeTab === 'create' && 'Create New Project'}
                  {activeTab === 'review' && 'Review Queue'}
                  {activeTab === 'founder' && (selectedProject ? 'Set Final Decision' : 'MD Command Center')}
                </h1>
                <p className="text-stone-500 mt-1">
                  {activeTab === 'projects' && (selectedProject ? `Updating ${selectedProject.Project_Name}` : `Welcome back, ${user.name}. Here's what's happening.`)}
                  {activeTab === 'create' && 'Assign a new task or project to a team leader.'}
                  {activeTab === 'review' && 'Verify submissions and enforce standards.'}
                  {activeTab === 'founder' && (selectedProject ? `Final decision for ${selectedProject.Project_Name}` : "Only escalated items reach here. Everything else has been handled.")}
                </p>
              </div>
            </div>

            {(activeTab === 'projects' || activeTab === 'founder' || activeTab === 'review') && !selectedProject && (
              <div className="flex items-center gap-3">
                {/* View Mode Toggle */}
                <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
                  <button 
                    onClick={() => setViewMode('card')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                    title="Card View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                    title="Table View"
                  >
                    <TableIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                  <input 
                    type="text" 
                    placeholder="Search projects..." 
                    className="pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-800"
                  />
                </div>
                <button className="p-2 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
                  <Filter className="w-5 h-5 text-stone-600" />
                </button>
              </div>
            )}
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (selectedProject ? '-edit' : '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'profile' && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                    <div className="flex flex-col items-center text-center mb-8">
                      <div className="w-24 h-24 bg-stone-800 text-white rounded-full flex items-center justify-center text-4xl font-bold mb-4 shadow-xl">
                        {user.name.charAt(0)}
                      </div>
                      <h2 className="text-2xl font-bold text-stone-900">{user.name}</h2>
                      <p className="text-stone-500 uppercase tracking-widest text-xs font-bold mt-1">{user.role}</p>
                      <p className="text-stone-400 text-sm mt-1">{user.email}</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                        <span className="text-[10px] uppercase text-stone-400 font-bold block mb-1">Business Unit</span>
                        <p className="font-medium text-stone-800">{user.business_unit || 'General'}</p>
                      </div>
                      
                      <button 
                        onClick={handleSignOut}
                        className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-red-100 transition-all min-h-[44px]"
                      >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(activeTab === 'projects' || activeTab === 'founder' || activeTab === 'review') && (
                <div className="space-y-6">
                  {/* SMA Specific: Reviewer Overdue Section */}
                  {user.role === 'sma' && activeTab === 'projects' && !selectedProject && (
                    <div className="mb-8">
                      {projects.filter(p => p.Project_Status === 'Submitted' && isOverdueForReview(p.Last_Updated_Date?.toDate().toISOString())).length > 0 && (
                        <div className="bg-red-50 border-2 border-red-100 rounded-[2.5rem] p-8 shadow-sm">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg">
                              <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div>
                              <h2 className="text-xl font-black text-red-900 uppercase tracking-tight">Reviewer Overdue</h2>
                              <p className="text-red-700 text-sm font-medium">The following items have exceeded the 48-hour review window.</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {projects
                              .filter(p => p.Project_Status === 'Submitted' && isOverdueForReview(p.Last_Updated_Date?.toDate().toISOString()))
                              .map(p => (
                                <div key={p.id} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-between">
                                  <div>
                                    <h3 className="font-bold text-stone-900 line-clamp-1 mb-1">{p.Project_Name}</h3>
                                    <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Reviewer: {p.Verified_By || 'Unassigned'}</p>
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-red-50 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-red-600 uppercase">
                                      {getTimeSinceSubmission(p.Last_Updated_Date?.toDate().toISOString())}
                                    </span>
                                    <button 
                                      onClick={() => setSelectedProject(p)}
                                      className="text-[10px] font-black text-stone-900 underline uppercase"
                                    >
                                      View Item
                                    </button>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedProject ? (
                    activeTab === 'founder' ? (
                      <div className="max-w-2xl mx-auto">
                        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                          <FinalDecisionForm 
                            project={selectedProject} 
                            onSuccess={() => setSelectedProject(null)} 
                            onCancel={() => setSelectedProject(null)} 
                          />
                        </div>
                      </div>
                    ) : (
                      <ProjectDetail 
                        project={selectedProject} 
                        user={user} 
                        onClose={() => setSelectedProject(null)} 
                      />
                    )
                  ) : (
                    <>
                      {viewMode === 'card' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="bg-white h-48 rounded-2xl animate-pulse border border-stone-200"></div>
                        ))
                      ) : filteredProjects.length > 0 ? (
                        filteredProjects.map((project) => (
                          <div 
                            key={project.id}
                            onClick={() => setSelectedProject(project)}
                            className={`group p-6 rounded-[2.5rem] border border-stone-200 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden border-l-4 ${
                              project.Health_Status === 'Green' ? 'border-l-emerald-500' :
                              project.Health_Status === 'Yellow' ? 'border-l-amber-400' :
                              'border-l-red-500'
                            } ${user.role === 'owner' ? getCardBgColor(project.Health_Status) : 'bg-white'}`}
                          >
                            {/* Owner Specific: Step Indicator */}
                            {user.role === 'owner' && (
                              <div className="mb-4 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                                  Ikaw ay nasa Step {getStepInfo(project.Project_Status).step} ng 7
                                </span>
                                <span className="text-xs font-bold text-stone-900 px-3 py-1 bg-white/50 rounded-full">
                                  {getStepInfo(project.Project_Status).label}
                                </span>
                              </div>
                            )}

                            {/* Reviewer Specific: Submission Time */}
                            {user.role === 'reviewer' && (
                              <div className="mb-4">
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isOverdueForReview(project.Last_Updated_Date?.toDate().toISOString()) ? 'text-red-600' : 'text-stone-500'}`}>
                                    {getTimeSinceSubmission(project.Last_Updated_Date?.toDate().toISOString())}
                                  </span>
                                  {isOverdueForReview(project.Last_Updated_Date?.toDate().toISOString()) && (
                                    <span className="text-[10px] font-black text-red-600 animate-pulse bg-red-50 px-2 py-1 rounded-full">
                                      ⚠️ OVERDUE FOR REVIEW — 48-hour window passed
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* SMA Specific: Trigger Severity */}
                            {user.role === 'sma' && (
                              <div className="mb-4 flex items-center justify-between">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                  project.Trigger_Severity === 'Critical' ? 'bg-red-600 text-white' :
                                  project.Trigger_Severity === 'High' ? 'bg-orange-500 text-white' :
                                  'bg-stone-100 text-stone-600'
                                }`}>
                                  {project.Trigger_Severity || 'Normal'}
                                </span>
                                <span className="text-[10px] font-bold text-stone-500">
                                  Misses: {project.Repeat_Miss_Count || 0}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-start mb-4">
                              <div className="flex-1">
                                <div className="flex flex-col gap-1 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${
                                      project.Health_Status === 'Green' ? 'bg-emerald-500' :
                                      project.Health_Status === 'Yellow' ? 'bg-amber-500' :
                                      'bg-red-500'
                                    }`} />
                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{project.Business_Unit}</span>
                                    
                                    {/* Priority Badge */}
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                      project.Priority_Level === 'A' ? 'bg-red-600 text-white font-bold' :
                                      project.Priority_Level === 'B' ? 'bg-orange-500 text-white' :
                                      'bg-stone-200 text-stone-600'
                                    }`}>
                                      PRIORITY {project.Priority_Level}
                                    </span>
                                  </div>
                                  {project.Health_Status_Reason && (
                                    <p className="text-[10px] italic text-stone-500 ml-4">
                                      {project.Health_Status} — {project.Health_Status_Reason}
                                    </p>
                                  )}
                                </div>
                                <h3 className="font-bold text-stone-900 line-clamp-1 text-lg">{project.Project_Name}</h3>
                              </div>
                            </div>

                            {/* Trigger Alert Chip */}
                            {project.Trigger_Hit && project.Trigger_Hit !== 'None' && (
                              <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-100 rounded-full">
                                <span className="text-red-500 text-xs">🔴</span>
                                <span className="text-[10px] font-black text-red-600 uppercase tracking-tight">{project.Trigger_Hit}</span>
                              </div>
                            )}

                            {/* Why This Reached You Section for Founder */}
                            {user.role === 'founder' && project.Project_Status === 'Escalated' && (
                              <div className="mb-4 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <ShieldAlert className="w-3 h-3" />
                                  Why This Reached You
                                </h4>
                                <div className="space-y-2 text-xs">
                                  <div>
                                    <p className="text-stone-400 text-[10px] font-bold uppercase">Escalated By</p>
                                    <p className="font-medium text-stone-800">{project.Verified_By || 'System'}</p>
                                  </div>
                                  <div>
                                    <p className="text-stone-400 text-[10px] font-bold uppercase">Reason</p>
                                    <p className="font-medium text-stone-800">{project.Escalation_Reason || 'Trigger Threshold Reached'}</p>
                                  </div>
                                  <div className="flex justify-between">
                                    <div>
                                      <p className="text-stone-400 text-[10px] font-bold uppercase">Trigger</p>
                                      <p className="font-medium text-red-600">{project.Trigger_Hit || 'Manual'}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-stone-400 text-[10px] font-bold uppercase">Consequence</p>
                                      <p className="font-medium text-stone-800">{project.Trigger_Consequence_Level || 'Level 4'}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="space-y-3">
                              {user.role === 'founder' ? (
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <p className="text-stone-400 uppercase text-[10px] font-bold">Owner</p>
                                    <p className="font-medium">{project.Assigned_Leader}</p>
                                  </div>
                                  <div>
                                    <p className="text-stone-400 uppercase text-[10px] font-bold">Overdue</p>
                                    <p className="font-medium text-red-600 font-bold">
                                      {Math.abs(getDaysRemaining(project.Target_End_Date || '') || 0)} days OVERDUE
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-stone-500">
                                      <Users className="w-3 h-3" />
                                      <span>{project.Assigned_Leader}</span>
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg font-bold text-[10px] uppercase tracking-tighter ${getDaysLeftInfo(getDaysRemaining(project.Target_End_Date || '')).color}`}>
                                      {getDaysLeftInfo(getDaysRemaining(project.Target_End_Date || '')).text}
                                    </div>
                                  </div>

                                  {/* Owner Specific: Next Update Countdown */}
                                  {user.role === 'owner' && project.Next_Update_Due && (
                                    <div className="p-4 bg-white/80 rounded-2xl border-2 border-stone-200 shadow-sm">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-black text-stone-900 uppercase tracking-tight">Next update due: {project.Next_Update_Due}</p>
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-full ${getDaysLeftInfo(getDaysRemaining(project.Next_Update_Due)).color}`}>
                                          {getDaysLeftInfo(getDaysRemaining(project.Next_Update_Due)).text}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full ${getDaysLeftInfo(getDaysRemaining(project.Next_Update_Due)).color.split(' ')[0]} transition-all duration-1000`} 
                                            style={{ width: `${Math.max(0, Math.min(100, (getDaysRemaining(project.Next_Update_Due) || 0) * 10))}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* YOUR NEXT ACTION Section for Owners */}
                            {user.role === 'owner' && (
                              <div className={`mt-4 p-4 text-white rounded-2xl shadow-lg border-t-4 ${
                                project.Project_Status === 'Returned' 
                                ? 'bg-orange-500 border-t-orange-300' 
                                : 'bg-stone-900 border-t-emerald-500'
                              }`}>
                                <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${
                                  project.Project_Status === 'Returned' ? 'text-orange-100' : 'text-emerald-400'
                                }`}>
                                  {project.Project_Status === 'Returned' ? 'Feedback Received' : 'Your Next Action'}
                                </h4>
                                <p className="text-sm font-bold leading-tight">
                                  {getNextAction(project)}
                                </p>
                              </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-stone-400 uppercase">
                                  {(user.role === 'gm' || user.role === 'bu_head') ? 'Reviewer' : 'Status'}
                                </span>
                                <span className="text-xs font-medium text-stone-700">
                                  {(user.role === 'gm' || user.role === 'bu_head') 
                                    ? (project.Verified_By || 'Unassigned') 
                                    : (user.role === 'owner' && project.Project_Status === 'Returned' 
                                        ? 'Feedback Received' 
                                        : project.Project_Status)
                                  }
                                </span>
                              </div>
                            </div>

                            {/* Role Specific Actions */}
                            {user.role === 'owner' && (
                              <div className="mt-4">
                                <p className="text-xl font-black text-stone-900 uppercase tracking-tight mb-2">
                                  {project.Project_Status === 'Assigned' ? 'CONFIRM NOW' : 'UPDATE NOW'}
                                </p>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setSelectedProject(project); }}
                                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all min-h-[44px]"
                                >
                                  Take Action
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {user.role === 'founder' && project.Project_Status === 'Escalated' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedProject(project); }}
                                className="w-full mt-4 py-4 bg-stone-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-stone-800 transition-all min-h-[44px]"
                              >
                                Set Final Decision
                              </button>
                            )}

                            {user.role === 'sma' && (
                              <div className="mt-4 grid grid-cols-3 gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleQuickAction(project.id!, 'Trigger_Hit', 'Manual Flag'); }}
                                  className="py-3 bg-stone-100 text-stone-600 rounded-xl text-[10px] font-bold uppercase hover:bg-stone-200"
                                >
                                  Flag
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleQuickAction(project.id!, 'Health_Status', 'Red'); }}
                                  className="py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold uppercase hover:bg-red-100"
                                >
                                  Override
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleQuickAction(project.id!, 'MD_Intervention', 'Yes'); }}
                                  className="py-3 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-stone-800"
                                >
                                  MD
                                </button>
                              </div>
                            )}

                            {user.role !== 'owner' && user.role !== 'founder' && user.role !== 'sma' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedProject(project); }}
                                className="w-full mt-4 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all min-h-[44px]"
                              >
                                Update Now
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        user.role === 'founder' && activeTab === 'founder' ? (
                          <div className="col-span-full flex flex-col items-center justify-center py-32 bg-emerald-50 rounded-[3rem] border-2 border-dashed border-emerald-200 text-center px-6">
                            <motion.div 
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-8 shadow-xl shadow-emerald-200"
                            >
                              <CheckCircle2 className="w-12 h-12" />
                            </motion.div>
                            <h2 className="text-4xl font-black text-emerald-900 mb-4 tracking-tight">✅ Nothing requires your attention today.</h2>
                            <p className="text-xl text-emerald-700 font-medium max-w-lg">The system is working. All projects are within healthy thresholds or being handled by the BU Heads.</p>
                            <div className="mt-12 p-4 bg-white/50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Founder-Off Success Signal</span>
                            </div>
                          </div>
                        ) : (
                          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
                            <AlertCircle className="w-12 h-12 text-stone-300 mb-4" />
                            <p className="text-stone-500 font-medium">No projects found.</p>
                            <p className="text-stone-400 text-sm">Active projects will appear here.</p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    /* Table View Implementation */
                    <div className="bg-white rounded-[2.5rem] border border-stone-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-200">
                              <th 
                                className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors"
                                onClick={() => handleSort('Health_Status')}
                              >
                                <div className="flex items-center">Health <SortIcon columnKey="Health_Status" /></div>
                              </th>
                              <th 
                                className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors"
                                onClick={() => handleSort('Priority_Level')}
                              >
                                <div className="flex items-center">Pri <SortIcon columnKey="Priority_Level" /></div>
                              </th>
                              <th 
                                className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors"
                                onClick={() => handleSort('Project_Name')}
                              >
                                <div className="flex items-center">Project Name <SortIcon columnKey="Project_Name" /></div>
                              </th>
                              <th 
                                className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors"
                                onClick={() => handleSort('Business_Unit')}
                              >
                                <div className="flex items-center">BU <SortIcon columnKey="Business_Unit" /></div>
                              </th>
                              <th 
                                className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors"
                                onClick={() => handleSort('Assigned_Leader')}
                              >
                                <div className="flex items-center">Owner <SortIcon columnKey="Assigned_Leader" /></div>
                              </th>
                              <th 
                                className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors"
                                onClick={() => handleSort('Project_Status')}
                              >
                                <div className="flex items-center">Status <SortIcon columnKey="Project_Status" /></div>
                              </th>
                              <th 
                                className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors"
                                onClick={() => handleSort('daysRemaining')}
                              >
                                <div className="flex items-center">Deadline <SortIcon columnKey="daysRemaining" /></div>
                              </th>
                              <th className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {loading ? (
                              Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                  <td colSpan={8} className="px-4 py-4"><div className="h-4 bg-stone-100 rounded w-full"></div></td>
                                </tr>
                              ))
                            ) : filteredProjects.length > 0 ? (
                              filteredProjects.map((project) => (
                                <tr 
                                  key={project.id} 
                                  onClick={() => setSelectedProject(project)}
                                  className="hover:bg-stone-50 transition-colors cursor-pointer group"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full ${
                                        project.Health_Status === 'Green' ? 'bg-emerald-500' :
                                        project.Health_Status === 'Yellow' ? 'bg-amber-500' :
                                        'bg-red-500'
                                      }`} />
                                      <span className="text-[10px] font-bold text-stone-500 uppercase">{project.Health_Status}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                      project.Priority_Level === 'A' ? 'bg-red-100 text-red-600' :
                                      project.Priority_Level === 'B' ? 'bg-orange-100 text-orange-600' :
                                      'bg-stone-100 text-stone-500'
                                    }`}>
                                      {project.Priority_Level}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col max-w-[200px]">
                                      <span className="font-bold text-stone-900 text-xs truncate">{project.Project_Name}</span>
                                      {project.Trigger_Hit && project.Trigger_Hit !== 'None' && (
                                        <span className="text-[9px] font-black text-red-600 uppercase tracking-tight truncate">🔴 {project.Trigger_Hit}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{project.Business_Unit}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-[11px] text-stone-600 truncate max-w-[120px]">
                                      <Users className="w-3 h-3 text-stone-400" />
                                      <span className="truncate">{project.Assigned_Leader}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase whitespace-nowrap ${
                                      project.Project_Status === 'Returned' ? 'bg-orange-100 text-orange-700' :
                                      project.Project_Status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                      'bg-stone-100 text-stone-600'
                                    }`}>
                                      {user.role === 'owner' && project.Project_Status === 'Returned' ? 'Feedback Received' : project.Project_Status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className={`text-[9px] font-bold uppercase whitespace-nowrap ${getDaysLeftInfo(getDaysRemaining(project.Target_End_Date || '')).color}`}>
                                      {getDaysLeftInfo(getDaysRemaining(project.Target_End_Date || '')).text}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {user.role === 'sma' && (
                                        <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleQuickAction(project.id!, 'Trigger_Hit', 'Manual Flag'); }}
                                            className="px-2 py-1 bg-stone-100 text-stone-600 rounded text-[9px] font-bold uppercase hover:bg-stone-200"
                                            title="Flag"
                                          >
                                            Flag
                                          </button>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleQuickAction(project.id!, 'Health_Status', 'Red'); }}
                                            className="px-2 py-1 bg-red-50 text-red-600 rounded text-[9px] font-bold uppercase hover:bg-red-100"
                                            title="Override to Red"
                                          >
                                            Override
                                          </button>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleQuickAction(project.id!, 'MD_Intervention', 'Yes'); }}
                                            className="px-2 py-1 bg-stone-900 text-white rounded text-[9px] font-bold uppercase hover:bg-stone-800"
                                            title="MD Intervention"
                                          >
                                            MD
                                          </button>
                                        </div>
                                      )}
                                      <div className="p-1.5 hover:bg-stone-200 rounded-lg transition-colors">
                                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-900" />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={8} className="px-4 py-20 text-center">
                                  <p className="text-stone-500">No projects found matching your criteria.</p>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

              {activeTab === 'create' && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                    <ProjectForm user={user} onSuccess={() => setActiveTab('projects')} />
                  </div>
                </div>
              )}

              {activeTab === 'review' && (
                <>
                  {selectedProject ? (
                    <div className="max-w-2xl mx-auto">
                      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                        <ReviewForm 
                          project={selectedProject} 
                          user={user}
                          onSuccess={() => setSelectedProject(null)} 
                          onCancel={() => setSelectedProject(null)} 
                        />
                      </div>
                    </div>
                  ) : viewMode === 'card' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="bg-white h-48 rounded-2xl animate-pulse border border-stone-200"></div>
                        ))
                      ) : projects.length > 0 ? (
                        projects.map((project) => (
                          <div 
                            key={project.id} 
                            onClick={() => setSelectedProject(project)}
                            className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                                Awaiting Review
                              </span>
                              <div className="flex flex-col items-end">
                                <span className="text-xs text-stone-400 font-mono">{project.Project_ID}</span>
                                {project.Target_End_Date && (
                                  <span className={`text-[10px] font-bold mt-1 ${
                                    (getDaysRemaining(project.Target_End_Date) || 0) < 0 ? 'text-red-500' : 
                                    (getDaysRemaining(project.Target_End_Date) || 0) < 7 ? 'text-orange-500' : 
                                    'text-stone-400'
                                  }`}>
                                    {getDaysRemaining(project.Target_End_Date)} days left
                                  </span>
                                )}
                              </div>
                            </div>
                            <h3 className="font-bold text-stone-900 mb-2 line-clamp-2 group-hover:text-stone-700 transition-colors">{project.Project_Name}</h3>
                            
                            {project.Phases && (
                              <div className="mb-2">
                                <span className="text-[10px] text-stone-400 uppercase font-bold">Phases</span>
                                <p className="text-xs text-stone-600 line-clamp-1">{project.Phases}</p>
                              </div>
                            )}

                            {project.Next_Steps && (
                              <div className="mb-3">
                                <span className="text-[10px] text-stone-400 uppercase font-bold">Next Steps</span>
                                <p className="text-xs text-stone-600 line-clamp-1 italic">"{project.Next_Steps}"</p>
                              </div>
                            )}

                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center text-[10px] font-bold text-stone-500">
                                  {(project.Assigned_Leader_Name || project.Assigned_Leader || '?').charAt(0)}
                                </div>
                                <span className="text-xs text-stone-600">{project.Assigned_Leader_Name || project.Assigned_Leader}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] text-stone-400 uppercase">Triggers</span>
                                  <span className={`text-xs font-bold ${project.Trigger_Count && project.Trigger_Count > 0 ? 'text-red-500' : 'text-stone-400'}`}>
                                    {project.Trigger_Count || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-stone-50">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-stone-400 uppercase">Submitted</span>
                                <span className="text-xs font-medium text-stone-700">{project.Last_Updated_Date?.toDate ? project.Last_Updated_Date.toDate().toLocaleDateString() : 'Recent'}</span>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-center text-stone-400 opacity-0 group-hover:opacity-100 transition-all">
                              <span className="text-[10px] font-bold uppercase tracking-widest mr-1">Review Now</span>
                              <ChevronRight className="w-3 h-3" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
                          <CheckCircle2 className="w-12 h-12 text-stone-300 mb-4" />
                          <p className="text-stone-500 font-medium">Review queue is empty.</p>
                          <p className="text-stone-400 text-sm">Submitted projects will appear here for verification.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Table View for Review Queue */
                    <div className="bg-white rounded-[2.5rem] border border-stone-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-200">
                              <th className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors" onClick={() => handleSort('Health_Status')}>
                                <div className="flex items-center">Health <SortIcon columnKey="Health_Status" /></div>
                              </th>
                              <th className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors" onClick={() => handleSort('Project_Name')}>
                                <div className="flex items-center">Project Name <SortIcon columnKey="Project_Name" /></div>
                              </th>
                              <th className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors" onClick={() => handleSort('Assigned_Leader')}>
                                <div className="flex items-center">Owner <SortIcon columnKey="Assigned_Leader" /></div>
                              </th>
                              <th className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest cursor-pointer hover:bg-stone-100 transition-colors" onClick={() => handleSort('Last_Updated_Date')}>
                                <div className="flex items-center">Submitted <SortIcon columnKey="Last_Updated_Date" /></div>
                              </th>
                              <th className="px-4 py-4 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {projects.length > 0 ? (
                              projects.map((project) => (
                                <tr key={project.id} onClick={() => setSelectedProject(project)} className="hover:bg-stone-50 transition-colors cursor-pointer group">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full ${project.Health_Status === 'Green' ? 'bg-emerald-500' : project.Health_Status === 'Yellow' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                      <span className="text-[10px] font-bold text-stone-500 uppercase">{project.Health_Status}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-stone-900 text-xs">{project.Project_Name}</span>
                                      <span className="text-[9px] text-stone-400 font-mono">{project.Project_ID}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[11px] text-stone-600">{project.Assigned_Leader}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[10px] font-medium text-stone-500">
                                      {project.Last_Updated_Date?.toDate ? project.Last_Updated_Date.toDate().toLocaleDateString() : 'Recent'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button className="px-3 py-1 bg-stone-900 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-stone-800 transition-colors">
                                      Review
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="px-4 py-20 text-center text-stone-500">Review queue is empty.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
