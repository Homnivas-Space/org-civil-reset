// Plain vanilla JS SPA — no framework, no build step. Functional shell only;
// swap styles.css / this markup for your real design whenever that's ready.

const state = {
  screen: "start",
  applicantId: null,
  error: null,
  dashboard: null,
  paymentInfo: null,
};

function setState(patch) {
  Object.assign(state, patch);
  render();
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]); // strip "data:...;base64,"
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- navigation -------------------------------------------------------

function showStart() {
  setState({ screen: "start", error: null });
}
function showKyc() {
  setState({ screen: "kyc-form", error: null });
}
function showLogin() {
  setState({ screen: "login-form", error: null });
}
async function showDashboard() {
  setState({ screen: "dashboard", error: null, dashboard: null });
  try {
    const data = await api("/api/dashboard");
    setState({ dashboard: data });
  } catch (err) {
    setState({ error: err.message });
  }
}
function showUpload() {
  setState({ screen: "upload-cibil", error: null });
}
function showIncome() {
  setState({ screen: "income-form", error: null });
}
async function showPayment() {
  setState({ screen: "payment", error: null, paymentInfo: null });
  try {
    const data = await api("/api/payment/info");
    setState({ paymentInfo: data });
  } catch (err) {
    setState({ error: err.message });
  }
}
function showDocuments() {
  setState({ screen: "documents", error: null });
}

// --- actions ------------------------------------------------------------

async function submitKyc(form) {
  const fd = new FormData(form);
  try {
    const data = await api("/api/kyc/submit", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        dob: fd.get("dob"),
        pan: fd.get("pan"),
        aadhaar: fd.get("aadhaar") || undefined,
        mobile: fd.get("mobile") || undefined,
      }),
    });
    setState({ applicantId: data.applicantId, screen: "otp", error: null });
  } catch (err) {
    setState({ error: err.message });
  }
}

async function submitLogin(form) {
  const fd = new FormData(form);
  try {
    const data = await api("/api/auth/login/start", {
      method: "POST",
      body: JSON.stringify({ pan: fd.get("pan"), dob: fd.get("dob") }),
    });
    if (!data.applicantId) {
      setState({ error: "No application found for that PAN and date of birth" });
      return;
    }
    setState({ applicantId: data.applicantId, screen: "otp", error: null });
  } catch (err) {
    setState({ error: err.message });
  }
}

async function submitOtp(form) {
  const fd = new FormData(form);
  try {
    await api("/api/auth/login/verify", {
      method: "POST",
      body: JSON.stringify({ applicantId: state.applicantId, otp: fd.get("otp") }),
    });
    await showDashboard();
  } catch (err) {
    setState({ error: err.message });
  }
}

async function submitCibil() {
  const input = document.getElementById("cibilFile");
  const file = input && input.files[0];
  if (!file) {
    setState({ error: "Choose a PDF first" });
    return;
  }
  const btn = document.getElementById("cibilBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Parsing…";
  }
  try {
    await api("/api/cibil/upload", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
    await showDashboard();
  } catch (err) {
    setState({ error: err.message });
  }
}

async function submitIncome(form) {
  const fd = new FormData(form);
  try {
    await api("/api/income/declare", {
      method: "POST",
      body: JSON.stringify({
        monthlyIncome: Number(fd.get("monthlyIncome")),
        monthlyEmi: Number(fd.get("monthlyEmi")),
      }),
    });
    await showDashboard();
  } catch (err) {
    setState({ error: err.message });
  }
}

async function submitPayment(form) {
  const fd = new FormData(form);
  try {
    await api("/api/payment/submit", {
      method: "POST",
      body: JSON.stringify({ utr: fd.get("utr") }),
    });
    await showDashboard();
  } catch (err) {
    setState({ error: err.message });
  }
}

async function submitDocument(kind) {
  const input = document.getElementById(`doc-${kind}`);
  const file = input && input.files[0];
  if (!file) {
    setState({ error: `Choose a ${kind} file first` });
    return;
  }
  const statusEl = document.getElementById(`doc-status-${kind}`);
  if (statusEl) statusEl.textContent = "Uploading…";
  try {
    const contentBase64 = await fileToBase64(file);
    await api("/api/documents/upload", {
      method: "POST",
      body: JSON.stringify({ kind, filename: file.name, contentBase64 }),
    });
    if (statusEl) statusEl.textContent = "Sent ✓";
  } catch (err) {
    setState({ error: err.message });
  }
}

// --- rendering ------------------------------------------------------------

function errorHtml() {
  return state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : "";
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function screenStart() {
  return `
    <h1>Homnivas</h1>
    <p class="sub">CIBIL reset &amp; card program</p>
    <div class="card">
      <button onclick="showKyc()">Start a new application</button>
      <button class="secondary" onclick="showLogin()">I already applied — log in</button>
    </div>
  `;
}

function screenKyc() {
  return `
    <h1>New application</h1>
    <p class="sub">Basic details to get started</p>
    <div class="card">
      <form id="kycForm">
        <label>Full name</label>
        <input name="name" required />
        <label>Email</label>
        <input name="email" type="email" required />
        <label>Date of birth</label>
        <input name="dob" type="date" required />
        <label>PAN</label>
        <input name="pan" required maxlength="10" style="text-transform:uppercase" />
        <label>Aadhaar (optional)</label>
        <input name="aadhaar" maxlength="12" />
        <label>Mobile (optional)</label>
        <input name="mobile" type="tel" />
        <button type="submit">Continue</button>
      </form>
      ${errorHtml()}
    </div>
    <button class="link" onclick="showStart()">Back</button>
  `;
}

function screenLogin() {
  return `
    <h1>Log in</h1>
    <p class="sub">Enter the PAN and date of birth you applied with</p>
    <div class="card">
      <form id="loginForm">
        <label>PAN</label>
        <input name="pan" required maxlength="10" style="text-transform:uppercase" />
        <label>Date of birth</label>
        <input name="dob" type="date" required />
        <button type="submit">Send code</button>
      </form>
      ${errorHtml()}
    </div>
    <button class="link" onclick="showStart()">Back</button>
  `;
}

function screenOtp() {
  return `
    <h1>Enter the code</h1>
    <p class="sub">Emailed a 6-digit code — expires in 10 minutes</p>
    <div class="card">
      <form id="otpForm">
        <label>Code</label>
        <input name="otp" required maxlength="6" inputmode="numeric" />
        <button type="submit">Verify</button>
      </form>
      ${errorHtml()}
    </div>
    <button class="link" onclick="showStart()">Start over</button>
  `;
}

function screenDashboard() {
  if (!state.dashboard) {
    return `<h1>Loading…</h1>${errorHtml()}`;
  }
  const { applicant, cibilReport, income, application } = state.dashboard;
  const stages = ["account_opened", "payment_submitted", "payment_done", "card_received", "active"];
  const stageLabels = ["Account opened", "Payment submitted (pending review)", "Payment confirmed", "Card received", "Active"];
  const currentIdx = application ? stages.indexOf(application.status) : -1;

  return `
    <h1>Hi, ${escapeHtml(applicant.name)}</h1>
    <p class="sub">${escapeHtml(applicant.pan_masked)} · ${escapeHtml(applicant.email)}</p>

    <div class="card">
      <div class="stages">
        ${stages.map((_, i) => `<div class="stage ${i <= currentIdx ? "done" : ""}"></div>`).join("")}
      </div>
      <div class="stage-label">${application ? stageLabels[currentIdx] ?? application.status : "No application record"}</div>
      ${
        application && application.status === "account_opened"
          ? `<button onclick="showPayment()">Pay ₹${(application.capital_allocation_amount ?? 10000) + (application.professional_retainer_amount ?? 6000)}</button>`
          : ""
      }
    </div>

    <div class="card">
      <strong>CIBIL report</strong>
      ${
        cibilReport
          ? `
        <div class="row"><span class="k">Score</span><span>${cibilReport.score ?? "—"}</span></div>
        <div class="row"><span class="k">Active loans</span><span>${cibilReport.active_loans ?? "—"}</span></div>
        <div class="row"><span class="k">Overdue</span><span>${cibilReport.overdue_count ?? "—"}</span></div>
        <div class="row"><span class="k">Inquiries (6m)</span><span>${cibilReport.inquiries_last_6m ?? "—"}</span></div>
        <div class="row"><span class="k">Write-off/settled</span><span>${cibilReport.has_writeoff_or_settled ? "Yes" : "No"}</span></div>
        <p class="summary">${escapeHtml(cibilReport.ai_summary ?? "")}</p>
        <button class="secondary" onclick="showUpload()">Upload a newer report</button>
      `
          : `
        <p class="sub">No report uploaded yet</p>
        <button onclick="showUpload()">Upload CIBIL report (PDF)</button>
      `
      }
    </div>

    <div class="card">
      <strong>Income</strong>
      ${
        income
          ? `
        <div class="row"><span class="k">Monthly income</span><span>₹${income.monthly_income}</span></div>
        <div class="row"><span class="k">Monthly EMI</span><span>₹${income.monthly_emi}</span></div>
        <button class="secondary" onclick="showIncome()">Update</button>
      `
          : `
        <p class="sub">Not entered yet</p>
        <button onclick="showIncome()">Enter income &amp; EMI</button>
      `
      }
    </div>

    <div class="card">
      <strong>KYC documents</strong>
      <p class="sub">PAN, Aadhaar, and a selfie — sent for manual verification, never stored here</p>
      <button class="secondary" onclick="showDocuments()">Upload documents</button>
    </div>
    ${errorHtml()}
  `;
}

function screenUpload() {
  return `
    <h1>Upload CIBIL report</h1>
    <p class="sub">PDF only. Nothing is stored — parsed, then discarded.</p>
    <div class="card">
      <input type="file" id="cibilFile" accept="application/pdf" />
      <button onclick="submitCibil()" id="cibilBtn">Upload &amp; parse</button>
      ${errorHtml()}
    </div>
    <button class="link" onclick="showDashboard()">Back</button>
  `;
}

function screenIncome() {
  return `
    <h1>Income &amp; EMI</h1>
    <div class="card">
      <form id="incomeForm">
        <label>Monthly income (₹)</label>
        <input name="monthlyIncome" type="number" required />
        <label>Monthly EMI outgo (₹)</label>
        <input name="monthlyEmi" type="number" required />
        <button type="submit">Save</button>
      </form>
      ${errorHtml()}
    </div>
    <button class="link" onclick="showDashboard()">Back</button>
  `;
}

function screenPayment() {
  if (!state.paymentInfo) {
    return `<h1>Loading…</h1>${errorHtml()}`;
  }
  const { upiId, capitalAllocation, professionalRetainer, total } = state.paymentInfo;
  return `
    <h1>Payment</h1>
    <p class="sub">Pay via UPI, then submit the reference number below</p>
    <div class="card">
      <div class="row"><span class="k">Capital allocation</span><span>₹${capitalAllocation}</span></div>
      <div class="row"><span class="k">Professional retainer</span><span>₹${professionalRetainer}</span></div>
      <div class="row"><span class="k"><strong>Total</strong></span><span><strong>₹${total}</strong></span></div>
      <label>Pay to this UPI ID</label>
      <input value="${escapeHtml(upiId)}" readonly onclick="this.select()" />
    </div>
    <div class="card">
      <form id="paymentForm">
        <label>UPI transaction reference (UTR)</label>
        <input name="utr" required placeholder="From your payment app's transaction history" />
        <button type="submit">I've paid — submit reference</button>
      </form>
      ${errorHtml()}
    </div>
    <button class="link" onclick="showDashboard()">Back</button>
  `;
}

function screenDocuments() {
  const docs = [
    { kind: "pan", label: "PAN card photo" },
    { kind: "aadhaar", label: "Aadhaar card photo" },
    { kind: "selfie", label: "Selfie" },
  ];
  return `
    <h1>KYC documents</h1>
    <p class="sub">Each file is emailed for manual verification and never stored here</p>
    ${docs
      .map(
        (d) => `
      <div class="card">
        <label>${d.label}</label>
        <input type="file" id="doc-${d.kind}" accept="image/*" />
        <button onclick="submitDocument('${d.kind}')">Send</button>
        <p class="sub" id="doc-status-${d.kind}"></p>
      </div>
    `
      )
      .join("")}
    ${errorHtml()}
    <button class="link" onclick="showDashboard()">Back</button>
  `;
}

function render() {
  const root = document.getElementById("app");
  const screens = {
    start: screenStart,
    "kyc-form": screenKyc,
    "login-form": screenLogin,
    otp: screenOtp,
    dashboard: screenDashboard,
    "upload-cibil": screenUpload,
    "income-form": screenIncome,
    payment: screenPayment,
    documents: screenDocuments,
  };
  root.innerHTML = (screens[state.screen] || screenStart)();

  const kycForm = document.getElementById("kycForm");
  if (kycForm) kycForm.addEventListener("submit", (e) => { e.preventDefault(); submitKyc(kycForm); });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", (e) => { e.preventDefault(); submitLogin(loginForm); });

  const otpForm = document.getElementById("otpForm");
  if (otpForm) otpForm.addEventListener("submit", (e) => { e.preventDefault(); submitOtp(otpForm); });

  const incomeForm = document.getElementById("incomeForm");
  if (incomeForm) incomeForm.addEventListener("submit", (e) => { e.preventDefault(); submitIncome(incomeForm); });

  const paymentForm = document.getElementById("paymentForm");
  if (paymentForm) paymentForm.addEventListener("submit", (e) => { e.preventDefault(); submitPayment(paymentForm); });
}

render();
