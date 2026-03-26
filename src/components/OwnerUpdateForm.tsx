import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Project, ProjectStatus } from '../types';
import { motion } from 'motion/react';
import { Save, AlertCircle, CheckCircle2, Upload, HelpCircle, ShieldAlert, Camera } from 'lucide-react';

interface OwnerUpdateFormProps {
  project: Project;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function OwnerUpdateForm({ project, onSuccess, onCancel }: OwnerUpdateFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    'Need_Clarification_?': project['Need_Clarification_?'] || 'No',
    Owner_Restatement: project.Owner_Restatement || '',
    Execution_Facts_Update: project.Execution_Facts_Update || '',
    Next_Steps: project.Next_Steps || '',
    Blocked_Reason: project.Blocked_Reason || 'No Blocker',
    Proof_Link: project.Proof_Link || '',
    Project_Status: project.Project_Status,
  });
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    // Gate Validations
    if (formData.Project_Status === 'Confirmed' && !formData.Owner_Restatement.trim()) {
      setError("Please write your restatement to confirm the project.");
      setLoading(false);
      return;
    }

    if (formData.Project_Status === 'Submitted' && !formData.Proof_Link.trim()) {
      setError("Please upload proof to submit the project.");
      setLoading(false);
      return;
    }

    if (formData.Execution_Facts_Update.length > 0 && formData.Execution_Facts_Update.length < 20) {
      setError("Weekly update must be at least 20 characters.");
      setLoading(false);
      return;
    }

    try {
      const projectRef = doc(db, 'projects', project.id!);
      
      const updates: any = {
        ...formData,
        Last_Updated_Date: serverTimestamp(),
        Next_Steps: formData.Next_Steps,
      };

      // If confirming, set health status to Green
      if (formData.Project_Status === 'Confirmed' && project.Project_Status === 'Assigned') {
        updates.Health_Status = 'Green';
      }

      await updateDoc(projectRef, updates);
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.Project_Status !== project.Project_Status) {
      setShowConfirm(true);
    } else {
      handleSubmit();
    }
  };

  if (success) {
    const isRestatement = project.Project_Status === 'Assigned' && formData.Project_Status === 'Confirmed';
    const isBlocker = formData.Blocked_Reason !== 'No Blocker' && formData.Blocked_Reason !== project.Blocked_Reason;

    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
        <h2 className="text-xl font-bold text-stone-900">
          {isRestatement ? 'Commitment Recorded!' : 'Update Saved!'}
        </h2>
        {isRestatement && (
          <p className="text-stone-500 mt-2 text-sm">
            Great — your commitment has been recorded. {project.GM_Name || 'Your GM'} and your reviewer can now see your plan.
          </p>
        )}
        {isBlocker && (
          <p className="text-emerald-600 mt-2 text-sm font-bold">
            ✓ Blocker logged. Your GM has been notified. This is the right thing to do.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {showConfirm && (
        <div className="p-6 bg-stone-900 text-white rounded-2xl shadow-xl space-y-4">
          <p className="font-bold text-lg">Are you sure?</p>
          <p className="text-stone-400 text-sm">You are changing the project status to {formData.Project_Status}. This action may be irreversible.</p>
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-4 bg-stone-800 hover:bg-stone-700 rounded-xl font-bold transition-all min-h-[44px]"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={() => { setShowConfirm(false); handleSubmit(); }}
              className="flex-1 py-4 bg-white text-stone-900 hover:bg-stone-100 rounded-xl font-bold transition-all min-h-[44px]"
            >
              Yes, Confirm
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Confirmation Gate */}
      {project.Project_Status === 'Assigned' && (
        <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
          <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-stone-800" />
            Project Confirmation
          </h3>

          <div className="mb-6 p-4 bg-emerald-900 text-white rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-xl" />
            <h4 className="text-[10px] uppercase font-black tracking-widest text-emerald-400 mb-1">
              What success looks like:
            </h4>
            <p className="text-sm font-bold leading-tight">
              {project.Success_Definition}
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Do you have a question before you start?
              </label>
              <select
                value={formData['Need_Clarification_?']}
                onChange={(e) => setFormData({ ...formData, 'Need_Clarification_?': e.target.value as any })}
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl outline-none"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Write in your own words what you will deliver and when.
              </label>
              <textarea
                required={formData.Project_Status === 'Confirmed'}
                value={formData.Owner_Restatement}
                onChange={(e) => setFormData({ ...formData, Owner_Restatement: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl outline-none h-24 resize-none focus:ring-2 focus:ring-stone-800 transition-all"
                placeholder="Ex: I will deliver [output] by [date]."
              />
              <p className="mt-1 text-[10px] text-stone-500 font-medium italic">
                Write this in your own words. Don't copy the success definition above. Example: "I will deliver the signed client list by March 31."
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, Project_Status: 'Confirmed' })}
              className={`w-full py-4 rounded-xl font-bold transition-all min-h-[44px] ${
                formData.Project_Status === 'Confirmed' 
                ? 'bg-green-600 text-white' 
                : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
              }`}
            >
              {formData.Project_Status === 'Confirmed' ? 'Ready to Confirm' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Execution Updates */}
      {project.Project_Status !== 'Assigned' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Is something blocking the work? Choose the reason.
            </label>
            <select
              value={formData.Blocked_Reason}
              onChange={(e) => setFormData({ ...formData, Blocked_Reason: e.target.value as any })}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none"
            >
              <option value="No Blocker">No Blocker</option>
              <option value="Waiting on Decision">Waiting on Decision</option>
              <option value="Waiting on Another Team">Waiting on Another Team</option>
              <option value="Waiting on Supplier">Waiting on Supplier</option>
              <option value="Waiting on Budget">Waiting on Budget</option>
              <option value="Waiting on Owner Action">Waiting on Owner Action</option>
              <option value="Issue Encountered">Issue Encountered</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Weekly Update
            </label>
            <textarea
              value={formData.Execution_Facts_Update}
              onChange={(e) => setFormData({ ...formData, Execution_Facts_Update: e.target.value })}
              placeholder="Write what happened this week — specific facts only."
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none h-32 resize-none focus:ring-2 focus:ring-stone-800 transition-all"
            />
            <div className="flex justify-between items-center mt-1">
              <p className={`text-[10px] font-bold ${formData.Execution_Facts_Update.length < 20 ? 'text-red-500' : 'text-emerald-600'}`}>
                {formData.Execution_Facts_Update.length}/20 — {formData.Execution_Facts_Update.length < 20 
                  ? `kailangan pa ng ${20 - formData.Execution_Facts_Update.length} character (need ${20 - formData.Execution_Facts_Update.length} more characters)` 
                  : 'Sapat na ang detalye (Minimum met)'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Next Steps
            </label>
            <textarea
              value={formData.Next_Steps}
              onChange={(e) => setFormData({ ...formData, Next_Steps: e.target.value })}
              placeholder="What are the next steps?"
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none h-24 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Proof of Work
            </label>
            {formData.Proof_Link ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-emerald-900">May patunay na naka-upload</p>
                    <a href={formData.Proof_Link} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 underline truncate block max-w-[150px]">
                      {formData.Proof_Link}
                    </a>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, Proof_Link: '' })}
                  className="text-[10px] font-bold uppercase text-stone-500 hover:text-red-500 transition-colors"
                >
                  Palitan (Replace)
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => {
                  // Mock file picker/camera
                  const mockUrl = `https://proof.lotus.com/upload-${Date.now()}.jpg`;
                  setFormData({ ...formData, Proof_Link: mockUrl });
                }}
                className="w-full py-6 border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-stone-50 transition-all group"
              >
                <div className="p-3 bg-stone-100 text-stone-400 rounded-full group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-stone-500">I-upload ang patunay 📎</span>
                <span className="text-[10px] text-stone-400">Camera o File Picker</span>
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Update Status</label>
            <select
              value={formData.Project_Status}
              onChange={(e) => setFormData({ ...formData, Project_Status: e.target.value as ProjectStatus })}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none"
            >
              <option value="Confirmed">Confirmed</option>
              <option value="In Progress">In Progress</option>
              <option value="Submitted">Submitted</option>
              <option value="Hold">Hold</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      )}

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
          className="flex-1 py-4 bg-stone-800 text-white rounded-xl font-bold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
        >
          {loading ? 'Saving...' : (
            <>
              <Save className="w-5 h-5" />
              Submit
            </>
          )}
        </button>
      </div>
    </form>
  );
}
