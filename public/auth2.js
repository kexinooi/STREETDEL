// ===== Parse JWT =====
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch (e) {
    return null;
  }
}

function displayEmail() {
  const token = localStorage.getItem("token"); // this is just email
  const emailSpan = document.getElementById("displayEmail");
  if (!emailSpan) return false;

  const lastActivity = Number(localStorage.getItem("lastActivity"));
  const now = Date.now();

  // If no token or inactive for 5 minutes, clear storage and return false
  if (!token || !lastActivity || now - lastActivity > 5 * 60 * 1000) {
    localStorage.clear();
    emailSpan.textContent = "";
    return false;
  }

  // Token is valid → display email
  emailSpan.textContent = token; // token IS the email in your current setup
  return true;
}

// ===== Update LOGIN / LOGOUT link =====
function updateAuthLinkText() {
  const authLink = document.getElementById("authLink");
  if (!authLink) return;

  authLink.textContent = localStorage.getItem("token") ? "LOGOUT" : "LOGIN";
}

// ===== Setup Auth Link Click =====
function setupAuthLink() {
  const authLink = document.getElementById("authLink");
  if (!authLink) return;

  authLink.addEventListener("click", (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    if (token) {
      // Logout
      localStorage.removeItem("token");
      displayEmail(); // clear email
      updateAuthLinkText(); // update link text
    } else {
      // Go to login page
      window.location.href = "loginPage.html";
    }
  });
}

// ===== Profile Icon Click =====
// Define first
function setupProfileRedirect() {
  const profileIcon = document.getElementById("profileIcon");
  if (!profileIcon) return;

  profileIcon.addEventListener("click", () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token) {
      window.location.href = "/loginPage.html";
      return;
    }

    if (role === "user") {
      window.location.href = "/user/user-dashboard.html";
    } else if (role === "vendor") {
      window.location.href = "/vendor/vendor-dashboard.html";
    } else {
      window.location.href = "/loginPage.html";
    }
  });
}

// Then call after DOM loaded
document.addEventListener("DOMContentLoaded", () => {
  setupProfileRedirect();
});

// ===== Handle Menu Click =====
function setupMenuButton() {
  const menuBtn = document.querySelector(".nav-icon");
  if (!menuBtn) return;

  menuBtn.addEventListener("click", () => {
    displayEmail(); // refresh email display
    updateAuthLinkText(); // refresh LOGIN/LOGOUT link
  });
}

// ===== Run on Page Load =====
window.addEventListener("DOMContentLoaded", () => {
  displayEmail();
  updateAuthLinkText();
  setupAuthLink();
  setupProfileRedirect();
  setupMenuButton();
});

// ===== Optional: Listen for token changes (multi-tab) =====
window.addEventListener("storage", (event) => {
  if (event.key === "token") {
    displayEmail();
    updateAuthLinkText();
  }
});
