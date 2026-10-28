const API_URL = "https://script.google.com/macros/s/AKfycbxMp3hM2AKZtzYlYXw2FSPmx_xGIysmLXSNTZqO_y0HO4i7Da8SwsKOQK2VA3ZOxV8V/exec";

let currentUser = null;
let defaultSettings = { reply: "", bcc: "", loginUrl: "" };
let dynamicCandidates = []; 
let currentCaptchaAnswer = 0;
let pendingFormSubmission = null;

// --- UI HELPERS ---
function showModal(title, message) {
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalMessage').innerHTML = message;
  document.querySelector('.modal-footer').innerHTML = `<button class="btn btn-primary" onclick="closeModal()">OK</button>`;
  document.querySelector('.modal-box').style.maxWidth = '450px';
  document.getElementById('customModal').style.display = 'flex';
}

function closeModal() { 
  document.getElementById('customModal').style.display = 'none';
  document.querySelector('.modal-box').style.maxWidth = '450px';
  pendingFormSubmission = null;
}

function showSystemError(err) { showModal("System Alert", err); }

function togglePasswordVisibility() {
  const passwordField = document.getElementById('password');
  const toggleIcon = document.querySelector('.toggle-password');
  if (passwordField.type === 'password') {
    passwordField.type = 'text';
    toggleIcon.innerText = '🙈'; 
  } else {
    passwordField.type = 'password';
    toggleIcon.innerText = '👁️'; 
  }
}

// --- CHARTS & MODALS ---
async function showSafetyFlagsTable() {
  showModal("Loading...", "<p>Fetching safety flag records...</p>");
  const records = await apiCall('getSafetyFlagsData');
  
  let html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">';
  html += '<tr style="background:#FF5C35; color:white; text-align:left;"><th style="padding:10px;">Date</th><th style="padding:10px;">Candidate</th><th style="padding:10px;">Referee</th><th style="padding:10px;">Referee Comments</th></tr>';
  
  if(!records || records.length === 0) {
    html += '<tr><td colspan="4" style="padding:20px; text-align:center; color:#777;">No safety flags recorded. Great news!</td></tr>';
  } else {
    records.forEach(r => {
      let d = new Date(r.date).toLocaleDateString();
      let safeId = r.assignmentId || r.referee;
      html += '<tr style="border-bottom:1px solid #eee;">';
      html += '<td style="padding:10px;">' + d + '</td>';
      html += '<td style="padding:10px;"><a href="javascript:void(0)" onclick="showPDFModal(\'' + safeId + '\', \'' + r.candidate + '\')" style="color:var(--isd-teal); font-weight:bold; text-decoration:underline;">' + r.candidate + '</a></td>';
      html += '<td style="padding:10px;">' + r.referee + '</td>';
      html += '<td style="padding:10px; color: #FF5C35;">' + r.comments + '</td>';
      html += '</tr>';
    });
  }
  html += '</table></div>';
  
  document.getElementById('modalTitle').innerText = "⚠️ Child Safety Concerns";
  document.getElementById('modalMessage').innerHTML = html;
  document.querySelector('.modal-footer').innerHTML = `<button class="btn btn-primary" onclick="closeModal()">Close</button>`;
  document.querySelector('.modal-box').style.maxWidth = '800px';
  document.getElementById('customModal').style.display = 'flex';
}

async function showDashboardTable(type) {
  showModal("Loading...", "<p>Fetching records...</p>");
  let title = ""; let html = ""; let records = [];

  if (type === 'completed') {
    title = "Completed References";
    records = await apiCall('getAllSubmittedRecords');
    html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">';
    html += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:10px;">Date</th><th style="padding:10px;">Candidate</th><th style="padding:10px;">Referee</th><th style="padding:10px;">Overall Rating</th></tr>';
    if(!records || records.length === 0) html += '<tr><td colspan="4" style="padding:20px; text-align:center; color:#777;">No records found.</td></tr>';
    else {
      records.forEach(r => {
        let d = new Date(r.date).toLocaleDateString();
        let safeId = r.assignmentId || r.referee;
        html += '<tr style="border-bottom:1px solid #eee;">';
        html += '<td style="padding:10px;">' + d + '</td>';
        html += '<td style="padding:10px;"><a href="javascript:void(0)" onclick="showPDFModal(\'' + safeId + '\', \'' + r.candidate + '\')" style="color:var(--isd-teal); font-weight:bold; text-decoration:underline;">' + r.candidate + '</a></td>';
        html += '<td style="padding:10px;">' + r.referee + '</td>';
        html += '<td style="padding:10px;">' + r.overallRating + '</td>';
        html += '</tr>';
      });
    }
    html += '</table></div>';
  } else if (type === 'pending') {
    title = "Pending Requests";
    records = await apiCall('getAllPendingRecords');
    html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">';
    html += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:10px;">Candidate</th><th style="padding:10px;">Referee</th><th style="padding:10px;">Email</th><th style="padding:10px;">Status</th></tr>';
    if(!records || records.length === 0) html += '<tr><td colspan="4" style="padding:20px; text-align:center; color:#777;">No pending requests.</td></tr>';
    else {
      records.forEach(r => {
        let statusColor = r.status === 'Sent' ? '#38D430' : '#FFDA00';
        let statusText = r.status === 'Sent' ? 'Email Sent' : 'Pending Email';
        html += '<tr style="border-bottom:1px solid #eee;">';
        html += '<td style="padding:10px;"><a href="javascript:void(0)" onclick="showPDFModal(\'' + r.id + '\', \'' + r.candidate + '\')" style="color:var(--isd-teal); font-weight:bold; text-decoration:underline;">' + r.candidate + '</a></td>';
        html += '<td style="padding:10px;">' + r.officialName + '</td>';
        html += '<td style="padding:10px;">' + r.email + '</td>';
        html += '<td style="padding:10px; color:' + statusColor + '; font-weight:bold;">' + statusText + '</td>';
        html += '</tr>';
      });
    }
    html += '</table></div>';
  }

  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalMessage').innerHTML = html;
  document.querySelector('.modal-footer').innerHTML = `<button class="btn btn-primary" onclick="closeModal()">Close</button>`;
  document.querySelector('.modal-box').style.maxWidth = '800px';
  document.getElementById('customModal').style.display = 'flex';
}

async function showPDFModal(assignmentId, candidateName) {
  showModal("Loading...", "<p>Fetching reference data...</p>");
  const res = await apiCall('getSubmissionData', { assignmentId: assignmentId });
  if (!res.success) { showModal("Error", res.message); return; }
  
  const data = res.data;
  let tableRows = "";
  const labels = {
    "supervisorPosition": "Supervisor's Position", "workDuration": "Worked Together For", "schoolName": "School/Organization Name",
    "childSafetyConcerns": "Concerns About Behaviour Around Children?", "greatestStrengths": "Greatest Strengths", "areasForDevelopment": "Areas for Development",
    "reactionToDislike": "Reaction to Unliked Decision (1-10)", "reactionToCriticism": "Reaction to Constructive Criticism (1-10)", "moraleInfluence": "Influence on School Morale (1-10)",
    "retainCandidate": "Wish to Retain/Re-employ?", "parentReaction": "Parent Reaction", "effectiveness": "Effectiveness in Classroom", "subjectKnowledge": "Subject Knowledge",
    "relationshipStudents": "Relationship with Students", "relationshipParents": "Relationship with Parents", "relationshipPeers": "Relationship with Peers",
    "relationshipLeadership": "Relationship with Leadership", "genuineInterest": "Genuine Interest in Children", "communication": "Ability to Communicate",
    "creativity": "Creativity", "encouragement": "Encouragement of High Standards", "tolerance": "Tolerance of Frustration", "organization": "Sense of Organization",
    "openCommunication": "Communicates Openly", "coCurricular": "Contributes to Co-curricular", "workEthic": "Work Ethic", "energy": "Energy and Stamina",
    "attendance": "Attendance/Punctuality", "enthusiasm": "Enthusiasm", "inspire": "Ability to Inspire Students", "humour": "Sense of Humour",
    "adaptability": "Adaptability/Flexibility", "teamPlayer": "Works as a Team Player", "overallRating": "Overall Rating", "furtherComments": "Further Comments",
    "phoneCallWilling": "Willing to do 5-min Call?"
  };

  for (let key in data) {
    if (key !== 'candidateName' && key !== 'refereeName' && key !== 'assignmentId') {
      let displayLabel = labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      let value = data[key] || 'N/A';
      tableRows += `<tr><td style="padding:10px; border:1px solid #ddd; background:#f4f4f4; width:40%; font-weight:bold; font-size:13px;">${displayLabel}</td><td style="padding:10px; border:1px solid #ddd; font-size:13px;">${value}</td></tr>`;
    }
  }

  document.getElementById('modalTitle').innerText = "Reference Report: " + candidateName;
  document.getElementById('modalMessage').innerHTML = `
    <div id="pdfPrintableArea" style="background:white; padding:20px; color:#333; font-family:Arial, sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #004C45; padding-bottom:10px; margin-bottom:20px;">
        <img src="${document.getElementById('headerLogo').src}" style="max-height:70px;">
        <h2 style="color:#004C45; margin:0; text-align:right;">International School Dhaka</h2>
      </div>
      <h3 style="text-align:center; color:#FF5C35; margin-bottom:20px;">Comprehensive Reference Report</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr><td style="padding:10px; border:1px solid #ddd; background:#f4f4f4; width:40%; font-weight:bold;">Referee Name</td><td style="padding:10px; border:1px solid #ddd;">${data.refereeName}</td></tr>
        <tr><td style="padding:10px; border:1px solid #ddd; background:#f4f4f4; width:40%; font-weight:bold;">Candidate Name</td><td style="padding:10px; border:1px solid #ddd;">${data.candidateName}</td></tr>
        ${tableRows}
      </table>
      <p style="font-size:12px; color:#777; text-align:center; margin-top:40px;">Generated securely on ${new Date().toLocaleString()}</p>
    </div>
  `;
  
  document.querySelector('.modal-footer').innerHTML = `
    <button onclick="printPDF()" class="btn btn-primary" style="width:auto; padding:10px 20px; margin-right:10px;">Download as PDF</button>
    <button class="btn btn-primary" onclick="closeModal()" style="width:auto; background-color:var(--isd-teal);">Close</button>
  `;
  document.querySelector('.modal-box').style.maxWidth = '800px';
  document.getElementById('customModal').style.display = 'flex';
}

function printPDF() {
  const printContents = document.getElementById('pdfPrintableArea').innerHTML;
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'absolute';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);
  
  const doc = printFrame.contentWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head><title>Reference Report</title><style>@page { size: A4; margin: 15mm; } body { font-family: Arial, sans-serif; color: #333; font-size: 12px; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }</style></head>
      <body>${printContents}</body>
    </html>
  `);
  doc.close();
  printFrame.contentWindow.focus();
  printFrame.contentWindow.print();
  setTimeout(() => document.body.removeChild(printFrame), 1000);
}

// --- CHART RENDERING ---
function renderCharts(retain, parent, radar, soft) {
  const ctxRetain = document.getElementById('retentionChart');
  if(ctxRetain) {
    new Chart(ctxRetain, {
      type: 'bar',
      data: {
        labels: ['Great Enthusiasm', 'Enthusiasm', 'Neutral', 'Hesitant', 'Will Not Retain'],
        datasets: [{ label: 'Votes', data: [retain.great, retain.enthusiastic, retain.neutral, retain.hesitant, retain.no], backgroundColor: ['#38D430', '#7CE57A', '#FFDA00', '#FF9D00', '#FF5C35'], borderRadius: 5 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }
  const ctxParent = document.getElementById('parentChart');
  if(ctxParent) {
    new Chart(ctxParent, {
      type: 'doughnut',
      data: { labels: ['Great Enthusiasm', 'Enthusiasm', 'Neutral', 'Hesitant'], datasets: [{ data: [parent.great, parent.enthusiastic, parent.neutral, parent.hesitant], backgroundColor: ['#004C45', '#38D430', '#FFDA00', '#FF5C35'] }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%' }
    });
  }
  const ctxRadar = document.getElementById('radarChart');
  if(ctxRadar) {
    new Chart(ctxRadar, {
      type: 'radar',
      data: {
        labels: ['Effectiveness', 'Subject Knowledge', 'Rel. Students', 'Communication', 'Work Ethic', 'Overall'],
        datasets: [{ label: 'Average Score (1-5)', data: [radar.effectiveness, radar.subjectKnowledge, radar.relationshipStudents, radar.communication, radar.workEthic, radar.overallRating], backgroundColor: 'rgba(0, 76, 69, 0.2)', borderColor: '#004C45', pointBackgroundColor: '#FF5C35', borderWidth: 2 }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { suggestedMin: 0, suggestedMax: 5, ticks: { stepSize: 1 } } } }
    });
  }
  const ctxSoft = document.getElementById('softSkillsChart');
  if(ctxSoft) {
    new Chart(ctxSoft, {
      type: 'bar',
      data: { labels: ['Adaptability', 'Team Player', 'Humour', 'Tolerance', 'Open Comm.'], datasets: [{ label: 'Average (1-5)', data: [soft.adaptability, soft.teamPlayer, soft.humour, soft.tolerance, soft.openComm], backgroundColor: '#004C45', borderRadius: 5 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 5 } } }
    });
  }
}

// --- INIT & AUTH ---
function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  currentCaptchaAnswer = a + b;
  const questionSpan = document.getElementById('captchaQuestion');
  if(questionSpan) {
    questionSpan.innerText = a + " + " + b + " = ?";
  }
  document.getElementById('captchaInput').value = '';
}

async function apiCall(action, data = {}) {
  try {
    const payload = JSON.stringify({ action: action, ...data });
    const response = await fetch(API_URL, { method: 'POST', body: payload, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return { success: false, message: "Connection failed: " + error.message };
  }
}

window.onload = async function() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
  generateCaptcha(); 
  const logoUrl = await apiCall('getLogo');
  if (logoUrl) { document.getElementById('loginLogo').src = logoUrl; document.getElementById('headerLogo').src = logoUrl; }
  const settings = await apiCall('getSettings');
  if(settings) defaultSettings = settings; 
};

function forgotPassword() {
  document.getElementById('modalTitle').innerText = "Forgot Password";
  document.getElementById('modalMessage').innerHTML = `
    <p>Please enter your registered email address. The system will generate a new password and send it to you.</p>
    <div class="input-group" style="margin-top:15px;"><label>Email Address</label><input type="email" id="forgotEmailInput" placeholder="yourname@isdbd.org" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;"></div>
  `;
  document.querySelector('.modal-footer').innerHTML = `
    <button class="btn btn-primary" onclick="submitForgotPassword()" style="width:auto; margin-right:10px;">Reset Password</button>
    <button class="btn btn-primary" onclick="closeModal()" style="width:auto; background-color:#777;">Cancel</button>
  `;
  document.getElementById('customModal').style.display = 'flex';
}

async function submitForgotPassword() {
  const email = document.getElementById('forgotEmailInput').value.trim();
  if(!email) return showModal("Error", "Please enter your email address.");
  showModal("Processing...", "<p>Please wait while we verify your email...</p>");
  const res = await apiCall('forgotPasswordRequest', { email: email });
  if(res.success) showModal("Success", "<p>A new password has been sent to your email address.</p><p><em>Note: A copy has also been sent to the Admin.</em></p>");
  else showModal("Error", res.message);
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  const userAnswer = parseInt(document.getElementById('captchaInput').value);
  if (userAnswer !== currentCaptchaAnswer) { document.getElementById('captchaError').style.display = 'block'; generateCaptcha(); return; }
  document.getElementById('captchaError').style.display = 'none';

  const btn = document.getElementById('loginBtn');
  btn.innerText = "Logging in..."; btn.disabled = true;
  
  const res = await apiCall('login', { username: document.getElementById('username').value, password: document.getElementById('password').value });

  if (res.success) {
    currentUser = res;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    document.getElementById('userNameDisplay').innerText = res.staffName + " (" + res.role + ")";
    
    let perms = res.permissions ? res.permissions.split(",") : [];
    if (res.role === 'Admin') perms = ["Dashboard","SendEmail","ManageReferees","CandidateOverview","Admin"];
    
    if (res.role === 'Referee') {
      document.getElementById('nav-dashboard').style.display = 'none';
      document.getElementById('nav-sendEmail').style.display = 'none';
      document.getElementById('nav-form').style.display = 'block';
      document.getElementById('nav-form').innerText = "My Submissions";
      document.getElementById('nav-admin').style.display = 'none';
      document.getElementById('nav-candidates').style.display = 'none'; 
      showModule('form', document.getElementById('nav-form'));
    } else {
      document.getElementById('nav-dashboard').style.display = perms.includes("Dashboard") ? 'block' : 'none';
      document.getElementById('nav-sendEmail').style.display = perms.includes("SendEmail") ? 'block' : 'none';
      document.getElementById('nav-form').style.display = perms.includes("ManageReferees") ? 'block' : 'none';
      document.getElementById('nav-admin').style.display = (res.role === 'Admin' || perms.includes("Admin")) ? 'block' : 'none';
      document.getElementById('nav-candidates').style.display = perms.includes("CandidateOverview") ? 'block' : 'none';
      showModule('dashboard', document.getElementById('nav-dashboard'));
    }
  } else {
    showModal("Login Failed", res.message); btn.innerText = "Login"; btn.disabled = false; generateCaptcha(); 
  }
}

function logout(e) { if(e) e.preventDefault(); window.location.reload(); }

function showModule(moduleName, el, e) {
  if (e) e.preventDefault();
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
  if(el) el.classList.add('active');
  const content = document.getElementById('contentArea');
  content.innerHTML = "<p>Loading...</p>";
  
  if (moduleName === 'dashboard') loadDashboard();
  else if (moduleName === 'admin') content.innerHTML = getAdminHTML();
  else if (moduleName === 'form') { 
    if (currentUser.role === 'Referee') loadRefereeView(); 
    else loadManageRefereesPage(); 
  }
  else if (moduleName === 'sendEmail') loadSendEmailPage();
  else if (moduleName === 'candidates') loadCandidateOverview(); 
}

// --- DASHBOARD MODULE ---
async function loadDashboard() {
  const rawData = await apiCall('getDashboardStats');
  try {
    if (!rawData) throw new Error("No data received");
    let subs = rawData.rawSubmissions || [];
    let assign = rawData.rawAssignments || [];
    let totalSubmissions = subs.length, pending = 0, childSafetyFlags = 0;
    let retainCounts = { great: 0, enthusiastic: 0, neutral: 0, hesitant: 0, no: 0 };
    let parentCounts = { great: 0, enthusiastic: 0, neutral: 0, hesitant: 0 };
    let softSkills = { adaptability: 0, teamPlayer: 0, humour: 0, tolerance: 0, openComm: 0 };
    let ratingCounts = {}; 
    let count = 0;
    const ratingMap = { "Outstanding": 5, "Above average": 4, "Average": 3, "Below average": 2, "N/A Not applicable": 0 };
    let recent = [];

    for (let i = 0; i < assign.length; i++) if (assign[i][3] === "Pending" || assign[i][3] === "Sent") pending++;

    for (let i = subs.length - 1; i >= 0; i--) {
      try {
        let data = JSON.parse(subs[i][2]);
        if (data.childSafetyConcerns === "Yes") childSafetyFlags++;
        if (data.retainCandidate) {
          if (data.retainCandidate.includes("great")) retainCounts.great++;
          else if (data.retainCandidate.includes("enthusiasm")) retainCounts.enthusiastic++;
          else if (data.retainCandidate.includes("neutral")) retainCounts.neutral++;
          else if (data.retainCandidate.includes("hesitation")) retainCounts.hesitant++;
          else if (data.retainCandidate.includes("not")) retainCounts.no++;
        }
        if (data.parentReaction) {
          if (data.parentReaction.includes("great")) parentCounts.great++;
          else if (data.parentReaction.includes("enthusiasm")) parentCounts.enthusiastic++;
          else if (data.parentReaction.includes("neutral")) parentCounts.neutral++;
          else if (data.parentReaction.includes("hesitation")) parentCounts.hesitant++;
        }
        softSkills.adaptability += ratingMap[data.adaptability] || 0;
        softSkills.teamPlayer += ratingMap[data.teamPlayer] || 0;
        softSkills.humour += ratingMap[data.humour] || 0;
        softSkills.tolerance += ratingMap[data.tolerance] || 0;
        softSkills.openComm += ratingMap[data.openCommunication] || 0;
        const coreFields = ['effectiveness', 'subjectKnowledge', 'relationshipStudents', 'communication', 'workEthic', 'overallRating'];
        coreFields.forEach(field => { if (!ratingCounts[field]) ratingCounts[field] = 0; ratingCounts[field] += ratingMap[data[field]] || 0; });
        if (count < 5) { recent.push({ date: subs[i][0], candidate: data.candidateName || "Unknown", referee: data.refereeName || "Unknown", overall: data.overallRating || "N/A" }); count++; }
      } catch(e) { }
    }

    let divisor = totalSubmissions > 0 ? totalSubmissions : 1;
    let avgSoftSkills = { adaptability: (softSkills.adaptability / divisor).toFixed(1), teamPlayer: (softSkills.teamPlayer / divisor).toFixed(1), humour: (softSkills.humour / divisor).toFixed(1), tolerance: (softSkills.tolerance / divisor).toFixed(1), openComm: (softSkills.openComm / divisor).toFixed(1) };
    let avgRadar = { effectiveness: (ratingCounts.effectiveness / divisor).toFixed(1), subjectKnowledge: (ratingCounts.subjectKnowledge / divisor).toFixed(1), relationshipStudents: (ratingCounts.relationshipStudents / divisor).toFixed(1), communication: (ratingCounts.communication / divisor).toFixed(1), workEthic: (ratingCounts.workEthic / divisor).toFixed(1), overallRating: (ratingCounts.overallRating / divisor).toFixed(1) };

    let html = '<h2 style="margin-bottom:20px; color:var(--isd-teal);">HR Intelligence Dashboard</h2>';
    html += '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:20px; margin-bottom:20px;">';
    html += '<div class="card" onclick="showDashboardTable(\'completed\')" style="border-top-color:#38D430; text-align:center; cursor:pointer; transition: transform 0.2s; padding:20px;" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'"><h1 style="font-size:36px; color:#38D430; margin:0;">' + totalSubmissions + '</h1><p style="color:#777; font-weight:bold;">Completed References</p></div>';
    html += '<div class="card" onclick="showDashboardTable(\'pending\')" style="border-top-color:#FFDA00; text-align:center; cursor:pointer; transition: transform 0.2s; padding:20px;" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'"><h1 style="font-size:36px; color:#FFDA00; margin:0;">' + pending + '</h1><p style="color:#777; font-weight:bold;">Pending Requests</p></div>';
    html += '<div class="card" onclick="showSafetyFlagsTable()" style="border-top-color:' + (childSafetyFlags > 0 ? '#FF5C35' : '#777') + '; text-align:center; cursor:pointer; transition: transform 0.2s; padding:20px;" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'"><h1 style="font-size:36px; color:' + (childSafetyFlags > 0 ? '#FF5C35' : '#777') + '; margin:0;">' + childSafetyFlags + '</h1><p style="color:#777; font-weight:bold;">Child Safety Flags</p></div>';
    html += '</div>';
    html += '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px; margin-bottom:20px;">';
    html += '<div class="card" style="padding:15px;"><h4 style="margin-top:0; color:var(--isd-teal);">Retention Consensus</h4><div style="position: relative; height: 220px; width: 100%;"><canvas id="retentionChart"></canvas></div></div>';
    html += '<div class="card" style="padding:15px;"><h4 style="margin-top:0; color:var(--isd-teal);">Parent Reaction</h4><div style="position: relative; height: 220px; width: 100%;"><canvas id="parentChart"></canvas></div></div>';
    html += '<div class="card" style="padding:15px;"><h4 style="margin-top:0; color:var(--isd-teal);">Core Teaching Competencies (Avg)</h4><div style="position: relative; height: 220px; width: 100%;"><canvas id="radarChart"></canvas></div></div>';
    html += '<div class="card" style="padding:15px;"><h4 style="margin-top:0; color:var(--isd-teal);">Soft Skills & Behaviour (Avg)</h4><div style="position: relative; height: 220px; width: 100%;"><canvas id="softSkillsChart"></canvas></div></div>';
    html += '</div>';
    html += '<div style="display:flex; gap:15px; margin-bottom:20px; flex-wrap:wrap;">';
    html += '<button onclick="downloadCSV()" class="btn btn-primary" style="width:auto;">📥 Export Submissions (CSV)</button>';
    html += '<button onclick="loadAuditLogs()" class="btn btn-primary" style="width:auto; background-color:var(--isd-teal);">📋 View Audit Trail</button>';
    html += '</div>';
    html += '<div class="card"><h3>Recent Submissions</h3><div style="overflow-x:auto;">';
    html += '<table style="width:100%; border-collapse:collapse; min-width:600px;">';
    html += '<tr style="background:#f4f4f4; text-align:left;"><th style="padding:10px; border-bottom:2px solid #ddd;">Date</th><th style="padding:10px; border-bottom:2px solid #ddd;">Candidate</th><th style="padding:10px; border-bottom:2px solid #ddd;">Referee</th><th style="padding:10px; border-bottom:2px solid #ddd;">Overall Rating</th></tr>';
    if(recent.length === 0) html += '<tr><td colspan="4" style="padding:20px; text-align:center; color:#777;">No submissions yet.</td></tr>';
    recent.forEach(r => {
      let d = new Date(r.date).toLocaleDateString();
      html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">' + d + '</td><td style="padding:10px; font-weight:bold;">' + r.candidate + '</td><td style="padding:10px;">' + r.referee + '</td><td style="padding:10px;">' + r.overall + '</td></tr>';
    });
    html += '</table></div></div><div id="auditArea"></div>';
    document.getElementById('contentArea').innerHTML = html;
    renderCharts(retainCounts, parentCounts, avgRadar, avgSoftSkills);
  } catch (err) { document.getElementById('contentArea').innerHTML = '<div class="card"><h3 style="color:red;">Dashboard Error</h3><p>' + err.message + '</p></div>'; }
}

async function downloadCSV() {
  const csvData = await apiCall('exportCSV');
  if(!csvData) return;
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url); a.setAttribute('download', 'ISD_References_' + new Date().toISOString().split('T')[0] + '.csv');
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function loadAuditLogs() {
  document.getElementById('auditArea').innerHTML = "<p>Loading logs...</p>";
  const logs = await apiCall('getAuditLogs');
  let html = '<div class="card"><h3>Audit Trail (Last 50 Emails)</h3><div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">';
  html += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:10px;">Time</th><th style="padding:10px;">Sent By</th><th style="padding:10px;">To</th><th style="padding:10px;">BCC</th><th style="padding:10px;">Subject</th><th style="padding:10px;">Status</th></tr>';
  if(!logs || logs.length === 0) html += '<tr><td colspan="6" style="padding:20px; text-align:center; color:#777;">No email logs found.</td></tr>';
  else { logs.forEach(l => { html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">' + l.time + '</td><td style="padding:10px;">' + l.sentBy + '</td><td style="padding:10px;">' + l.to + '</td><td style="padding:10px;">' + l.bcc + '</td><td style="padding:10px;">' + l.subject + '</td><td style="padding:10px;"><span style="color:#38D430; font-weight:bold;">' + l.status + '</span></td></tr>'; }); }
  html += '</table></div></div>';
  document.getElementById('auditArea').innerHTML = html;
}

// --- CANDIDATE OVERVIEW MODULE ---
async function loadCandidateOverview() {
  const all = await apiCall('getAllAssignments');
  if(!all) return;
  let tHtml = '<div class="card"><h2 style="color:var(--isd-teal); margin-bottom:20px;">Candidate Overview</h2>';
  tHtml += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:14px;">';
  tHtml += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:12px;">Referee (User)</th><th style="padding:12px;">Referee Official Name</th><th style="padding:12px;">Referee Email</th><th style="padding:12px;">Candidate</th><th style="padding:12px;">Status</th><th style="padding:12px;">Action</th></tr>';
  if(all.length === 0) { tHtml += '<tr><td colspan="6" style="padding:20px; text-align:center; color:#777;">No candidates found in the system.</td></tr>'; }
  else {
    all.forEach(c => {
      let statusColor = "#777"; if (c.status === 'Submitted') statusColor = '#38D430'; else if (c.status === 'Sent') statusColor = '#004C45'; else if (c.status === 'Pending') statusColor = '#FFDA00';
      tHtml += '<tr style="border-bottom:1px solid #eee;"><td style="padding:12px;">' + c.username + '</td><td style="padding:12px;">' + c.officialName + '</td><td style="padding:12px;">' + c.email + '</td><td style="padding:12px; font-weight:bold;">' + c.candidate + '</td><td style="padding:12px; color:' + statusColor + '; font-weight:bold;">' + c.status + '</td><td style="padding:12px;">';
      if (c.status === 'Submitted') { tHtml += '<a href="javascript:void(0)" onclick="showPDFModal(\'' + c.id + '\', \'' + c.candidate + '\')" style="color:var(--isd-red); font-weight:bold;">View PDF</a>'; } else { tHtml += '<span style="color:#ccc; font-size:12px;">Awaiting Action</span>'; }
      tHtml += '</td></tr>';
    });
  }
  tHtml += '</table></div></div>';
  document.getElementById('contentArea').innerHTML = tHtml;
}

// --- MANAGE REFEREES MODULE ---
async function loadManageRefereesPage() {
  dynamicCandidates = []; 
  var html = '<div class="card"><h3>Add Referee and Candidates</h3>';
  html += '<div class="form-row"><div class="input-group"><label>Referee Username (System Login)</label><input type="text" id="refUser"></div>';
  html += '<div class="input-group"><label>Referee Official Name</label><input type="text" id="refNameOfficial"></div></div>';
  html += '<div class="input-group"><label>Referee Email</label><input type="email" id="refEmail"></div>';
  html += '<div style="background:#f9f9f9; padding:15px; border-radius:5px; border:1px solid #eee; margin-bottom:15px;">';
  html += '<h4 style="margin-top:0; color:var(--isd-teal);">Candidates</h4>';
  html += '<div style="display:flex; gap:10px; margin-bottom:10px;"><input type="text" id="candInput" placeholder="Candidate Full Name" style="flex:1; padding:10px; border:1px solid #ccc; border-radius:4px;">';
  html += '<button onclick="addCandidateToList()" class="btn btn-primary" style="width:auto; background-color:var(--isd-teal);">+ Add Candidate</button></div>';
  html += '<table style="width:100%; border-collapse:collapse; font-size:14px;" id="candTable"><tr style="background:#eee; text-align:left;"><th style="padding:8px;">Candidate Name</th><th style="padding:8px; width:50px;">Action</th></tr></table></div>';
  html += '<button onclick="saveRefereeAssignment()" class="btn btn-primary">Add Referee and Candidate(s)</button></div>';
  
  // 🔥 Referee User Management Section
  html += '<div class="card"><h3>Referee User Management</h3>';
  html += '<div id="refereeManagementTable">Loading users...</div></div>';
  
  document.getElementById('contentArea').innerHTML = html;
  loadRefereeManagementTable();
}

function addCandidateToList() {
  let val = document.getElementById('candInput').value.trim();
  if(!val) return;
  dynamicCandidates.push(val);
  document.getElementById('candInput').value = '';
  let table = document.getElementById('candTable');
  let row = table.insertRow(-1);
  let cell1 = row.insertCell(0); cell1.innerText = val;
  let cell2 = row.insertCell(1);
  cell2.innerHTML = '<button onclick="this.parentElement.parentElement.remove();" style="color:red; border:none; background:none; cursor:pointer; font-weight:bold;">X</button>';
}

async function saveRefereeAssignment() {
  let u = document.getElementById('refUser').value;
  let n = document.getElementById('refNameOfficial').value;
  let e = document.getElementById('refEmail').value;
  if(!u || !n || !e) return showModal("Error", "Please fill all referee fields.");
  if(dynamicCandidates.length === 0) return showModal("Error", "Please add at least one candidate.");
  const res = await apiCall('createRefereeAssignment', { username: u, officialName: n, email: e, candidates: dynamicCandidates });
  showModal("Success", res.message);
  loadManageRefereesPage(); 
}

async function loadRefereeManagementTable() {
  const users = await apiCall('getAllUsers');
  if(!users) return;
  const referees = users.filter(u => u.role === 'Referee');
  
  let html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:14px;">';
  html += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:10px;">Staff Name</th><th style="padding:10px;">Username</th><th style="padding:10px;">Email</th><th style="padding:10px;">Access Expiry</th><th style="padding:10px;">Status</th><th style="padding:10px;">Actions</th></tr>'; 
  
  if(referees.length === 0) {
    html += '<tr><td colspan="6" style="padding:20px; text-align:center; color:#777;">No Referees found in the system.</td></tr>';
  } else {
    referees.forEach(u => {
      let statusColor = u.status === 'Active' ? '#38D430' : '#FF5C35';
      let toggleText = u.status === 'Active' ? 'Deactivate' : 'Activate';
      let expiryText = u.expiry; let expiryColor = "#333";
      if (u.expiry !== "No Expiry") { let expDate = new Date(u.expiry); let today = new Date(); today.setHours(0,0,0,0); if (expDate < today) { expiryColor = "#FF5C35"; expiryText += " (Expired)"; } } else { expiryColor = "#777"; }

      html += '<tr style="border-bottom:1px solid #eee;">';
      html += '<td style="padding:10px; font-weight:bold;">' + (u.staffName || 'N/A') + '</td>';
      html += '<td style="padding:10px;">' + u.username + '</td>';
      html += '<td style="padding:10px;">' + u.email + '</td>';
      html += '<td style="padding:10px; color:' + expiryColor + '; font-weight:bold;">' + expiryText + '</td>';
      html += '<td style="padding:10px; color:' + statusColor + '; font-weight:bold;">' + u.status + '</td>';
      html += '<td style="padding:10px; display:flex; gap:5px; flex-wrap:wrap;">';
      html += '<button onclick="editUserDetails(\'' + u.username + '\', \'' + (u.staffName || '') + '\', \'' + u.role + '\', \'' + u.expiry + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-yellow); color:#333;">Edit</button>';
      html += '<button onclick="toggleUser(\'' + u.username + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-teal);">' + toggleText + '</button>';
      html += '<button onclick="adminResetPass(\'' + u.username + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-yellow); color:#333;">Reset Pass</button>';
      html += '</td></tr>';
    });
  }
  html += '</table></div>';
  document.getElementById('refereeManagementTable').innerHTML = html;
}

// --- SEND EMAIL MODULE ---
async function loadSendEmailPage() {
  const pending = await apiCall('getPendingAssignments');
  let html = '<div class="card"><h3>Send Reference Request</h3>';
  html += '<div class="input-group"><label>Select Referee Assignment to Email</label><select id="assignSelect" onchange="populateEmailFields()">';
  html += '<option value="">-- Select a Referee --</option>';
  if(pending) { pending.forEach(p => { html += '<option value="' + p.id + '" data-name="' + p.officialName + '" data-email="' + p.email + '" data-cand="' + p.candidate + '" data-user="' + p.username + '">' + p.officialName + ' (' + p.candidate + ')</option>'; }); }
  html += '</select></div>';
  html += '<div class="input-group"><label>To Email</label><input type="email" id="toEmail" readonly></div>';
  html += '<div id="emailPreview" style="display:none; background:white; padding:20px; border:1px solid #ddd; border-radius:8px; margin-bottom:20px;">';
  html += '<h4 style="color:var(--isd-teal); margin-top:0;">Email Preview (Auto-Generated)</h4>';
  html += '<p><strong>Subject:</strong> <span id="previewSubject"></span></p>';
  html += '<div id="previewBody" style="font-family:Arial; font-size:14px; line-height:1.6; color:#333; border-top:1px solid #eee; padding-top:15px;"></div>';
  html += '</div>';
  html += '<button onclick="sendDynamicEmail()" class="btn btn-primary">Send Email to Referee</button></div>';
  document.getElementById('contentArea').innerHTML = html;
}

async function populateEmailFields() {
  let sel = document.getElementById('assignSelect');
  let opt = sel.options[sel.selectedIndex];
  if(!opt.value) return;
  
  let rName = opt.getAttribute('data-name');
  let cName = opt.getAttribute('data-cand');
  let rEmail = opt.getAttribute('data-email');
  let rUser = opt.getAttribute('data-user');
  let assignId = opt.value;
  let formLink = defaultSettings.loginUrl || window.location.href;
  
  const passRes = await apiCall('getRefereeCredentials', { username: rUser, assignmentId: assignId });
  let tempPass = passRes || "Please use your existing password";

  document.getElementById('toEmail').value = rEmail;
  document.getElementById('emailPreview').style.display = 'block';
  document.getElementById('previewSubject').innerText = "ISD Reference Request for " + cName;
  
  // 🔥 UPDATED PREVIEW TEMPLATE
  let previewHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #004C45; padding: 20px 30px; color: white;">
        <h2 style="margin:0;">Reference Checking Management System</h2>
      </div>
      <div style="padding: 30px; color: #333; line-height: 1.6;">
        
        <!-- NEW INNER TEXT STARTS HERE -->
        <p>Warm Greetings from International School Dhaka.</p>
        <p>My name is <strong>Tahnia Ahmed</strong>, HR Manager, at International School Dhaka. We are in the process of hiring a Position and <strong>${cName}</strong> has been shortlisted.</p>
        <p><strong>${cName}</strong> has provided your name as a referee. We would greatly appreciate it if you could share your overall experience working with <strong>${cName}</strong> by completing the online reference form.</p>
        <p>Please be assured that all information provided will be treated with the utmost confidentiality and used solely for recruitment purposes.</p>
        <p>Thank you in advance for your time and support.</p>
        <!-- NEW INNER TEXT ENDS HERE -->
        
        <div style="background-color: #f4f7f6; padding: 20px; border-left: 4px solid #FF5C35; border-radius: 4px; margin: 25px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #004C45;">Your Secure Login Credentials:</p>
          <p style="margin: 5px 0;"><strong>Username:</strong> ${rUser}</p>
          <p style="margin: 5px 0;"><strong>Password:</strong> ${tempPass}</p>
        </div>

        <div style="text-align: center; margin: 35px 0;">
          <a href="${formLink}" style="background-color: #38D430; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
            Login & Complete Form
          </a>
        </div>
        <p>Thank you for your time and cooperation.</p>
        <p>Warm regards,<br><strong>ISD HR Team</strong><br>International School Dhaka</p>
      </div>
      <div style="background-color: #f9f9f9; padding: 20px 30px; font-size: 13px; color: #666; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0;">This is an automated message from the ISD Reference Checking System.</p>
      </div>
    </div>
  `;
  document.getElementById('previewBody').innerHTML = previewHtml;
}

async function sendDynamicEmail() {
  let sel = document.getElementById('assignSelect'); let opt = sel.options[sel.selectedIndex];
  if(!opt.value) return showModal("Error", "Please select a referee first.");
  let assignId = opt.value; let rName = opt.getAttribute('data-name'); let cName = opt.getAttribute('data-cand'); let rEmail = opt.getAttribute('data-email'); let rUser = opt.getAttribute('data-user');
  let formLink = defaultSettings.loginUrl || window.location.href;
  const passRes = await apiCall('getRefereeCredentials', { username: rUser, assignmentId: assignId });
  let tempPass = passRes || "Please use your existing password";

  showModal("Sending...", "<p>Please wait while we generate and send the email...</p>");

    // 🔥 UPDATED EMAIL TEMPLATE (Inner Text)
  const emailSettings = {
    to: rEmail, 
    replyTo: defaultSettings.reply, 
    bcc: defaultSettings.bcc, 
    subject: "ISD Reference Request for " + cName,
    body: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">' +
          '<div style="background-color: #004C45; padding: 20px 30px; color: white;"><h2 style="margin:0;">Reference Checking Management System</h2></div>' +
          '<div style="padding: 30px; color: #333; line-height: 1.6;">' +
          
          // 🔥 NEW INNER TEXT STARTS HERE
          '<p>Warm Greetings from International School Dhaka.</p>' +
          '<p>My name is <strong>Tahnia Ahmed</strong>, HR Manager, at International School Dhaka. We are in the process of hiring a Position and <strong>' + cName + '</strong> has been shortlisted.</p>' +
          '<p><strong>' + cName + '</strong> has provided your name as a referee. We would greatly appreciate it if you could share your overall experience working with <strong>' + cName + '</strong> by completing the online reference form.</p>' +
          '<p>Please be assured that all information provided will be treated with the utmost confidentiality and used solely for recruitment purposes.</p>' +
          '<p>Thank you in advance for your time and support.</p>' +
          // 🔥 NEW INNER TEXT ENDS HERE
          
          '<div style="background-color: #f4f7f6; padding: 20px; border-left: 4px solid #FF5C35; border-radius: 4px; margin: 25px 0;">' +
          '<p style="margin: 0 0 10px 0; font-weight: bold; color: #004C45;">Your Secure Login Credentials:</p>' +
          '<p style="margin: 5px 0;"><strong>Username:</strong> ' + rUser + '</p>' +
          '<p style="margin: 5px 0;"><strong>Password:</strong> ' + tempPass + '</p>' +
          '</div>' +
          '<div style="text-align: center; margin: 35px 0;"><a href="' + formLink + '" style="background-color: #38D430; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">Login & Complete Form</a></div>' +
          '<p>Thank you for your time and cooperation.</p>' +
          '<p>Warm regards,<br><strong>ISD HR Team</strong><br>International School Dhaka</p>' +
          '</div>' +
          '<div style="background-color: #f9f9f9; padding: 20px 30px; font-size: 13px; color: #666; text-align: center; border-top: 1px solid #e0e0e0;"><p style="margin: 0;">This is an automated message from the ISD Reference Checking System.</p></div></div>'
  };

  const res = await apiCall('sendEmail', { settings: emailSettings });
  
  if(res.success) {
    await apiCall('markAssignmentAsSent', { assignmentId: assignId });
    showModal("Email Sent Successfully", "The beautiful email has been sent to <b>" + rName + "</b> for candidate <b>" + cName + "</b>.");
    loadSendEmailPage(); 
  } else { showModal("Error", res.message); }
}

// --- REFEREE VIEW ---
async function loadRefereeView() {
  const subs = await apiCall('getMySubmissions', { username: currentUser.name });
  if(!subs) return;
  let html = '<div class="card"><h2>My Submission History</h2><div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; margin-top:15px;">';
  html += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:10px;">Candidate Name</th><th style="padding:10px;">Status</th><th style="padding:10px;">Action</th></tr>';
  if(subs.length === 0) html += '<tr><td colspan="3" style="padding:20px; text-align:center; color:#777;">No forms assigned yet.</td></tr>';
  subs.forEach(s => {
    html += '<tr style="border-bottom:1px solid #eee;">';
    html += '<td style="padding:10px; font-weight:bold;">' + s.candidate + '</td>';
    if(s.status === 'Submitted') {
      html += '<td style="padding:10px; color:#38D430; font-weight:bold;">Submitted & Locked</td>';
      html += '<td style="padding:10px;"><a href="javascript:void(0)" onclick="showPDFModal(\'' + s.id + '\', \'' + s.candidate + '\')" style="color:var(--isd-red); font-weight:bold;">View PDF</a></td>';
    } else {
      html += '<td style="padding:10px; color:#FFDA00; font-weight:bold;">Pending</td>';
      html += '<td style="padding:10px;"><button onclick="loadRefForm(\'' + s.candidate + '\', \'' + currentUser.name + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:12px;">Fill Form</button></td>';
    }
    html += '</tr>';
  });
  html += '</table></div></div><div id="activeFormContainer"></div>';
  document.getElementById('contentArea').innerHTML = html;
}

async function loadRefForm(candName, refUser) {
  const cands = await apiCall('getRefereeCandidates', { username: refUser });
  let assignId = "";
  if(cands) cands.forEach(c => { if(c.candidateName === candName) assignId = c.id; });
  if(!assignId) return showModal("Error", "Assignment not found or already submitted.");
  
  const scaleLabel = `<small style="display:block; color:#777; font-size:11px; margin-bottom:5px;">5 = Outstanding, 4 = Above Average, 3 = Average, 2 = Below Average, 1 = Unsatisfactory, 0 = Not applicable</small>`;
  
  let html = '<div class="card" style="max-width: 800px; margin: 20px auto;"><h3 style="color:var(--isd-teal); border-bottom:2px solid #eee; padding-bottom:10px;">Reference Form: ' + candName + '</h3>';
  html += '<form id="refForm" onsubmit="confirmSubmission(event, \'' + assignId + '\', \'' + candName + '\')">';
  html += '<input type="hidden" name="candidateName" value="' + candName + '">';
  html += '<input type="hidden" name="refereeName" value="' + refUser + '">';

  html += '<h4 style="color:var(--isd-teal); margin-top:20px;">Section 1: Background Information</h4>';
  html += '<div class="input-group"><label>During your time supervising this candidate, what was YOUR position and/or title? *</label><input type="text" name="supervisorPosition" required></div>';
  html += '<div class="input-group"><label>How long did you work together with this candidate? *</label><input type="text" name="workDuration" required></div>';
  html += '<div class="input-group"><label>What is the name of the school/organization where you supervised this candidate? *</label><input type="text" name="schoolName" required></div>';
  html += '<div class="input-group"><label>Do you have any concerns about this candidate\'s behaviour around children, or working unattended with children? *</label><select name="childSafetyConcerns" required><option value="No">No</option><option value="Yes">Yes</option></select></div>';

  html += '<h4 style="color:var(--isd-teal); margin-top:20px;">Section 2: General Assessment</h4>';
  html += '<div class="input-group"><label>What are this candidate\'s greatest strengths? *</label><textarea name="greatestStrengths" rows="3" required></textarea></div>';
  html += '<div class="input-group"><label>In what areas would you like to see the candidate develop? *</label><textarea name="areasForDevelopment" rows="3" required></textarea></div>';
  
  const scaleOptions = '<option value="10">10</option><option value="9">9</option><option value="8">8</option><option value="7">7</option><option value="6">6</option><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option>';
  html += '<div class="input-group"><label>How would this person react to a decision he or she did not like? (1 = Negative, 10 = Positive) *</label><select name="reactionToDislike" required>' + scaleOptions + '</select></div>';
  html += '<div class="input-group"><label>How would this candidate react to constructive criticism? (1 = Negative, 10 = Positive) *</label><select name="reactionToCriticism" required>' + scaleOptions + '</select></div>';
  html += '<div class="input-group"><label>What influence does this person have on school morale and "climate"? (1 = Negative, 10 = Positive) *</label><select name="moraleInfluence" required>' + scaleOptions + '</select></div>';
  
  html += '<div class="input-group"><label>Would you wish your school to retain or re-employ this candidate? *</label><select name="retainCandidate" required><option value="with great enthusiasm">With Great Enthusiasm</option><option value="with enthusiasm">With Enthusiasm</option><option value="with neutrality">With Neutrality</option><option value="with slight hesitation">With Slight Hesitation</option><option value="will not retain or re-employ">Will Not Retain or Re-employ</option></select></div>';
  html += '<div class="input-group"><label>How do you believe most parents would react to the news that their child was scheduled to have this teacher? *</label><select name="parentReaction" required><option value="with great enthusiasm">With Great Enthusiasm</option><option value="with enthusiasm">With Enthusiasm</option><option value="with neutrality">With Neutrality</option><option value="with slight hesitation">With Slight Hesitation</option></select></div>';

  const ratingOptions = '<option value="Outstanding">Outstanding</option><option value="Above average">Above Average</option><option value="Average">Average</option><option value="Below average">Below Average</option><option value="N/A Not applicable">N/A Not applicable</option>';
  html += '<h4 style="color:var(--isd-teal); margin-top:20px;">Section 3: Performance Ratings</h4>';
  
  const ratingFields = [
    { name: "effectiveness", label: "Effectiveness in classroom" }, { name: "subjectKnowledge", label: "Subject knowledge" },
    { name: "relationshipStudents", label: "Relationship with students" }, { name: "relationshipParents", label: "Relationship with parents" },
    { name: "relationshipPeers", label: "Relationship with peers" }, { name: "relationshipLeadership", label: "Relationship with leadership team" },
    { name: "genuineInterest", label: "Genuine interest in children" }, { name: "communication", label: "Ability to communicate effectively" },
    { name: "creativity", label: "Creativity" }, { name: "encouragement", label: "Encouragement of high standards" },
    { name: "tolerance", label: "Tolerance of frustration" }, { name: "organization", label: "Sense of organization and order" },
    { name: "openCommunication", label: "Communicates openly with others even when not in agreement" }, { name: "coCurricular", label: "Contributes to co-curricular school activities/sports" },
    { name: "workEthic", label: "Work Ethic" }, { name: "energy", label: "Energy and stamina" },
    { name: "attendance", label: "School attendance/punctuality" }, { name: "enthusiasm", label: "Enthusiasm" },
    { name: "inspire", label: "Ability to inspire students" }, { name: "humour", label: "Sense of humour" },
    { name: "adaptability", label: "Adaptability/flexibility" }, { name: "teamPlayer", label: "Works as a team player" },
    { name: "overallRating", label: "Overall rating of candidate" }
  ];

  ratingFields.forEach(f => { html += `<div class="input-group"><label>${f.label} *</label>${scaleLabel}<select name="${f.name}" required>${ratingOptions}</select></div>`; });

  html += '<h4 style="color:var(--isd-teal); margin-top:20px;">Section 4: Final Comments</h4>';
  html += '<div class="input-group"><label>Any further comments about this candidate: *</label><textarea name="furtherComments" rows="3" required></textarea></div>';
  html += '<div class="input-group"><label>Lastly, if necessary, would you be willing to participate in a 5 minute telephone call as part of our safer recruitment process? *</label><select name="phoneCallWilling" required><option value="Yes">Yes</option><option value="No">No</option></select></div>';
  html += '<button type="submit" class="btn btn-primary" style="margin-top:20px;">Submit & Lock Form</button></form></div>';
  document.getElementById('activeFormContainer').innerHTML = html;
}

function confirmSubmission(e, assignId, candName) {
  e.preventDefault();
  const form = document.getElementById('refForm'); const data = {};
  for (let i = 0; i < form.elements.length; i++) if (form.elements[i].name) data[form.elements[i].name] = form.elements[i].value;
  pendingFormSubmission = { assignId: assignId, candName: candName, data: data };
  
  document.getElementById('modalTitle').innerText = "Confirm Submission";
  document.getElementById('modalMessage').innerHTML = "<p>Are you sure you want to submit this reference?</p><p><strong>Note:</strong> You cannot edit this form after submission.</p>";
  document.querySelector('.modal-footer').innerHTML = `
    <button class="btn btn-primary" onclick="submitFormData()" style="width:auto; margin-right:10px;">OK, Submit</button>
    <button class="btn btn-primary" onclick="closeModal()" style="width:auto; background-color:#777;">Cancel</button>
  `;
  document.getElementById('customModal').style.display = 'flex';
}

async function submitFormData() {
  if (!pendingFormSubmission) return;
  const { assignId, candName, data } = pendingFormSubmission;
  document.getElementById('modalTitle').innerText = "Submitting...";
  document.getElementById('modalMessage').innerHTML = "<p>Please wait while we save your reference...</p>";
  document.querySelector('.modal-footer').innerHTML = ``;
  data.assignmentId = assignId; 
  const res = await apiCall('submitForm', { formData: data, username: currentUser.name, assignmentId: assignId });
  if(res.success) {
    showModal("Success", "Form submitted successfully! HR has been notified.");
    showModule('form', document.getElementById('nav-form'));
  } else { showModal("Error", res.message); }
}

// --- ADMIN MODULE ---
function getAdminHTML() {
  var html = '<div class="card"><h3>Global System Settings</h3>';
  html += '<div class="input-group"><label>System Login URL (Used in Email Button)</label><input type="text" id="defLoginUrl" value="' + defaultSettings.loginUrl + '" placeholder="https://..."></div>';
  html += '<div class="input-group"><label>Default Reply-To Email</label><input type="email" id="defReplyTo" value="' + defaultSettings.reply + '"></div>';
  html += '<div class="input-group"><label>Default BCC Email</label><input type="email" id="defBcc" value="' + defaultSettings.bcc + '"></div>';
  html += '<button onclick="saveDefSettings()" class="btn btn-primary" style="margin-bottom:20px;">Save Settings</button>';
  html += '<hr style="margin:20px 0; border:0; border-top:1px solid #eee;"><h4>Logo Configuration</h4>';
  html += '<div class="input-group"><label>Global Logo URL</label><div style="display:flex; gap:10px;"><input type="text" id="globalLogoUrl" placeholder="https://..."><button onclick="saveGlobalLogo()" class="btn btn-primary" style="width:auto;">Save</button></div></div>';
  html += '<label>Or Upload Logo File:</label><input type="file" id="logoInput" accept="image/*" onchange="resizeAndUploadLogo()"></div>';
  html += '<div class="card"><h3>User Management</h3><div id="userManagementTable">Loading users...</div></div>';
  html += '<div class="card"><h3>Create New User & Permissions</h3>';
  html += '<div class="input-group"><label>Staff Name (Full Name)</label><input type="text" id="newStaffName" placeholder="e.g. John Doe"></div>';
  html += '<div class="input-group"><label>Role</label><select id="newRole" onchange="togglePerms()"><option value="HR">HR</option><option value="Referee">Referee</option><option value="Admin">Admin</option></select></div>';
  html += '<div class="input-group"><label>Username (System Login)</label><input type="text" id="newUser"></div>';
  html += '<div class="input-group"><label>Password</label><input type="password" id="newPass"></div>';
  html += '<div class="input-group"><label>Email</label><input type="email" id="newEmail"></div>';
  html += '<div class="input-group"><label>Access Expiry Date (Optional)</label><input type="date" id="newExpiry"></div>';
  html += '<div id="permSection" style="display:block; background:#f9f9f9; padding:15px; border-radius:5px; margin-bottom:15px;">';
  html += '<label style="font-weight:bold; color:var(--isd-teal); margin-bottom:10px; display:block;">Access Control Matrix (HR Role Only):</label>';
  html += '<table style="width:100%; font-size:14px; border-collapse:collapse;"><tr style="border-bottom:1px solid #ddd;"><th style="text-align:left; padding:5px;">Module</th><th style="text-align:left; padding:5px;">Access Allowed</th></tr>';
  html += '<tr><td style="padding:5px;">Dashboard</td><td><input type="checkbox" value="Dashboard" class="perm-check" checked></td></tr>';
  html += '<tr><td style="padding:5px;">Send Email</td><td><input type="checkbox" value="SendEmail" class="perm-check" checked></td></tr>';
  html += '<tr><td style="padding:5px;">Manage Referees</td><td><input type="checkbox" value="ManageReferees" class="perm-check" checked></td></tr>';
  html += '<tr><td style="padding:5px;">Candidate Overview</td><td><input type="checkbox" value="CandidateOverview" class="perm-check" checked></td></tr>';
  html += '<tr><td style="padding:5px;">Admin Settings</td><td><input type="checkbox" value="Admin" class="perm-check"></td></tr>';
  html += '</table></div><button onclick="createNewUser()" class="btn btn-primary">Create User</button></div>';
  setTimeout(loadUserManagementTable, 100);
  return html;
}

async function loadUserManagementTable() {
  const users = await apiCall('getAllUsers');
  if(!users) return;
  let html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:14px;">';
  html += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:10px;">Staff Name</th><th style="padding:10px;">Username</th><th style="padding:10px;">Role</th><th style="padding:10px;">Email</th><th style="padding:10px;">Access Expiry</th><th style="padding:10px;">Status</th><th style="padding:10px;">Actions</th></tr>'; 
  
  users.forEach(u => {
    let statusColor = u.status === 'Active' ? '#38D430' : '#FF5C35';
    let toggleText = u.status === 'Active' ? 'Deactivate' : 'Activate';
    let expiryText = u.expiry; let expiryColor = "#333";
    if (u.expiry !== "No Expiry") { let expDate = new Date(u.expiry); let today = new Date(); today.setHours(0,0,0,0); if (expDate < today) { expiryColor = "#FF5C35"; expiryText += " (Expired)"; } } else { expiryColor = "#777"; }

    html += '<tr style="border-bottom:1px solid #eee;">';
    html += '<td style="padding:10px; font-weight:bold;">' + (u.staffName || 'N/A') + '</td>';
    html += '<td style="padding:10px;">' + u.username + '</td>';
    html += '<td style="padding:10px;">' + u.role + '</td>';
    html += '<td style="padding:10px;">' + u.email + '</td>';
    html += '<td style="padding:10px; color:' + expiryColor + '; font-weight:bold;">' + expiryText + '</td>';
    html += '<td style="padding:10px; color:' + statusColor + '; font-weight:bold;">' + u.status + '</td>';
    html += '<td style="padding:10px; display:flex; gap:5px; flex-wrap:wrap;">';
    html += '<button onclick="editUserDetails(\'' + u.username + '\', \'' + (u.staffName || '') + '\', \'' + u.role + '\', \'' + u.expiry + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-yellow); color:#333;">Edit</button>';
    html += '<button onclick="toggleUser(\'' + u.username + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-teal);">' + toggleText + '</button>';
    html += '<button onclick="adminResetPass(\'' + u.username + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-yellow); color:#333;">Reset Pass</button>';
    html += '<button onclick="deleteSystemUser(\'' + u.username + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-red);">Delete</button>';
    html += '</td></tr>';
  });
  html += '</table></div>';
  document.getElementById('userManagementTable').innerHTML = html;
}

function editUserDetails(username, currentName, currentRole, currentExpiry) {
  let dateValue = "";
  if (currentExpiry && currentExpiry !== "No Expiry" && !currentExpiry.includes("(Expired)")) {
    try { let d = new Date(currentExpiry); dateValue = d.toISOString().split('T')[0]; } catch(e) {}
  }
  document.getElementById('modalTitle').innerText = "Edit User Details";
  document.getElementById('modalMessage').innerHTML = `
    <p>Editing account for: <b>${username}</b></p>
    <div class="input-group" style="margin-top:15px;"><label>Staff Name</label><input type="text" id="editStaffNameInput" value="${currentName}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;"></div>
    <div class="input-group"><label>Role</label><select id="editRoleInput" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;"><option value="Admin" ${currentRole === 'Admin' ? 'selected' : ''}>Admin</option><option value="HR" ${currentRole === 'HR' ? 'selected' : ''}>HR</option><option value="Referee" ${currentRole === 'Referee' ? 'selected' : ''}>Referee</option></select></div>
    <div class="input-group"><label>Access Expiry Date (Leave blank for No Expiry)</label><input type="date" id="editExpiryInput" value="${dateValue}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;"></div>
  `;
  document.querySelector('.modal-footer').innerHTML = `
    <button class="btn btn-primary" onclick="saveUserDetails('${username}')" style="width:auto; margin-right:10px;">Save Changes</button>
    <button class="btn btn-primary" onclick="closeModal()" style="width:auto; background-color:#777;">Cancel</button>
  `;
  document.getElementById('customModal').style.display = 'flex';
}

async function saveUserDetails(username) {
  const newName = document.getElementById('editStaffNameInput').value.trim();
  const newRole = document.getElementById('editRoleInput').value;
  const newExpiry = document.getElementById('editExpiryInput').value;
  if(!newName) return showModal("Error", "Staff Name cannot be empty.");
  const res = await apiCall('updateUserDetails', { username: username, newStaffName: newName, newRole: newRole, newExpiry: newExpiry });
  if(res.success) { closeModal(); showModal("Success", res.message); loadUserManagementTable(); } else { showModal("Error", res.message); }
}

async function toggleUser(username) {
  const res = await apiCall('toggleUserStatus', { username: username });
  showModal("Status Updated", res.message);
  if(document.getElementById('userManagementTable')) loadUserManagementTable();
  if(document.getElementById('refereeManagementTable')) loadRefereeManagementTable();
}

async function adminResetPass(username) {
  if(!confirm("Reset password for " + username + "? A new password will be emailed to them.")) return;
  const res = await apiCall('adminResetPassword', { username: username });
  showModal("Password Reset", res.message);
}

async function deleteSystemUser(username) {
  if(!confirm("Are you sure you want to permanently delete " + username + "? This cannot be undone.")) return;
  const res = await apiCall('deleteUser', { username: username });
  showModal("User Deleted", res.message);
  loadUserManagementTable();
}

function togglePerms() { document.getElementById('permSection').style.display = document.getElementById('newRole').value === 'Referee' ? 'none' : 'block'; }
async function saveGlobalLogo() { const url = document.getElementById('globalLogoUrl').value; await apiCall('saveLogo', { url: url }); showModal("Success", "Logo URL saved!"); }
async function saveDefSettings() { 
  const reply = document.getElementById('defReplyTo').value; const bcc = document.getElementById('defBcc').value; const login = document.getElementById('defLoginUrl').value;
  await apiCall('saveSettings', { replyTo: reply, bcc: bcc, loginUrl: login });
  defaultSettings = { reply: reply, bcc: bcc, loginUrl: login };
  showModal("Success", "Settings saved!");
}

function resizeAndUploadLogo() {
  const file = document.getElementById('logoInput').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400; const scale = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH; canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      apiCall('uploadLogo', { base64Data: canvas.toDataURL('image/png') }).then(url => {
        document.getElementById('headerLogo').src = url; showModal("Success", "Logo uploaded successfully!");
      });
    }; img.src = e.target.result;
  }; reader.readAsDataURL(file);
}

async function createNewUser() {
  const role = document.getElementById('newRole').value;
  const staffName = document.getElementById('newStaffName').value;
  if(!staffName) return showModal("Error", "Please enter the Staff Name.");
  let perms = "";
  if(role !== 'Referee') {
    const checks = document.querySelectorAll('.perm-check:checked');
    perms = Array.from(checks).map(c => c.value).join(",");
  }
  const res = await apiCall('createUser', { username: document.getElementById('newUser').value, password: document.getElementById('newPass').value, role: role, email: document.getElementById('newEmail').value, expiryDate: document.getElementById('newExpiry').value, permissions: perms, staffName: staffName });
  showModal("System Message", res.message);
  if(res.success) { 
    document.getElementById('newStaffName').value = ''; document.getElementById('newUser').value = ''; document.getElementById('newPass').value = ''; document.getElementById('newEmail').value = ''; 
    loadUserManagementTable();
  }
}
