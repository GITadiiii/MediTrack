import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface ReportData {
  patientName: string;
  age: number;
  gender: string;
  bloodGroup: string;
  dob: string;
  height: number;
  weight: number;
  conditions: string[];
  allergies: string[];
  medications: string[];
  emergencyContact: { name: string; relation: string; phone: string } | null;
  adherencePercentage: number;
  medicationList: Array<{
    name: string;
    dosage: string;
    unit: string;
    instructions: string;
    frequencyType: string;
    stock: number;
  }>;
  vitalsLogs: Array<{
    systolic?: number;
    diastolic?: number;
    blood_sugar_fasting?: number;
    blood_sugar_post_meal?: number;
    temperature?: number;
    weight?: number;
    spo2?: number;
    heart_rate?: number;
    timestamp: string;
  }>;
  symptomLogs: Array<{
    name: string;
    severity: number;
    notes?: string;
    timestamp: string;
  }>;
  doctorVisits: Array<{
    visit_date: string;
    doctor_name: string;
    specialization: string;
    notes?: string;
    prescription_summary?: string;
    follow_up_date?: string;
  }>;
}

export const generateAndShareReport = async (data: ReportData, dateRangeLabel: string): Promise<boolean> => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>MediTrack Health Summary Report</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1E293B;
            margin: 0;
            padding: 40px;
            font-size: 13px;
            line-height: 1.5;
            background-color: #FFFFFF;
          }
          .header {
            border-bottom: 2px solid #2563EB;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header-title h1 {
            color: #2563EB;
            font-size: 28px;
            margin: 0 0 5px 0;
            font-weight: 700;
          }
          .header-title p {
            color: #64748B;
            margin: 0;
            font-size: 14px;
          }
          .header-meta {
            text-align: right;
            font-size: 12px;
            color: #64748B;
          }
          .section-title {
            color: #1E3A8A;
            border-bottom: 1px solid #E2E8F0;
            padding-bottom: 5px;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 700;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .card {
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
          }
          .card-title {
            font-weight: 700;
            color: #2563EB;
            margin-bottom: 10px;
            font-size: 13px;
            text-transform: uppercase;
          }
          .profile-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            border-bottom: 1px dashed #E2E8F0;
            padding-bottom: 4px;
          }
          .profile-label {
            color: #64748B;
            font-weight: 600;
          }
          .profile-value {
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 20px;
          }
          th {
            background-color: #2563EB;
            color: #FFFFFF;
            font-weight: 600;
            text-align: left;
            padding: 8px 10px;
            font-size: 12px;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #E2E8F0;
            font-size: 12px;
          }
          tr:nth-child(even) {
            background-color: #F8FAFC;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 11px;
            text-align: center;
          }
          .badge-blue { background-color: #DBEAFE; color: #2563EB; }
          .badge-green { background-color: #D1FAE5; color: #10B981; }
          .badge-red { background-color: #FEE2E2; color: #EF4444; }
          .badge-orange { background-color: #FEF3C7; color: #D97706; }
          .adherence-score {
            font-size: 32px;
            font-weight: 800;
            color: #10B981;
            text-align: center;
            margin: 10px 0;
          }
          .footer {
            margin-top: 50px;
            border-top: 1px solid #E2E8F0;
            padding-top: 15px;
            text-align: center;
            font-size: 11px;
            color: #94A3B8;
          }
          .bullet-list {
            margin: 0;
            padding-left: 20px;
          }
          .bullet-list li {
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-title">
            <h1>MediTrack</h1>
            <p>Personal Health Summary & Clinical Report</p>
          </div>
          <div class="header-meta">
            <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Report Window:</strong> ${dateRangeLabel}</p>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-title">Patient Demographics</div>
            <div class="profile-row">
              <span class="profile-label">Full Name:</span>
              <span class="profile-value">${data.patientName}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Date of Birth:</span>
              <span class="profile-value">${data.dob} (${data.age} yrs)</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Gender:</span>
              <span class="profile-value">${data.gender}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Blood Group:</span>
              <span class="profile-value">${data.bloodGroup}</span>
            </div>
            <div class="profile-row">
              <span class="profile-label">Height / Weight:</span>
              <span class="profile-value">${data.height} cm / ${data.weight} kg</span>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Emergency Information</div>
            ${
              data.emergencyContact
                ? `
              <div class="profile-row">
                <span class="profile-label">Primary Contact:</span>
                <span class="profile-value">${data.emergencyContact.name}</span>
              </div>
              <div class="profile-row">
                <span class="profile-label">Relationship:</span>
                <span class="profile-value">${data.emergencyContact.relation}</span>
              </div>
              <div class="profile-row">
                <span class="profile-label">Phone Number:</span>
                <span class="profile-value" style="color: #EF4444; font-weight: bold;">${data.emergencyContact.phone}</span>
              </div>
              `
                : `<p style="color: #EF4444; margin: 0; font-weight: bold;">No emergency contacts listed.</p>`
            }
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-title">Medical Conditions</div>
            ${
              data.conditions.length > 0
                ? `<ul class="bullet-list">${data.conditions.map((c) => `<li><strong>${c}</strong></li>`).join('')}</ul>`
                : `<p>No chronic conditions listed.</p>`
            }
          </div>
          <div class="card">
            <div class="card-title">Allergies & Contraindications</div>
            ${
              data.allergies.length > 0
                ? `<ul class="bullet-list">${data.allergies
                    .map((a) => `<li style="color: #D00000;"><strong>${a}</strong></li>`)
                    .join('')}</ul>`
                : `<p>No known drug/food allergies.</p>`
            }
          </div>
        </div>

        <div class="section-title">Medication Adherence Summary</div>
        <div class="card" style="display: flex; align-items: center; justify-content: space-around; flex-direction: row;">
          <div style="text-align: center; width: 40%;">
            <div class="card-title" style="margin-bottom: 5px;">Compliance Rate</div>
            <div class="adherence-score">${data.adherencePercentage.toFixed(1)}%</div>
            <span class="badge ${data.adherencePercentage >= 85 ? 'badge-green' : data.adherencePercentage >= 65 ? 'badge-orange' : 'badge-red'}">
              ${data.adherencePercentage >= 85 ? 'Excellent Adherence' : data.adherencePercentage >= 65 ? 'Moderate Adherence' : 'Needs Improvement'}
            </span>
          </div>
          <div style="width: 55%; font-size: 12px; color: #64748B;">
            This adherence score represents the percentage of scheduled medication doses marked as "TAKEN" vs skipped/missed inside the log diary during this report's timeframe.
          </div>
        </div>

        <div class="section-title">Medications List</div>
        <table>
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Dosage</th>
              <th>Instructions</th>
              <th>Frequency</th>
              <th>Stock Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              data.medicationList.length > 0
                ? data.medicationList
                    .map(
                      (m) => `
              <tr>
                <td><strong>${m.name}</strong></td>
                <td>${m.dosage} ${m.unit}</td>
                <td>${m.instructions || 'N/A'}</td>
                <td><span class="badge badge-blue">${m.frequencyType}</span></td>
                <td>${m.stock} remaining</td>
              </tr>
            `
                    )
                    .join('')
                : `<tr><td colspan="5" style="text-align:center;">No medications listed.</td></tr>`
            }
          </tbody>
        </table>

        <div class="section-title">Recent Vitals Log Summary</div>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Blood Pressure (mmHg)</th>
              <th>Blood Sugar (mg/dL)</th>
              <th>Oxygen (SpO2 %)</th>
              <th>Heart Rate (BPM)</th>
              <th>Temp (°C)</th>
              <th>Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${
              data.vitalsLogs.length > 0
                ? data.vitalsLogs
                    .map((v) => {
                      const bp = v.systolic ? `${v.systolic}/${v.diastolic}` : 'N/A';
                      const sugar =
                        v.blood_sugar_fasting || v.blood_sugar_post_meal
                          ? `${v.blood_sugar_fasting ? `Fasting: ${v.blood_sugar_fasting}` : ''}${
                              v.blood_sugar_post_meal ? ` Post: ${v.blood_sugar_post_meal}` : ''
                            }`
                          : 'N/A';
                      return `
                <tr>
                  <td>${new Date(v.timestamp).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}</td>
                  <td><strong>${bp}</strong></td>
                  <td>${sugar}</td>
                  <td>${v.spo2 ? `${v.spo2}%` : 'N/A'}</td>
                  <td>${v.heart_rate ? `${v.heart_rate} bpm` : 'N/A'}</td>
                  <td>${v.temperature ? `${v.temperature}°C` : 'N/A'}</td>
                  <td>${v.weight ? `${v.weight} kg` : 'N/A'}</td>
                </tr>
              `;
                    })
                    .join('')
                : `<tr><td colspan="7" style="text-align:center;">No vitals logs during this period.</td></tr>`
            }
          </tbody>
        </table>

        <div class="section-title">Recorded Symptoms Timeline</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Timestamp</th>
              <th style="width: 25%;">Symptom</th>
              <th style="width: 15%;">Severity</th>
              <th style="width: 35%;">Notes / Context</th>
            </tr>
          </thead>
          <tbody>
            ${
              data.symptomLogs.length > 0
                ? data.symptomLogs
                    .map(
                      (s) => `
              <tr>
                <td>${new Date(s.timestamp).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}</td>
                <td><strong>${s.name}</strong></td>
                <td>
                  <span class="badge ${s.severity >= 7 ? 'badge-red' : s.severity >= 4 ? 'badge-orange' : 'badge-green'}">
                    Severity: ${s.severity}/10
                  </span>
                </td>
                <td>${s.notes || 'No description provided.'}</td>
              </tr>
            `
                    )
                    .join('')
                : `<tr><td colspan="4" style="text-align:center;">No symptoms logged during this period.</td></tr>`
            }
          </tbody>
        </table>

        <div class="section-title">Doctor Consultation Visits</div>
        <table>
          <thead>
            <tr>
              <th style="width: 20%;">Date</th>
              <th style="width: 30%;">Doctor / Specialist</th>
              <th style="width: 30%;">Diagnosis / Notes</th>
              <th style="width: 20%;">Follow-Up</th>
            </tr>
          </thead>
          <tbody>
            ${
              data.doctorVisits.length > 0
                ? data.doctorVisits
                    .map(
                      (dv) => `
              <tr>
                <td>${dv.visit_date}</td>
                <td><strong>${dv.doctor_name}</strong><br><span style="font-size: 11px; color:#64748B;">${
                        dv.specialization
                      }</span></td>
                <td>${dv.notes || ''}${
                        dv.prescription_summary ? `<br><strong>Prescriptions:</strong> ${dv.prescription_summary}` : ''
                      }</td>
                <td>${dv.follow_up_date || 'None'}</td>
              </tr>
            `
                    )
                    .join('')
                : `<tr><td colspan="4" style="text-align:center;">No consultation logs.</td></tr>`
            }
          </tbody>
        </table>

        <div class="footer">
          <p>MediTrack is a personal health tracking log companion and does NOT provide diagnostic treatments.</p>
          <p>&copy; ${new Date().getFullYear()} MediTrack App. All patient information is encrypted and stored locally on the device.</p>
        </div>
      </body>
      </html>
    `;

    // 1. Print to local temporary file
    const { uri } = await Print.printToFileAsync({ html: htmlContent });

    // 2. Share PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `MediTrack_Health_Report_${dateRangeLabel.replace(/\s+/g, '_')}`,
        UTI: 'com.adobe.pdf',
      });
      return true;
    } else {
      console.warn('Sharing is not available on this platform');
      return false;
    }
  } catch (error) {
    console.error('Error generating or sharing report:', error);
    return false;
  }
};
