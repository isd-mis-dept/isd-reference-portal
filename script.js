const API_URL = "https://script.google.com/macros/s/AKfycbxMp3hM2AKZtzYlYXw2FSPmx_xGIysmLXSNTZqO_y0HO4i7Da8SwsKOQK2VA3ZOxV8V/exec";

let currentUser = null;
let defaultSettings = { reply: "", bcc: "", loginUrl: "" };
let dynamicCandidates = []; 
let currentCaptchaAnswer = 0;

// --- UI HELPERS ---
function showModal(title, message) {
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalMessage').innerHTML = message;
  document.querySelector('.modal-footer').innerHTML = `<button class="btn btn-primary" onclick="closeModal()">OK</button>`;
  document.getElementById('customModal').style.display = 'flex';
}

function showPDFModal(pdfUrl, candidateName) {
  document.getElementById('modalTitle').innerText = "Reference Report: " + candidateName;
  document.getElementById('modalMessage').innerHTML = `
    <iframe src="${pdfUrl}" style="width:100%; height:60vh; border:none; border-radius:4px;"></iframe>
  `;
  document.querySelector('.modal-footer').innerHTML = `
    <a href="${pdfUrl}" target="_blank" download class="btn btn-primary" style="width:auto; text-decoration:none; padding:10px 20px; display:inline-block; margin-right:10px;">Download PDF</a>
    <button class="btn btn-primary" onclick="closeModal()" style="width:auto; background-color:var(--isd-teal);">Close</button>
  `;
  document.querySelector('.modal-box').style.maxWidth = '900px';
  document.getElementById('customModal').style.display = 'flex';
}

function closeModal() { 
  document.getElementById('customModal').style.display = 'none';
  document.querySelector('.modal-box').style.maxWidth = '450px';
}

function showSystemError(err) { showModal("System Alert", err); }

function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  currentCaptchaAnswer = a + b;
  document.getElementById('captchaQuestion').innerText = a + " + " + b + " = ?";
  document.getElementById('captchaInput').value = '';
}

// --- NEW BULLETPROOF API CALLER ---
async function apiCall(action, data = {}) {
  try {
    // 1. Create a single JSON object
    const payload = JSON.stringify({ action: action, ...data });
    
    // 2. Send as text/plain to bypass CORS
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: payload
    });
    
    // 3. Parse the JSON response
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return { success: false, message: "Connection failed: " + error.message };
  }
}

// --- INIT ---
window.onload = async function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
  }

  generateCaptcha(); 
  
  const logoUrl = await apiCall('getLogo');
  if (logoUrl) {
    document.getElementById('loginLogo').src = logoUrl;
    document.getElementById('headerLogo').src = logoUrl;
  }

  const settings = await apiCall('getSettings');
  if(settings) {
    defaultSettings = settings; 
  }
};

function forgotPassword() {
  showModal("Forgot Password", "Please contact the ISD MIS Department at <b>mis@isdbd.org</b> to request a password reset.");
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  
  const userAnswer = parseInt(document.getElementById('captchaInput').value);
  if (userAnswer !== currentCaptchaAnswer) {
    document.getElementById('captchaError').style.display = 'block';
    generateCaptcha(); 
    return;
  }
  document.getElementById('captchaError').style.display = 'none';

  const btn = document.getElementById('loginBtn');
  btn.innerText = "Logging in...";
  btn.disabled = true;
  
  const res = await apiCall('login', {
    username: document.getElementById('username').value,
    password: document.getElementById('password').value
  });

  if (res.success) {
    currentUser = res;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    document.getElementById('userNameDisplay').innerText = res.name + " (" + res.role + ")";
    
    let perms = res.permissions ? res.permissions.split(",") : [];
    if (res.role === 'Admin') perms = ["Dashboard","SendEmail","ManageReferees","Admin"];
    
    if (res.role === 'Referee') {
      document.getElementById('nav-dashboard').style.display = 'none';
      document.getElementById('nav-sendEmail').style.display = 'none';
      document.getElementById('nav-form').style.display = 'block';
      document.getElementById('nav-form').innerText = "My Submissions";
      document.getElementById('nav-admin').style.display = 'none';
      showModule('form', document.getElementById('nav-form'));
    } else {
      document.getElementById('nav-dashboard').style.display = perms.includes("Dashboard") ? 'block' : 'none';
      document.getElementById('nav-sendEmail').style.display = perms.includes("SendEmail") ? 'block' : 'none';
      document.getElementById('nav-form').style.display = perms.includes("ManageReferees") ? 'block' : 'none';
      document.getElementById('nav-admin').style.display = (res.role === 'Admin' || perms.includes("Admin")) ? 'block' : 'none';
      showModule('dashboard', document.getElementById('nav-dashboard'));
    }
  } else {
    showModal("Login Failed", res.message);
    btn.innerText = "Login";
    btn.disabled = false;
    generateCaptcha(); 
  }
}

function logout(e) { 
  if(e) e.preventDefault();
  window.location.reload();
}

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
}

// --- DASHBOARD MODULE ---
async function loadDashboard() {
  const rawData = await apiCall('getDashboardStats');
  
  try {
    if (!rawData) throw new Error("No data received");
    
    let subs = rawData.rawSubmissions || [];
    let assign = rawData.rawAssignments || [];
    
    let totalSubmissions = subs.length;
    let pending = 0;
    
    for (let i = 0; i < assign.length; i++) {
      if (assign[i][3] === "Pending") pending++;
    }

    let recent = [];
    let analytics = { classroom: {Excellent:0, Good:0, Satisfactory:0}, recommendation: {Highly:0, Recommended:0, Not:0} };
    let count = 0;
    
    for (let i = subs.length - 1; i >= 0; i--) {
      try {
        let data = JSON.parse(subs[i][2]);
        
        if(data.classroom) analytics.classroom[data.classroom] = (analytics.classroom[data.classroom] || 0) + 1;
        if(data.recommendation) {
          if(data.recommendation.includes("Highly")) analytics.recommendation.Highly++;
          else if(data.recommendation.includes("Not")) analytics.recommendation.Not++;
          else analytics.recommendation.Recommended++;
        }
        
        if (count < 5) {
          recent.push({ 
            date: subs[i][0], 
            candidate: data.candidateName || "Unknown", 
            referee: data.refereeName || "Unknown", 
            pdf: subs[i][3], 
            recommendation: data.recommendation || "N/A" 
          });
          count++;
        }
      } catch(e) { }
    }

    let html = '<h2 style="margin-bottom:20px; color:var(--isd-teal);">System Overview</h2>';
    
    html += '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:30px;">';
    html += '<div class="card" style="border-top-color:#38D430; text-align:center;"><h1 style="font-size:36px; color:#38D430; margin:0;">' + totalSubmissions + '</h1><p style="color:#777; font-weight:bold;">Completed References</p></div>';
    html += '<div class="card" style="border-top-color:#FFDA00; text-align:center;"><h1 style="font-size:36px; color:#FFDA00; margin:0;">' + pending + '</h1><p style="color:#777; font-weight:bold;">Pending Requests</p></div>';
    html += '</div>';

    html += '<div class="card"><h3>Reference Insights</h3>';
    html += '<p style="margin-bottom:15px; color:#666;">Based on ' + totalSubmissions + ' total submissions.</p>';
    html += '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">';
    html += '<div><h4 style="color:var(--isd-teal);">Classroom Management</h4><p>Excellent: <b>' + analytics.classroom.Excellent + '</b></p><p>Good: <b>' + analytics.classroom.Good + '</b></p><p>Satisfactory: <b>' + analytics.classroom.Satisfactory + '</b></p></div>';
    html += '<div><h4 style="color:var(--isd-teal);">Overall Recommendation</h4><p>Highly Recommended: <b>' + analytics.recommendation.Highly + '</b></p><p>Recommended: <b>' + analytics.recommendation.Recommended + '</b></p><p>Not Recommended: <b>' + analytics.recommendation.Not + '</b></p></div>';
    html += '</div></div>';

    html += '<div style="display:flex; gap:15px; margin-bottom:30px; flex-wrap:wrap;">';
    html += '<button onclick="downloadCSV()" class="btn btn-primary" style="width:auto;">📥 Export Submissions (CSV)</button>';
    html += '<button onclick="loadAuditLogs()" class="btn btn-primary" style="width:auto; background-color:var(--isd-teal);">📋 View Audit Trail</button>';
    html += '</div>';

    html += '<div class="card"><h3>Recent Submissions</h3><div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;">';
    html += '<tr style="background:#f4f4f4; text-align:left;"><th style="padding:10px; border-bottom:2px solid #ddd;">Date</th><th style="padding:10px; border-bottom:2px solid #ddd;">Candidate</th><th style="padding:10px; border-bottom:2px solid #ddd;">Referee</th><th style="padding:10px; border-bottom:2px solid #ddd;">Recommendation</th><th style="padding:10px; border-bottom:2px solid #ddd;">Action</th></tr>';
    if(recent.length === 0) html += '<tr><td colspan="5" style="padding:20px; text-align:center; color:#777;">No submissions yet.</td></tr>';
    recent.forEach(r => {
      let d = new Date(r.date).toLocaleDateString();
      html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">' + d + '</td><td style="padding:10px; font-weight:bold;">' + r.candidate + '</td><td style="padding:10px;">' + r.referee + '</td><td style="padding:10px;">' + r.recommendation + '</td><td style="padding:10px;"><a href="javascript:void(0)" onclick="showPDFModal(\'' + r.pdf + '\', \'' + r.candidate + '\')" style="color:var(--isd-red); font-weight:bold; text-decoration:none;">View PDF</a></td></tr>';
    });
    html += '</table></div></div>';

    html += '<div id="auditArea"></div>';
    document.getElementById('contentArea').innerHTML = html;
    
  } catch (err) {
    document.getElementById('contentArea').innerHTML = '<div class="card"><h3 style="color:red;">Dashboard Error</h3><p>' + err.message + '</p></div>';
  }
}

async function downloadCSV() {
  const csvData = await apiCall('exportCSV');
  if(!csvData) return;
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', 'ISD_References_' + new Date().toISOString().split('T')[0] + '.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function loadAuditLogs() {
  document.getElementById('auditArea').innerHTML = "<p>Loading logs...</p>";
  const logs = await apiCall('getAuditLogs');
  
  let html = '<div class="card"><h3>Audit Trail (Last 50 Emails)</h3><div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">';
  html += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:10px;">Time</th><th style="padding:10px;">Sent By</th><th style="padding:10px;">To</th><th style="padding:10px;">BCC</th><th style="padding:10px;">Subject</th><th style="padding:10px;">Status</th></tr>';
  if(!logs || logs.length === 0) html += '<tr><td colspan="6" style="padding:20px; text-align:center; color:#777;">No email logs found.</td></tr>';
  else {
    logs.forEach(l => {
      html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">' + l.time + '</td><td style="padding:10px;">' + l.sentBy + '</td><td style="padding:10px;">' + l.to + '</td><td style="padding:10px;">' + l.bcc + '</td><td style="padding:10px;">' + l.subject + '</td><td style="padding:10px;"><span style="color:#38D430; font-weight:bold;">' + l.status + '</span></td></tr>';
    });
  }
  html += '</table></div></div>';
  document.getElementById('auditArea').innerHTML = html;
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
  html += '<div class="card"><h3>Assignment Overview</h3><div id="pendingAssignmentsTable">Loading...</div></div>';
  
  document.getElementById('contentArea').innerHTML = html;
  
  const all = await apiCall('getAllAssignments');
  if(!all) return;

  let tHtml = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:14px;">';
  tHtml += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:10px;">Referee (User)</th><th style="padding:10px;">Official Name</th><th style="padding:10px;">Candidate</th><th style="padding:10px;">Status</th><th style="padding:10px;">Action</th></tr>';
  
  let pendingItems = all.filter(a => a.status === 'Pending');
  let submittedItems = all.filter(a => a.status === 'Submitted');
  
  if(pendingItems.length === 0) tHtml += '<tr><td colspan="5" style="padding:10px; text-align:center;">No pending assignments.</td></tr>';
  pendingItems.forEach(p => {
    tHtml += '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">' + p.username + '</td><td style="padding:10px;">' + p.officialName + '</td><td style="padding:10px; font-weight:bold;">' + p.candidate + '</td><td style="padding:10px; color:#FFDA00; font-weight:bold;">Pending</td><td style="padding:10px;"><button onclick="resetRefPassword(\'' + p.username + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:12px; background-color:var(--isd-teal);">Reset Password</button></td></tr>';
  });
  
  if(submittedItems.length > 0) {
    tHtml += '<tr style="background:#eee;"><td colspan="5" style="padding:10px; font-weight:bold; color:var(--isd-teal); cursor:pointer;" onclick="toggleSubmitted()">▼ View Submitted Assignments (' + submittedItems.length + ')</td></tr>';
    tHtml += '<tbody id="submittedRows" style="display:none;">';
    submittedItems.forEach(s => {
      tHtml += '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">' + s.username + '</td><td style="padding:10px;">' + s.officialName + '</td><td style="padding:10px; font-weight:bold;">' + s.candidate + '</td><td style="padding:10px; color:#38D430; font-weight:bold;">Submitted</td><td style="padding:10px;"><a href="javascript:void(0)" onclick="showPDFModal(\'' + s.pdf + '\', \'' + s.candidate + '\')" style="color:var(--isd-red); font-weight:bold;">View PDF</a></td></tr>';
    });
    tHtml += '</tbody>';
  }
  
  tHtml += '</table></div>';
  document.getElementById('pendingAssignmentsTable').innerHTML = tHtml;
}

function toggleSubmitted() {
  let el = document.getElementById('submittedRows');
  el.style.display = el.style.display === 'none' ? 'table-row-group' : 'none';
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
  
  const res = await apiCall('createRefereeAssignment', {
    username: u, officialName: n, email: e, candidates: dynamicCandidates
  });
  
  showModal("Success", res.message);
  loadManageRefereesPage(); 
}

async function resetRefPassword(username) {
  if(!confirm("Are you sure you want to reset the password for " + username + "?")) return;
  const res = await apiCall('resetPassword', { username: username });
  showModal("Password Reset", res.message);
}

// --- SEND EMAIL MODULE ---
async function loadSendEmailPage() {
  const pending = await apiCall('getPendingAssignments');
  
  let html = '<div class="card"><h3>Send Custom Reference Request</h3>';
  html += '<div class="input-group"><label>Select Referee Assignment to Email</label><select id="assignSelect" onchange="populateEmailFields()">';
  html += '<option value="">-- Select a Referee --</option>';
  if(pending) {
    pending.forEach(p => {
      html += '<option value="' + p.id + '" data-name="' + p.officialName + '" data-email="' + p.email + '" data-cand="' + p.candidate + '">' + p.officialName + ' (' + p.candidate + ')</option>';
    });
  }
  html += '</select></div>';

  html += '<div class="input-group"><label>To Email</label><input type="email" id="toEmail"></div>';
  html += '<div class="input-group"><label>Reply-To Email</label><input type="email" id="replyTo" value="' + defaultSettings.reply + '"></div>';
  html += '<div class="input-group"><label>BCC Email</label><input type="email" id="bccEmail" value="' + defaultSettings.bcc + '"></div>';
  html += '<div class="input-group"><label>Subject</label><input type="text" id="emailSubject"></div>';
  html += '<div class="input-group"><label>Email Body (HTML allowed)</label><textarea id="emailBody" rows="8"></textarea></div>';
  html += '<button onclick="sendDynamicEmail()" class="btn btn-primary">Send Email to Referee</button></div>';
  
  document.getElementById('contentArea').innerHTML = html;
}

function populateEmailFields() {
  let sel = document.getElementById('assignSelect');
  let opt = sel.options[sel.selectedIndex];
  if(!opt.value) return;
  
  let rName = opt.getAttribute('data-name');
  let cName = opt.getAttribute('data-cand');
  let rEmail = opt.getAttribute('data-email');
  let formLink = defaultSettings.loginUrl || window.location.href; 
  
  document.getElementById('toEmail').value = rEmail;
  document.getElementById('emailSubject').value = "Reference Request for " + cName;
  
  let body = "Dear <b>" + rName + "</b>,<br><br>";
  body += "We hope this message finds you well. International School Dhaka is currently in the process of reviewing candidates for an open position, and we are reaching out to you as a professional reference for <b>" + cName + "</b>.<br><br>";
  body += "Your insights into their professional strengths and classroom management are invaluable to our selection process. Please take a few moments to complete the confidential reference form linked below:<br><br>";
  body += "<div style='text-align:center; margin: 30px 0;'><a href='" + formLink + "' style='background-color:#004C45; color:white; padding:14px 30px; text-decoration:none; border-radius:4px; font-weight:bold; font-family:Arial;'>Access Reference Form</a></div>";
  body += "Thank you for your time and cooperation.<br><br>";
  body += "Warm regards,<br><b>ISD HR Team</b><br>International School Dhaka";
  
  document.getElementById('emailBody').value = body;
}

async function sendDynamicEmail() {
  const settings = { 
    to: document.getElementById('toEmail').value, 
    replyTo: document.getElementById('replyTo').value, 
    bcc: document.getElementById('bccEmail').value, 
    subject: document.getElementById('emailSubject').value, 
    body: document.getElementById('emailBody').value 
  };
  
  const res = await apiCall('sendEmail', { settings: settings });
  if(res.success) {
    let sel = document.getElementById('assignSelect');
    let opt = sel.options[sel.selectedIndex];
    let cName = opt.getAttribute('data-cand');
    
    showModal("Email Sent Successfully", "The login information and form link have been successfully sent to the referee for <b>" + cName + "</b>.");
    loadSendEmailPage(); 
  } else {
    showModal("Error", res.message);
  }
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
      html += '<td style="padding:10px;"><a href="javascript:void(0)" onclick="showPDFModal(\'' + s.pdf + '\', \'' + s.candidate + '\')" style="color:var(--isd-red); font-weight:bold;">View PDF</a></td>';
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
  
  let html = '<div class="card" style="max-width: 800px; margin: 20px auto;"><h3>Reference Form: ' + candName + '</h3>';
  html += '<form id="refForm" onsubmit="submitForm(event, \'' + assignId + '\', \'' + candName + '\')">';
  html += '<input type="hidden" name="candidateName" value="' + candName + '">';
  html += '<input type="hidden" name="refereeName" value="' + refUser + '">';
  html += '<div class="input-group"><label>How long have you known the candidate?</label><input type="text" name="knownDuration" required></div>';
  html += '<div class="input-group"><label>What subject/grade did you teach them?</label><input type="text" name="subject" required></div>';
  html += '<div class="input-group"><label>Professional Strengths</label><textarea name="strengths" rows="3" required></textarea></div>';
  html += '<div class="input-group"><label>Areas for Improvement</label><textarea name="improvements" rows="3"></textarea></div>';
  html += '<div class="input-group"><label>Classroom Management</label><select name="classroom" required><option>Excellent</option><option>Good</option><option>Satisfactory</option></select></div>';
  html += '<div class="input-group"><label>Overall Recommendation</label><select name="recommendation" required><option>Highly Recommended</option><option>Recommended</option><option>Not Recommended</option></select></div>';
  html += '<button type="submit" class="btn btn-primary">Submit & Lock Form</button></form></div>';
  document.getElementById('activeFormContainer').innerHTML = html;
}

async function submitForm(e, assignId, candName) {
  if(e) e.preventDefault();
  if(!confirm("Are you sure? You cannot edit this form after submission.")) return;
  
  const form = document.getElementById('refForm');
  const data = {};
  for (let i = 0; i < form.elements.length; i++) if (form.elements[i].name) data[form.elements[i].name] = form.elements[i].value;
  
  const res = await apiCall('submitForm', { formData: data, username: currentUser.name, assignmentId: assignId });
  
  if(res.success) {
    showModal("Success", "Form submitted! HR has been notified.");
    showModule('form', document.getElementById('nav-form'));
  }
}

// --- ADMIN MODULE ---
function getAdminHTML() {
  var html = '<div class="card"><h3>Global System Settings</h3>';
  html += '<div class="input-group"><label>System Login URL (Used in Email Button)</label><input type="text" id="defLoginUrl" value="' + defaultSettings.loginUrl + '" placeholder="https://..."></div>';
  html += '<div class="input-group"><label>Default Reply-To Email</label><input type="email" id="defReplyTo" value="' + defaultSettings.reply + '"></div>';
  html += '<div class="input-group"><label>Default BCC Email</label><input type="email" id="defBcc" value="' + defaultSettings.bcc + '"></div>';
  html += '<button onclick="saveDefSettings()" class="btn btn-primary" style="margin-bottom:20px;">Save Settings</button>';
  html += '<hr style="margin:20px 0; border:0; border-top:1px solid #eee;">';
  html += '<h4>Logo Configuration</h4>';
  html += '<div class="input-group"><label>Global Logo URL</label><div style="display:flex; gap:10px;"><input type="text" id="globalLogoUrl" placeholder="https://..."><button onclick="saveGlobalLogo()" class="btn btn-primary" style="width:auto;">Save</button></div></div>';
  html += '<label>Or Upload Logo File:</label><input type="file" id="logoInput" accept="image/*" onchange="resizeAndUploadLogo()"></div>';
  
  html += '<div class="card"><h3>User Management</h3>';
  html += '<div id="userManagementTable">Loading users...</div></div>';

  html += '<div class="card"><h3>Create New User & Permissions</h3>';
  html += '<div class="input-group"><label>Role</label><select id="newRole" onchange="togglePerms()"><option value="HR">HR</option><option value="Referee">Referee</option><option value="Admin">Admin</option></select></div>';
  html += '<div class="input-group"><label>Username / Referee Name</label><input type="text" id="newUser"></div>';
  html += '<div class="input-group"><label>Password</label><input type="password" id="newPass"></div>';
  html += '<div class="input-group"><label>Email</label><input type="email" id="newEmail"></div>';
  html += '<div class="input-group"><label>Access Expiry Date (Optional)</label><input type="date" id="newExpiry"></div>';
  
  html += '<div id="permSection" style="display:block; background:#f9f9f9; padding:15px; border-radius:5px; margin-bottom:15px;">';
  html += '<label style="font-weight:bold; color:var(--isd-teal); margin-bottom:10px; display:block;">Access Control Matrix (HR Role Only):</label>';
  html += '<table style="width:100%; font-size:14px; border-collapse:collapse;">';
  html += '<tr style="border-bottom:1px solid #ddd;"><th style="text-align:left; padding:5px;">Module</th><th style="text-align:left; padding:5px;">Access Allowed</th></tr>';
  html += '<tr><td style="padding:5px;">Dashboard</td><td><input type="checkbox" value="Dashboard" class="perm-check" checked></td></tr>';
  html += '<tr><td style="padding:5px;">Send Email</td><td><input type="checkbox" value="SendEmail" class="perm-check" checked></td></tr>';
  html += '<tr><td style="padding:5px;">Manage Referees</td><td><input type="checkbox" value="ManageReferees" class="perm-check" checked></td></tr>';
  html += '<tr><td style="padding:5px;">Admin Settings</td><td><input type="checkbox" value="Admin" class="perm-check"></td></tr>';
  html += '</table></div>';
  html += '<button onclick="createNewUser()" class="btn btn-primary">Create User</button></div>';
  
  setTimeout(loadUserManagementTable, 100);
  
  return html;
}

async function loadUserManagementTable() {
  const users = await apiCall('getAllUsers');
  if(!users) return;

  let html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:14px;">';
  html += '<tr style="background:var(--isd-teal); color:white; text-align:left;"><th style="padding:10px;">Username</th><th style="padding:10px;">Role</th><th style="padding:10px;">Email</th><th style="padding:10px;">Status</th><th style="padding:10px;">Actions</th></tr>';
  
  users.forEach(u => {
    let statusColor = u.status === 'Active' ? '#38D430' : '#FF5C35';
    let toggleText = u.status === 'Active' ? 'Deactivate' : 'Activate';
    
    html += '<tr style="border-bottom:1px solid #eee;">';
    html += '<td style="padding:10px; font-weight:bold;">' + u.username + '</td>';
    html += '<td style="padding:10px;">' + u.role + '</td>';
    html += '<td style="padding:10px;">' + u.email + '</td>';
    html += '<td style="padding:10px; color:' + statusColor + '; font-weight:bold;">' + u.status + '</td>';
    html += '<td style="padding:10px; display:flex; gap:5px; flex-wrap:wrap;">';
    html += '<button onclick="toggleUser(\'' + u.username + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-teal);">' + toggleText + '</button>';
    html += '<button onclick="adminResetPass(\'' + u.username + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-yellow); color:#333;">Reset Pass</button>';
    html += '<button onclick="deleteSystemUser(\'' + u.username + '\')" class="btn btn-primary" style="padding:5px 10px; width:auto; font-size:11px; background-color:var(--isd-red);">Delete</button>';
    html += '</td></tr>';
  });
  
  html += '</table></div>';
  document.getElementById('userManagementTable').innerHTML = html;
}

async function toggleUser(username) {
  const res = await apiCall('toggleUserStatus', { username: username });
  showModal("Status Updated", res.message);
  loadUserManagementTable();
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

async function saveGlobalLogo() { 
  const url = document.getElementById('globalLogoUrl').value;
  await apiCall('saveLogo', { url: url });
  showModal("Success", "Logo URL saved!");
}

async function saveDefSettings() { 
  const reply = document.getElementById('defReplyTo').value;
  const bcc = document.getElementById('defBcc').value;
  const login = document.getElementById('defLoginUrl').value;
  
  await apiCall('saveSettings', { replyTo: reply, bcc: bcc, loginUrl: login });
  defaultSettings = { reply: reply, bcc: bcc, loginUrl: login };
  showModal("Success", "Settings saved successfully! The email fields have been updated globally.");
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
        document.getElementById('headerLogo').src = url; 
        showModal("Success", "Logo uploaded successfully!");
      });
    }; img.src = e.target.result;
  }; reader.readAsDataURL(file);
}

async function createNewUser() {
  const role = document.getElementById('newRole').value;
  let perms = "";
  if(role !== 'Referee') {
    const checks = document.querySelectorAll('.perm-check:checked');
    perms = Array.from(checks).map(c => c.value).join(",");
  }
  
  const res = await apiCall('createUser', {
    username: document.getElementById('newUser').value,
    password: document.getElementById('newPass').value,
    role: role,
    email: document.getElementById('newEmail').value,
    expiryDate: document.getElementById('newExpiry').value,
    permissions: perms
  });
  
  showModal("System Message", res.message);
  if(res.success) { 
    document.getElementById('newUser').value = ''; 
    document.getElementById('newPass').value = ''; 
    document.getElementById('newEmail').value = ''; 
    loadUserManagementTable(); 
  }
}
