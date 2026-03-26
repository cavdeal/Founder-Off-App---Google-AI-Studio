export type UserRole = 'founder' | 'gm' | 'bu_head' | 'owner' | 'reviewer' | 'sma' | 'admin';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  business_unit?: string;
}

export type ProjectStatus = 
  | 'New' | 'Assigned' | 'Confirmed' | 'In Progress' | 'Submitted' | 'Returned' 
  | 'Approved' | 'Escalated' | 'Closed' | 'Cancelled' | 'For Review' | 'Building' 
  | 'For Scheduling' | 'Hold' | 'Done - Implemented' | 'Accomplished';

export type PriorityLevel = 'A' | 'B' | 'C';
export type HealthStatus = 'Green' | 'Yellow' | 'Red';

export interface Project {
  id?: string;
  Project_ID: string;
  Project_Type: 'Task' | 'Project' | 'Deliverable' | 'Approval Item' | 'Follow-Up Item';
  Linked_Objectives: string;
  Time_Horizon: string;
  Priority_Level: PriorityLevel;
  Business_Unit: string;
  Project_Name: string;
  Success_Definition: string;
  Assigned_Leader: string; // User UID
  Assigned_Leader_Name: string;
  Reviewer_Name: string; // User UID
  Reviewer_Name_Display: string;
  GM_Name?: string;
  Start_Date: string;
  Target_End_Date: string;
  
  // Zone B
  'Need_Clarification_?'?: 'Yes' | 'No';
  Owner_Restatement?: string;
  Days_To_Deadline?: number;
  Project_Status: ProjectStatus;
  Blocked_Reason?: string;
  Execution_Facts_Update?: string;
  Next_Update_Due?: string;
  Last_Updated_Date?: any;
  Health_Status?: HealthStatus;
  Health_Status_Reason?: string;
  Completed_Date?: string;
  Proof_Link?: string;
  Weeks_In_Use?: number;

  // Zone C
  'Complete_With_Proof?'?: 'Yes' | 'No' | 'N/A';
  'On_Time?'?: 'Yes' | 'No' | 'N/A';
  'Okay_Quality?'?: 'Yes' | 'No' | 'N/A';
  GM_Consult_Required?: 'Yes' | 'No';
  Reviewer_Decision?: 'Approve' | 'Return' | 'Escalate';
  Return_Reason?: string;
  Escalation_Reason?: string;
  Verified_By?: string;
  Verified_Date?: string;
  Final_Decision_By_Reviewer?: string;

  // Zone D
  Trigger_Hit?: string;
  Trigger_Severity?: string;
  Trigger_Consequence_Level?: string;
  Trigger_Count?: number;
  MD_Intervention?: 'Yes' | 'No';
  Repeat_Miss_Count?: number;
  Phases?: string;
  Next_Steps?: string;
  Auto_Trigger_Hit_Suggested?: string;
  Trigger_Auto_Action?: string;
  Root_Cause_Type?: string;
  Redesign_Required?: 'Yes' | 'No';
}

export interface HistoryEntry {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: any;
  changes?: Record<string, { old: any; new: any }>;
}
