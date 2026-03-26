const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

admin.initializeApp();
const db = admin.firestore();

// Helper to get user email by UID or Name
async function getUserEmail(identifier) {
  if (!identifier) return null;
  // Try to find by UID first
  let userDoc = await db.collection("users").doc(identifier).get();
  if (userDoc.exists) return userDoc.data().email;

  // Try to find by Name
  const userQuery = await db.collection("users").where("name", "==", identifier).limit(1).get();
  if (!userQuery.empty) return userQuery.docs[0].data().email;

  return null;
}

// Helper to get GM emails for a business unit
async function getGMEmails(businessUnit) {
  const gmQuery = await db.collection("users")
    .where("role", "==", "gm")
    .where("business_unit", "==", businessUnit)
    .get();
  return gmQuery.docs.map(doc => doc.data().email).filter(e => e);
}

// Helper to get Founder emails
async function getFounderEmails() {
  const founderQuery = await db.collection("users")
    .where("role", "==", "founder")
    .get();
  return founderQuery.docs.map(doc => doc.data().email).filter(e => e);
}

// Helper to send email
async function sendEmail(to, subject, text) {
  if (!to || (Array.isArray(to) && to.length === 0)) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"OGSM App" <${process.env.EMAIL_USER}>`,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

/**
 * FUNCTION 1: runTriggerEngine()
 * Scheduled: every day at 7:00 AM Philippine time
 */
exports.runTriggerEngine = functions.pubsub
  .schedule("0 7 * * *")
  .timeZone("Asia/Manila")
  .onRun(async (context) => {
    const projectsSnapshot = await db.collection("projects")
      .where("Project_Status", "not-in", ["Closed", "Cancelled", "Accomplished"])
      .get();

    const now = new Date();
    const batch = db.batch();
    let updatedCount = 0;

    projectsSnapshot.forEach((doc) => {
      const data = doc.data();
      let triggerHit = "None";
      let severity = "Low";
      let level = "Level 0 — No Consequence";
      let healthStatus = data.Health_Status || "Green";
      let hit = false;

      const lastUpdated = data.Last_Updated_Date ? data.Last_Updated_Date.toDate() : new Date(0);
      const startDate = data.Start_Date ? new Date(data.Start_Date) : new Date(0);
      const nextUpdateDue = data.Next_Update_Due ? new Date(data.Next_Update_Due) : null;
      
      const daysSinceLastUpdate = (now - lastUpdated) / (1000 * 60 * 60 * 24);
      const daysSinceStart = (now - startDate) / (1000 * 60 * 60 * 24);

      // Trigger Logic (Most severe first)
      if (data.Repeat_Miss_Count >= 3) {
        triggerHit = "Repeated Pattern / Chronic Miss";
        severity = "Critical";
        level = "Level 5 — Performance / Role Review";
        hit = true;
      } else if (data.Days_To_Deadline < 0 && !["Submitted", "Approved", "Closed"].includes(data.Project_Status)) {
        triggerHit = "Missed Due Date";
        severity = "High";
        level = "Level 2 — Return and Resubmit";
        hit = true;
      } else if (data.Project_Status === "Returned" && daysSinceLastUpdate > 3) {
        triggerHit = "Not Resubmitted On Time";
        severity = "High";
        level = "Level 3 — Escalate to SMA";
        hit = true;
      } else if (data.Project_Status === "Submitted" && (!data.Proof_Link || data.Proof_Link === "")) {
        triggerHit = "No Proof Submitted";
        severity = "Medium";
        level = "Level 2 — Return and Resubmit";
        hit = true;
      } else if (nextUpdateDue && lastUpdated < nextUpdateDue && data.Project_Status !== "Closed" && now > nextUpdateDue) {
        triggerHit = "Missed Update Deadline";
        healthStatus = "Red";
        severity = "Medium";
        level = "Level 1 — Reminder / Correction";
        hit = true;
      } else if (data.Project_Status === "Assigned" && (!data.Owner_Restatement || data.Owner_Restatement === "") && daysSinceStart > 2) {
        triggerHit = "No Confirmation Submitted";
        severity = "Low";
        level = "Level 1 — Reminder / Correction";
        hit = true;
      }

      if (hit) {
        batch.update(doc.ref, {
          Trigger_Hit: triggerHit,
          Trigger_Severity: severity,
          Trigger_Consequence_Level: level,
          Health_Status: healthStatus,
          Trigger_Count: (data.Trigger_Count || 0) + 1,
          Last_Updated_Date: admin.firestore.FieldValue.serverTimestamp(),
        });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
    }
    console.log(`Trigger engine finished. Updated ${updatedCount} projects.`);
    return null;
  });

/**
 * FUNCTION 2: sendEmailOnProjectChange()
 * Firestore onWrite trigger on the projects collection
 */
exports.sendEmailOnProjectChange = functions.firestore
  .document("projects/{projectId}")
  .onWrite(async (change, context) => {
    const newData = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;

    if (!newData) return null; // Deletion

    const newStatus = newData.Project_Status;
    const oldStatus = oldData ? oldData.Project_Status : null;

    if (newStatus === oldStatus) return null; // Status didn't change

    const leaderEmail = await getUserEmail(newData.Assigned_Leader);
    const reviewerEmail = await getUserEmail(newData.Verified_By);
    const gmEmails = await getGMEmails(newData.Business_Unit);
    const founderEmails = await getFounderEmails();

    if (newStatus === "Assigned") {
      await sendEmail(
        leaderEmail,
        `New project assigned: ${newData.Project_Name}`,
        `New project assigned to you: ${newData.Project_Name}. Due: ${newData.Target_End_Date}. Write your restatement to confirm.`
      );
    } else if (newStatus === "Submitted") {
      await sendEmail(
        reviewerEmail,
        `Review needed: ${newData.Project_Name}`,
        `${newData.Project_Name} needs your review. You have 48 hours.`
      );
    } else if (newStatus === "Returned") {
      await sendEmail(
        leaderEmail,
        `Project returned: ${newData.Project_Name}`,
        `Your submission was returned. Reason: ${newData.Return_Reason || "No reason provided"}. Please revise and resubmit.`
      );
    } else if (newStatus === "Approved") {
      const recipients = [leaderEmail, ...gmEmails].filter(e => e);
      await sendEmail(
        recipients,
        `Project approved: ${newData.Project_Name}`,
        `${newData.Project_Name} has been approved.`
      );
    } else if (newStatus === "Escalated") {
      const recipients = [...gmEmails, ...founderEmails].filter(e => e);
      await sendEmail(
        recipients,
        `Project escalated: ${newData.Project_Name}`,
        `${newData.Project_Name} has been escalated. Reason: ${newData.Escalation_Reason || "No reason provided"}.`
      );
    }

    return null;
  });

/**
 * FUNCTION 3: mirrorProjectsToGoogleSheets()
 * Scheduled: every day at 6:00 AM Philippine time
 */
exports.mirrorProjectsToGoogleSheets = functions.pubsub
  .schedule("0 6 * * *")
  .timeZone("Asia/Manila")
  .onRun(async (context) => {
    const projectsSnapshot = await db.collection("projects").get();
    const projects = projectsSnapshot.docs.map(doc => doc.data());

    const sheetsId = process.env.SHEETS_ID;
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const columns = [
      "Project_ID", "Project_Type", "Linked_Objectives", "Time_Horizon", "Priority_Level", 
      "Business_Unit", "Project_Name", "Success_Definition", "Assigned_Leader", "Start_Date", 
      "Target_End_Date", "Need_Clarification_?", "Owner_Restatement", "Days_To_Deadline", 
      "Project_Status", "Blocked_Reason", "Execution_Facts_Update", "Next_Update_Due", 
      "Last_Updated_Date", "Health_Status", "Health_Status_Reason", "Completed_Date", 
      "Proof_Link", "Weeks_In_Use", "Complete_With_Proof?", "On_Time?", "Okay_Quality?", 
      "GM_Consult_Required", "Reviewer_Decision", "Return_Reason", "Escalation_Reason", 
      "Verified_By", "Verified_Date", "Final_Decision_By_Reviewer", "Auto_Trigger_Hit_Suggested", 
      "Trigger_Hit", "Trigger_Severity", "Trigger_Auto_Action", "Trigger_Consequence_Level", 
      "Trigger_Count", "Root_Cause_Type", "MD_Intervention", "Redesign_Required", "Repeat_Miss_Count"
    ];

    const rows = [columns];
    projects.forEach(p => {
      const row = columns.map(col => {
        let val = p[col];
        if (val && val.toDate) val = val.toDate().toISOString();
        return val === undefined ? "" : val;
      });
      rows.push(row);
    });

    try {
      // Clear sheet first
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetsId,
        range: "Sheet1!A1:ZZ",
      });

      // Write new data
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetsId,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        resource: { values: rows },
      });
      console.log("Google Sheets mirror finished.");
    } catch (error) {
      console.error("Error mirroring to Google Sheets:", error);
    }

    return null;
  });
