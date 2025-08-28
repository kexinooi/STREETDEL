export function initSessionCheck(inactivityLimit = 5*60*1000) {
  // Update last activity
  ["mousemove","keydown","click","touchstart"].forEach(event => {
    document.addEventListener(event, () => {
      if (localStorage.getItem("token")) {
        localStorage.setItem("lastActivity", Date.now());
      }
    });
  });

  function forceLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("lastActivity");
    localStorage.removeItem("role");
    alert("Session expired due to inactivity. Please log in again.");
    window.location.href = "/loginPage.html";
  }

  function checkInactivity() {
    const lastActivity = localStorage.getItem("lastActivity");
    if (!lastActivity || Date.now() - lastActivity > inactivityLimit) {
      forceLogout();
    }
  }

  setInterval(checkInactivity, 60*1000); // check every minute
}
