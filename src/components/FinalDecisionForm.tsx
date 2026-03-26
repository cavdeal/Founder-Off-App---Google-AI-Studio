import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { Project } from '../types';
import { CheckCircle2, AlertCircle, Save } from 'lucide-react';

interface FinalDecisionFormProps {
  project: Project;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function FinalDecisionForm({ project, onSuccess, onCancel }: FinalDecisionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    Final_Decision_By_Reviewer: project.Final_Decision_By_Reviewer || 'Approved',
    MD_Notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const projectRef = doc(db, 'projects', project.id!);
      
      // Update project
      await updateDoc(projectRef, {
        Final_Decision_By_Reviewer: formData.Final_Decision_By_Reviewer,
        Project_Status: formData.Final_Decision_By_Reviewer === 'Approved' ? 'Closed' : 
                        formData.Final_Decision_By_Reviewer === 'Rejected' ? 'Cancelled' : 
                        formData.Final_Decision_By_Reviewer === 'Escalated' ? 'Escalated' : 'Closed',
        Last_Updated_Date: serverTimestamp(),
      });

      // Add to history
      await addDoc(collection(db, 'history'), {
        projectId: project.id,
        userId: auth.currentUser?.uid,
        userName: auth.currentUser?.displayName || 'MD',
        action: `MD Set Final Decision: ${formData.Final_Decision_By_Reviewer}`,
        notes: formData.MD_Notes,
        timestamp: serverTimestamp(),
        changes: {
          Final_Decision_By_Reviewer: { old: project.Final_Decision_By_Reviewer || 'None', new: formData.Final_Decision_By_Reviewer }
        }
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
        <h2 className="text-xl font-bold text-stone-900">Decision Recorded</h2>
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

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Final Decision</label>
        <select
          value={formData.Final_Decision_By_Reviewer}
          onChange={(e) => setFormData({ ...formData, Final_Decision_By_Reviewer: e.target.value as any })}
          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-stone-800"
        >
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Escalated">Escalated</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">MD Notes (Optional)</label>
        <textarea
          value={formData.MD_Notes}
          onChange={(e) => setFormData({ ...formData, MD_Notes: e.target.value })}
          placeholder="Add any final instructions or feedback..."
          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none h-24 resize-none focus:ring-2 focus:ring-stone-800"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 bg-white border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-4 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
        >
          {loading ? 'Saving...' : (
            <>
              <Save className="w-5 h-5" />
              Record Decision
            </>
          )}
        </button>
      </div>
    </form>
  );
}
