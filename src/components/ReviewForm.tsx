import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Project, ProjectStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertTriangle, Save, AlertCircle, ExternalLink, ShieldAlert } from 'lucide-react';

interface ReviewFormProps {
  project: Project;
  user: { name: string; role: string };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ReviewForm({ project, user, onSuccess, onCancel }: ReviewFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    'Complete_With_Proof?': '' as 'Yes' | 'No' | 'N/A' | '',
    'On_Time?': '' as 'Yes' | 'No' | 'N/A' | '',
    'Okay_Quality?': '' as 'Yes' | 'No' | 'N/A' | '',
    GM_Consult_Required: 'No' as 'Yes' | 'No',
    Reviewer_Decision: 'Approve' as 'Approve' | 'Return' | 'Escalate',
    Return_Reason: '',
    Escalation_Reason: '',
    Trigger_Hit: project.Trigger_Hit || 'None',
    MD_Intervention: project.MD_Intervention || 'No',
    Trigger_Count: project.Trigger_Count || 0,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRubricSelect = (field: string, val: 'Yes' | 'No' | 'N/A') => {
    setFormData(prev => ({ ...prev, [field]: val }));
    
    if (field === 'Complete_With_Proof?') {
      if (val === 'No') {
        setFormData(prev => ({ ...prev, Reviewer_Decision: 'Return' }));
        setCurrentStep(4); // Skip to decision
      } else {
        setCurrentStep(2);
      }
    } else if (field === 'On_Time?') {
      setCurrentStep(3);
    } else if (field === 'Okay_Quality?') {
      setCurrentStep(4);
    }
  };

  const prevStep = () => {
    if (currentStep === 4 && formData['Complete_With_Proof?'] === 'No') {
      setCurrentStep(1);
    } else {
      setCurrentStep(prev => Math.max(prev - 1, 1));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (formData.Reviewer_Decision === 'Return' && !formData.Return_Reason) {
      setError("Please specify a reason for returning the project.");
      setLoading(false);
      return;
    }
    if (formData.Reviewer_Decision === 'Escalate' && !formData.Escalation_Reason) {
      setError("Please specify a reason for escalating the project.");
      setLoading(false);
      return;
    }

    try {
      const projectRef = doc(db, 'projects', project.id!);
      
      let newStatus: ProjectStatus = project.Project_Status;
      let healthStatus = project.Health_Status;

      if (formData.Reviewer_Decision === 'Approve') {
        newStatus = 'Approved';
        healthStatus = 'Green';
      } else if (formData.Reviewer_Decision === 'Return') {
        newStatus = 'Returned';
        healthStatus = 'Yellow';
      } else if (formData.Reviewer_Decision === 'Escalate') {
        newStatus = 'Escalated';
        healthStatus = 'Red';
      }

      let triggerCount = formData.Trigger_Count;
      if (formData.Trigger_Hit !== 'None' && formData.Trigger_Hit !== project.Trigger_Hit) {
        triggerCount += 1;
      }

      const updates: any = {
        ...formData,
        Trigger_Count: triggerCount,
        Project_Status: newStatus,
        Health_Status: healthStatus,
        Verified_By: user.name,
        Verified_Date: new Date().toISOString().split('T')[0],
        Last_Updated_Date: serverTimestamp(),
      };

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
    
    // Check if current step is answered before proceeding
    if (currentStep === 1 && !formData['Complete_With_Proof?']) return;
    if (currentStep === 2 && !formData['On_Time?']) return;
    if (currentStep === 3 && !formData['Okay_Quality?']) return;

    if (currentStep < 4) {
      if (currentStep === 1 && formData['Complete_With_Proof?'] === 'No') {
        setCurrentStep(4);
      } else {
        setCurrentStep(currentStep + 1);
      }
    } else {
      setShowConfirm(true);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
        <h2 className="text-xl font-bold text-stone-900">Review Submitted!</h2>
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
          <p className="text-stone-400 text-sm">You are about to {formData.Reviewer_Decision.toLowerCase()} this project. This action may be irreversible.</p>
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

      <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 mb-6">
        <h3 className="font-bold text-stone-900 mb-4">Project Submission Details</h3>
        <div className="space-y-4 text-sm">
          {project.Proof_Link && (
            <a 
              href={project.Proof_Link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-4 bg-stone-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg group"
            >
              View Submitted Proof <ExternalLink className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-[10px] uppercase text-stone-400 font-bold block mb-1">Project Name</span>
              <p className="font-medium text-stone-800">{project.Project_Name}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-stone-400 font-bold block mb-1">Success Definition</span>
              <p className="font-medium text-stone-800">{project.Success_Definition}</p>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-stone-400 font-bold block mb-1">Execution Facts</span>
            <p className="font-medium text-stone-800 bg-white p-3 rounded-xl border border-stone-100">{project.Execution_Facts_Update}</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Step {currentStep} of 4</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`w-8 h-1 rounded-full ${s <= currentStep ? 'bg-stone-800' : 'bg-stone-200'}`} />
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-stone-900">Step 1: Proof Check</h3>
              <p className="text-sm text-stone-500">Is the proof complete and attached?</p>
              <div className="grid grid-cols-3 gap-3">
                {['Yes', 'No', 'N/A'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleRubricSelect('Complete_With_Proof?', val as any)}
                    className={`py-4 rounded-2xl border-2 font-bold transition-all ${
                      formData['Complete_With_Proof?'] === val 
                      ? 'bg-stone-900 border-stone-900 text-white shadow-lg' 
                      : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-stone-900">Step 2: Timeliness</h3>
              <p className="text-sm text-stone-500">Was this submitted on time?</p>
              <div className="grid grid-cols-3 gap-3">
                {['Yes', 'No', 'N/A'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleRubricSelect('On_Time?', val as any)}
                    className={`py-4 rounded-2xl border-2 font-bold transition-all ${
                      formData['On_Time?'] === val 
                      ? 'bg-stone-900 border-stone-900 text-white shadow-lg' 
                      : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-stone-900">Step 3: Quality Check</h3>
              <p className="text-sm text-stone-500">Is the quality acceptable?</p>
              <div className="grid grid-cols-3 gap-3">
                {['Yes', 'No', 'N/A'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleRubricSelect('Okay_Quality?', val as any)}
                    className={`py-4 rounded-2xl border-2 font-bold transition-all ${
                      formData['Okay_Quality?'] === val 
                      ? 'bg-stone-900 border-stone-900 text-white shadow-lg' 
                      : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-stone-900">Final Decision</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled={formData['Complete_With_Proof?'] === 'No'}
                    onClick={() => setFormData({ ...formData, Reviewer_Decision: 'Approve' })}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                      formData.Reviewer_Decision === 'Approve' 
                      ? 'bg-green-50 border-green-500 text-green-700' 
                      : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                    } ${formData['Complete_With_Proof?'] === 'No' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <CheckCircle2 className="w-6 h-6 mb-1" />
                    <span className="text-xs font-bold">Approve</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, Reviewer_Decision: 'Return' })}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                      formData.Reviewer_Decision === 'Return' 
                      ? 'bg-yellow-50 border-yellow-500 text-yellow-700' 
                      : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                    }`}
                  >
                    <AlertTriangle className="w-6 h-6 mb-1" />
                    <span className="text-xs font-bold">Return</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, Reviewer_Decision: 'Escalate' })}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                      formData.Reviewer_Decision === 'Escalate' 
                      ? 'bg-red-50 border-red-500 text-red-700' 
                      : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                    }`}
                  >
                    <XCircle className="w-6 h-6 mb-1" />
                    <span className="text-xs font-bold">Escalate</span>
                  </button>
                </div>

                {formData.Reviewer_Decision === 'Return' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Return Reason</label>
                    <select
                      value={formData.Return_Reason}
                      onChange={(e) => setFormData({ ...formData, Return_Reason: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none"
                      required
                    >
                      <option value="">Select a reason...</option>
                      <option value="Incomplete">Incomplete</option>
                      <option value="Unclear">Unclear</option>
                      <option value="Below Standard">Below Standard</option>
                      <option value="Missing Proof">Missing Proof</option>
                      <option value="Wrong Format">Wrong Format</option>
                      <option value="Late">Late</option>
                      <option value="Needs Revision">Needs Revision</option>
                    </select>
                  </motion.div>
                )}

                {formData.Reviewer_Decision === 'Escalate' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Escalation Reason</label>
                    <textarea
                      value={formData.Escalation_Reason}
                      onChange={(e) => setFormData({ ...formData, Escalation_Reason: e.target.value })}
                      placeholder="Why is this being escalated to higher management?"
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none h-24 resize-none"
                      required
                    />
                  </motion.div>
                )}

                {(user.role === 'sma' || user.role === 'admin') && (
                  <div className="pt-6 mt-6 border-t border-stone-100 space-y-4">
                    <h3 className="font-bold text-stone-900 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-red-600" />
                      SMA / Admin Overrides
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Trigger Hit</label>
                        <select
                          value={formData.Trigger_Hit}
                          onChange={(e) => setFormData({ ...formData, Trigger_Hit: e.target.value })}
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none"
                        >
                          <option value="None">None</option>
                          <option value="Missed Update Deadline">Missed Update Deadline</option>
                          <option value="Missed Due Date">Missed Due Date</option>
                          <option value="No Proof Submitted">No Proof Submitted</option>
                          <option value="Incomplete Submission">Incomplete Submission</option>
                          <option value="Below Quality Standard">Below Quality Standard</option>
                          <option value="Repeated Pattern / Chronic Miss">Repeated Pattern / Chronic Miss</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">MD Intervention Required?</label>
                        <select
                          value={formData.MD_Intervention}
                          onChange={(e) => setFormData({ ...formData, MD_Intervention: e.target.value as 'Yes' | 'No' })}
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none"
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3 pt-4">
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={prevStep}
            className="flex-1 py-4 bg-white border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all min-h-[44px]"
          >
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 bg-white border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all min-h-[44px]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading || (currentStep < 4 && !formData['Complete_With_Proof?'])}
          className="flex-1 py-4 bg-stone-800 text-white rounded-xl font-bold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
        >
          {loading ? 'Submitting...' : (
            <>
              {currentStep < 4 ? 'Next' : (
                <>
                  <Save className="w-5 h-5" />
                  {formData.Reviewer_Decision === 'Approve' ? 'Approve' : formData.Reviewer_Decision === 'Return' ? 'Return' : 'Escalate'}
                </>
              )}
            </>
          )}
        </button>
      </div>
    </form>

  );
}
