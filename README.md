# Project Maintenance and Deployment Guide

This guide explains how to manage, fix, and deploy the application in plain English.

## Section 1: What each file does
- **src/App.tsx**: The main entry point for the website's visual interface.
- **src/components/**: Contains the individual parts of the website, like the dashboard and forms.
- **src/types.ts**: Defines the structure of data used throughout the app, including dropdown options.
- **src/firebase.ts**: Connects the website to the Firebase database and login system.
- **functions/index.js**: The brain of the app that handles automated tasks like emails and triggers.
- **firestore.rules**: The security guard that decides who can see or change data in the database.
- **firebase.json**: The instruction manual for how to put the app online.
- **.github/workflows/deploy.yml**: Automatically updates the live site whenever you save changes to GitHub.

## Section 2: How to deploy for the first time
1. **Install Firebase Tools**: Open your terminal and run `npm install -g firebase-tools`.
2. **Log In**: Run `firebase login` and follow the instructions in your browser.
3. **Initialize**: Run `firebase init` and select Hosting and Functions.
4. **Build the App**: Run `npm run build` to prepare the website files.
5. **Set Secrets**: Run `firebase functions:config:set email.user="your-email@gmail.com" email.pass="your-app-password"`.
6. **Deploy**: Run `firebase deploy` to put everything live.

## Section 3: How to fix the 5 most common breaks
- **Break 1: Wrong data in a record** → Go to the Firebase Console → Firestore → Find the project by its `Project_ID` → Click the field and edit it directly.
- **Break 2: Trigger engine not firing** → Go to the Firebase Console → Functions → Logs → Search for "runTriggerEngine" → Copy any error message and paste it to the AI → Fix the code in `functions/index.js` → Run `firebase deploy --only functions`.
- **Break 3: User can't log in or sees wrong view** → Go to the Firebase Console → Authentication → Find the user's email → Go to Firestore → `users` collection → Check that the `role` and `business_unit` fields match what they should be.
- **Break 4: Emails stopped sending** → Go to the Firebase Console → Functions → Logs → Search for "sendEmail" → Check if your Gmail credentials have expired → Update them by running: `firebase functions:config:set email.user="x" email.pass="y"`.
- **Break 5: Sheets not updating** → Go to the Firebase Console → Functions → `mirrorProjectsToGoogleSheets` → Logs → Confirm that the Service Account email has "Editor" access to your Google Sheet.

## Section 4: How to add a new user
1. **Create in Auth**: Go to Firebase Console → Authentication → Add User → Enter their email and a temporary password.
2. **Create in Firestore**: Go to Firestore → `users` collection → Add Document → Use their new `uid` as the Document ID.
3. **Fill Details**: Add fields for `name`, `email`, `role`, and `business_unit`. The user can now log in.

## Section 5: How to change a dropdown value
1. **Update Code**: Open the `src/types.ts` file and change the values in the list.
2. **Deploy**: Run `npm run build` then `firebase deploy --only hosting` to update the live website.
