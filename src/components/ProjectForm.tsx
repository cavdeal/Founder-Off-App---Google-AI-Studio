import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { User, Project, ProjectStatus, PriorityLevel } from '../types';
import { motion } from 'motion/react';
import { Send, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';

interface ProjectFormProps {
  user: User;
  onSuccess: () => void;
}

export default function ProjectForm({ user, onSuccess }: ProjectFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [owners, setOwners] = useState<User[]>([]);
  const [reviewers, setReviewers] = useState<User[]>([]);

  const getNextUpdateDue = (startDate: string) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    Project_Name: '',
    Project_Type: 'Task' as Project['Project_Type'],
    Linked_Objectives: '',
    Time_Horizon: 'Sprint (≤30 days)',
    Priority_Level: 'B' as PriorityLevel,
    Business_Unit: user.business_unit || 'General',
    Success_Definition: '',
    Assigned_Leader: '', 
    Reviewer_Name: '',
    Target_End_Date: '',
    Start_Date: new Date().toISOString().split('T')[0],
    Next_Update_Due: getNextUpdateDue(new Date().toISOString().split('T')[0]),
    Phases: '',
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Fetch Owners in same BU
        const ownersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'owner'),
          where('business_unit', '==', user.business_unit)
        );
        const ownersSnap = await getDocs(ownersQuery);
        const ownersList = ownersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        setOwners(ownersList);

        // Fetch Reviewers
        const reviewersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'reviewer')
        );
        const reviewersSnap = await getDocs(reviewersQuery);
        const reviewersList = reviewersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        setReviewers(reviewersList);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();
  }, [user.business_unit]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setFormData({
      ...formData,
      Start_Date: newStartDate,
      Next_Update_Due: getNextUpdateDue(newStartDate)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.Assigned_Leader || !formData.Reviewer_Name) {
      setError("Please select both an Assigned Leader and a Reviewer.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const quarter = Math.floor((now.getMonth() + 3) / 3);
      const year = now.getFullYear().toString().slice(-2);
      const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const projectID = `OGSM-Q${quarter}-${year}-${sequence}`;

      const owner = owners.find(o => o.uid === formData.Assigned_Leader);
      const reviewer = reviewers.find(r => r.uid === formData.Reviewer_Name);

      const newProject: Omit<Project, 'id'> = {
        ...formData,
        Assigned_Leader_Name: owner?.name || 'Unknown',
        Reviewer_Name_Display: reviewer?.name || 'Unknown',
        GM_Name: user.name,
        Project_ID: projectID,
        Project_Status: 'Assigned',
        Health_Status: 'Green',
        Last_Updated_Date: serverTimestamp(),
        Trigger_Count: 0,
        Repeat_Miss_Count: 0,
        MD_Intervention: 'No',
        Phases: formData.Phases,
      };

      await addDoc(collection(db, 'projects'), newProject);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'projects');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const ownerName = owners.find(o => o.uid === formData.Assigned_Leader)?.name || 'The owner';
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-stone-900">Success</h2>
        <p className="text-stone-500 mt-2">
          Project created. {ownerName} has been notified and must write their restatement within 2 days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-stone-700 mb-1">Project Name</label>
          <input
            type="text"
            required
            value={formData.Project_Name}
            onChange={(e) => setFormData({ ...formData, Project_Name: e.target.value })}
            placeholder="Max 10 words. Clear without explanation."
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Project Type</label>
          <select
            value={formData.Project_Type}
            onChange={(e) => setFormData({ ...formData, Project_Type: e.target.value as any })}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          >
            <option>Task</option>
            <option>Project</option>
            <option>Deliverable</option>
            <option>Approval Item</option>
            <option>Follow-Up Item</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Priority Level</label>
          <select
            value={formData.Priority_Level}
            onChange={(e) => setFormData({ ...formData, Priority_Level: e.target.value as any })}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          >
            <option value="A">A - Must not slip</option>
            <option value="B">B - Standard</option>
            <option value="C">C - Low</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-stone-700 mb-1">Linked Objectives (OGSM)</label>
          <input
            type="text"
            required
            value={formData.Linked_Objectives}
            onChange={(e) => setFormData({ ...formData, Linked_Objectives: e.target.value })}
            placeholder="Which OGSM objective does this support? Be specific."
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-stone-700 mb-1">Success Definition</label>
          <textarea
            required
            value={formData.Success_Definition}
            onChange={(e) => setFormData({ ...formData, Success_Definition: e.target.value })}
            placeholder="One sentence. Specific enough for reviewer to say yes or no objectively."
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none h-24 resize-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-stone-700 mb-1">Phases</label>
          <input
            type="text"
            value={formData.Phases}
            onChange={(e) => setFormData({ ...formData, Phases: e.target.value })}
            placeholder="e.g. Phase 1: Planning, Phase 2: Execution"
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Assigned Leader</label>
          <select
            required
            value={formData.Assigned_Leader}
            onChange={(e) => setFormData({ ...formData, Assigned_Leader: e.target.value })}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          >
            <option value="">Select Owner</option>
            {owners.map(owner => (
              <option key={owner.uid} value={owner.uid}>{owner.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Reviewer Name</label>
          <select
            required
            value={formData.Reviewer_Name}
            onChange={(e) => setFormData({ ...formData, Reviewer_Name: e.target.value })}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          >
            <option value="">Select Reviewer</option>
            {reviewers.map(reviewer => (
              <option key={reviewer.uid} value={reviewer.uid}>{reviewer.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Start Date</label>
          <input
            type="date"
            required
            value={formData.Start_Date}
            onChange={handleStartDateChange}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">First update due by:</label>
          <input
            type="date"
            required
            value={formData.Next_Update_Due}
            onChange={(e) => setFormData({ ...formData, Next_Update_Due: e.target.value })}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Target End Date</label>
          <input
            type="date"
            required
            value={formData.Target_End_Date}
            onChange={(e) => setFormData({ ...formData, Target_End_Date: e.target.value })}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
          />
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-stone-800 text-white rounded-2xl font-bold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Assigning...' : (
            <>
              <Send className="w-5 h-5" />
              Assign Project
            </>
          )}
        </button>
      </div>
    </form>
  );
}
