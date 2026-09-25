// Plain vanilla JS SPA — no framework, no build step.
// Visual system matches homnivas.space: light content screens, a dark
// card for the progress tracker (echoing the site's dark "Our Care"
// section), teal accent, check-row lists echoing the landing page's
// checklist style.

const state = {
  screen: "start",
  applicantId: null,
  error: null,
  dashboard: null,
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
    const base = (data && data.error) || `Request failed (${res.status})`;
    const ref = data && data.requestId ? ` (ref: ${data.requestId})` : "";
    throw new Error(base + ref);
  }
  return data;
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
function showOtp() {
  setState({ screen: "otp", error: null });
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
    <div class="screen">
      <div class="eyebrow">CIBIL reset program</div>
      <h1>Step into a safe financial space.</h1>
      <p class="sub">Start a new application, or continue one already in progress.</p>
      <div class="card">
        <button onclick="showKyc()">Start a new application</button>
        <button class="secondary" onclick="showLogin()">I already applied — log in</button>
      </div>
    </div>
  `;
}

function screenKyc() {
  return `
    <div class="screen">
      <div class="eyebrow">Step 1 of 4</div>
      <h1>Your details</h1>
      <p class="sub">Used only to open your account and verify it's you.</p>
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
          <input name="aadhaar" maxlength="12" inputmode="numeric" />
          <label>Mobile (optional)</label>
          <input name="mobile" type="tel" />
          <button type="submit">Continue</button>
        </form>
        ${errorHtml()}
      </div>
      <button class="link" onclick="showStart()">Back</button>
    </div>
  `;
}

function screenLogin() {
  return `
    <div class="screen">
      <div class="eyebrow">Welcome back</div>
      <h1>Log in</h1>
      <p class="sub">Enter the PAN and date of birth you applied with.</p>
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
    </div>
  `;
}

function screenOtp() {
  return `
    <div class="screen">
      <div class="eyebrow">Verify it's you</div>
      <h1>Enter the code</h1>
      <p class="sub">Emailed a 6-digit code — it expires in 10 minutes.</p>
      <div class="card-dark">
        <form id="otpForm">
          <label>Code</label>
          <input name="otp" required maxlength="6" inputmode="numeric" autofocus />
          <button type="submit">Verify</button>
        </form>
        ${errorHtml()}
      </div>
      <button class="link" onclick="showStart()">Start over</button>
    </div>
  `;
}

function stepTrackerHtml(currentIdx) {
  const stages = [
    { key: "account_opened", label: "Account" },
    { key: "payment_done", label: "Payment" },
    { key: "card_received", label: "Card" },
    { key: "active", label: "Active" },
  ];
  return stages
    .map((stage, i) => {
      const cls = i < currentIdx ? "done" : i === currentIdx ? "current" : "";
      const dotContent = i < currentIdx ? "✓" : String(i + 1);
      const line =
        i < stages.length - 1
          ? `<div class="step-line ${i < currentIdx ? "done" : ""}"></div>`
          : "";
      return `<div class="step ${cls}"><div class="dot">${dotContent}</div><div class="step-label">${stage.label}</div></div>${line}`;
    })
    .join("");
}

function screenDashboard() {
  if (!state.dashboard) {
    return `<div class="screen"><h1>Loading…</h1>${errorHtml()}</div>`;
  }
  const { applicant, cibilReport, income, application } = state.dashboard;
  const stageKeys = ["account_opened", "payment_done", "card_received", "active"];
  const currentIdx = application ? stageKeys.indexOf(application.status) : -1;

  return `
    <div class="screen">
      <div class="eyebrow">Your application</div>
      <h1>Hi, ${escapeHtml(applicant.name)}</h1>
      <p class="sub">${escapeHtml(applicant.pan_masked)} · ${escapeHtml(applicant.email)}</p>

      <div class="card-dark">
        <div class="card-title">Progress</div>
        <div class="steps">${stepTrackerHtml(currentIdx)}</div>
      </div>

      <div class="card">
        <div class="card-title">CIBIL report</div>
        ${
          cibilReport
            ? `
          <div class="check-row"><span class="tick">✓</span><span class="k">Score</span><span class="v">${cibilReport.score ?? "—"}</span></div>
          <div class="check-row"><span class="tick">✓</span><span class="k">Active loans</span><span class="v">${cibilReport.active_loans ?? "—"}</span></div>
          <div class="check-row"><span class="tick">✓</span><span class="k">Overdue</span><span class="v">${cibilReport.overdue_count ?? "—"}</span></div>
          <div class="check-row"><span class="tick">✓</span><span class="k">Inquiries (6m)</span><span class="v">${cibilReport.inquiries_last_6m ?? "—"}</span></div>
          <div class="check-row"><span class="tick">✓</span><span class="k">Write-off/settled</span><span class="v">${cibilReport.has_writeoff_or_settled ? "Yes" : "No"}</span></div>
          <p class="summary">${escapeHtml(cibilReport.ai_summary ?? "")}</p>
          <button class="secondary" onclick="showUpload()">Upload a newer report</button>
        `
            : `
          <p class="sub" style="margin-bottom:0">No report uploaded yet</p>
          <button onclick="showUpload()">Upload CIBIL report (PDF)</button>
        `
        }
      </div>

      <div class="card">
        <div class="card-title">Income</div>
        ${
          income
            ? `
          <div class="check-row"><span class="tick">✓</span><span class="k">Monthly income</span><span class="v">₹${income.monthly_income}</span></div>
          <div class="check-row"><span class="tick">✓</span><span class="k">Monthly EMI</span><span class="v">₹${income.monthly_emi}</span></div>
          <button class="secondary" onclick="showIncome()">Update</button>
        `
            : `
          <p class="sub" style="margin-bottom:0">Not entered yet</p>
          <button onclick="showIncome()">Enter income &amp; EMI</button>
        `
        }
      </div>
      ${errorHtml()}
    </div>
  `;
}

function screenUpload() {
  return `
    <div class="screen">
      <div class="eyebrow">CIBIL report</div>
      <h1>Upload your report</h1>
      <p class="sub">PDF only. Nothing is stored — parsed, then discarded.</p>
      <div class="card">
        <label>Report PDF</label>
        <input type="file" id="cibilFile" accept="application/pdf" />
        <button onclick="submitCibil()" id="cibilBtn">Upload &amp; parse</button>
        ${errorHtml()}
      </div>
      <button class="link" onclick="showDashboard()">Back</button>
    </div>
  `;
}

function screenIncome() {
  return `
    <div class="screen">
      <div class="eyebrow">Income &amp; EMI</div>
      <h1>Your monthly numbers</h1>
      <p class="sub">Used to gauge loan eligibility at the final stage.</p>
      <div class="card">
        <form id="incomeForm">
          <label>Monthly income (₹)</label>
          <input name="monthlyIncome" type="number" inputmode="numeric" required />
          <label>Monthly EMI outgo (₹)</label>
          <input name="monthlyEmi" type="number" inputmode="numeric" required />
          <button type="submit">Save</button>
        </form>
        ${errorHtml()}
      </div>
      <button class="link" onclick="showDashboard()">Back</button>
    </div>
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
}

render();
