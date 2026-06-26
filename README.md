# 🩺 MediTrack

<div align="center">

![React Native](https://img.shields.io/badge/React%20Native-Expo-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-green)
![Platform](https://img.shields.io/badge/Platform-Android-success)

### A Personal Health Tracking & Medication Management Application

*MediTrack helps users manage medications, monitor health vitals, maintain medical records, and generate professional health reports—all with an offline-first approach.*

</div>

---

# 📖 Table of Contents

- Overview
- Features
- Screenshots
- Tech Stack
- Architecture
- Folder Structure
- Database Design
- App Workflow
- Installation
- Running the App
- Building APK
- Future Enhancements
- Contributors
- License

---

# 🩺 Overview

MediTrack is a **mobile-first healthcare companion** designed for individuals managing chronic conditions such as:

- Diabetes
- Hypertension
- Cardiac Diseases
- Thyroid Disorders
- Post-Surgery Recovery
- Long-term Medication Plans

The application allows users to:

- Track daily health vitals
- Schedule medications
- Receive medication reminders
- Maintain symptom history
- Store prescriptions
- Generate PDF health reports
- Manage doctor visits
- Access emergency SOS information

> **Note:** MediTrack is **not** a diagnostic or treatment application. It is intended to assist users in maintaining personal health records.

---

# ✨ Features

## 👤 Authentication

- Email Registration
- Secure Login
- Password Visibility Toggle
- Profile Management

---

## ❤️ Health Vitals

Track:

- Blood Pressure
- Blood Sugar
- Heart Rate
- Body Temperature
- Oxygen Saturation (SpO₂)
- Weight

Features:

- Multiple logs per day
- Health status indicators
- History
- Edit/Delete Logs

---

## 💊 Medication Management

- Add Medicines
- Daily Medication Schedule
- Medicine History
- Reminder Notifications
- Adherence Tracking

---

## 🤒 Symptom Diary

- Record Symptoms
- Severity Scale
- Notes
- Edit/Delete Entries
- Timeline View

---

## 📊 Analytics

- Weekly Trends
- Monthly Trends
- Charts
- Health Insights

---

## 👨‍⚕️ Doctor Visit Logs

- Doctor Details
- Visit Notes
- Follow-up Dates

---

## 📁 Prescription Storage

- Image Upload
- PDF Storage
- Local Device Storage

---

## 📄 PDF Reports

Generate professional reports including:

- Patient Details
- Vitals Summary
- Medication Summary
- Symptoms
- Doctor Visits
- Emergency Information

---

## 🚨 Emergency SOS

- Emergency Contact
- Medical Summary
- GPS Location
- One-tap Share

---

## 🌙 Settings

- Dark Mode
- Notifications
- Data Backup
- Restore Data

---

# 📱 Screenshots

> Add screenshots here.

```
assets/screenshots/

dashboard.png
vitals.png
medicines.png
symptoms.png
reports.png
profile.png
```

---

# 🛠 Tech Stack

| Category | Technology |
|-----------|------------|
| Framework | React Native (Expo) |
| Language | TypeScript |
| Navigation | React Navigation |
| State Management | Zustand |
| Database | SQLite |
| Styling | NativeWind |
| Forms | React Hook Form |
| Validation | Zod |
| Notifications | Expo Notifications |
| Charts | Victory Native |
| Storage | Expo FileSystem |
| Image Picker | Expo Image Picker |
| PDF | react-native-html-to-pdf |

---

# 🏗 Architecture

```text
                    ┌────────────────────┐
                    │     User Interface │
                    │  React Native UI   │
                    └─────────┬──────────┘
                              │
                              ▼
                  ┌─────────────────────┐
                  │ React Navigation    │
                  └─────────┬───────────┘
                            │
                            ▼
               ┌─────────────────────────┐
               │ Presentation Layer      │
               │ Screens + Components    │
               └─────────┬───────────────┘
                         │
                         ▼
               ┌─────────────────────────┐
               │ Zustand State Store     │
               └─────────┬───────────────┘
                         │
         ┌───────────────┼────────────────┐
         ▼               ▼                ▼
 ┌──────────────┐ ┌─────────────┐ ┌───────────────┐
 │ Notification │ │ PDF Service │ │ SOS Service   │
 └──────────────┘ └─────────────┘ └───────────────┘
                         │
                         ▼
                ┌───────────────────┐
                │ SQLite Database   │
                └───────────────────┘
```

---

# 🗂 Folder Structure

```text
MediTrack
│
├── assets
│
├── components
│
├── screens
│   ├── Dashboard
│   ├── Vitals
│   ├── Medicines
│   ├── Symptoms
│   ├── Reports
│   ├── Profile
│
├── navigation
│
├── database
│
├── services
│   ├── NotificationService
│   ├── PDFService
│   ├── SOSService
│
├── hooks
│
├── store
│
├── utils
│
├── types
│
└── App.tsx
```

---

# 🗄 Database Design

```
Users
│
├── Medical Profile
│
├── Vitals
│
├── Medications
│
├── Medication Logs
│
├── Symptoms
│
├── Doctor Visits
│
├── Prescriptions
│
├── Reports
│
└── Emergency Contacts
```

---

# 🔄 Application Workflow

```text
Register/Login
      │
      ▼
Dashboard
      │
      ├─────────────┐
      ▼             ▼
Vitals        Medicines
      │             │
      ▼             ▼
Symptoms    Notifications
      │
      ▼
Reports
      │
      ▼
PDF Generation
      │
      ▼
Doctor Consultation
```

---

# 🚀 Installation

Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/MediTrack.git
```

Go inside project

```bash
cd MediTrack
```

Install dependencies

```bash
npm install
```

Start Expo

```bash
npx expo start
```

---

# 📦 Build APK

Configure EAS

```bash
eas build:configure
```

Generate APK

```bash
eas build --platform android --profile preview
```

---

# 🎯 Future Enhancements

- Firebase Authentication
- Cloud Backup
- Doctor Portal
- AI Health Insights
- OCR Prescription Scanner
- Wearable Device Integration
- Multi-language Support
- Family Health Profiles

---





<div align="center">

###  Built with React Native + Expo

**Making healthcare management simpler, smarter, and more accessible.**

</div>
