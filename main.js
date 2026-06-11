/* ============================================================
   Alberius Hub — Main JS (vanilla, Netlify-safe)
   ============================================================ */

(function () {
  "use strict";

  // Set the footer year
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Highlight active top nav based on current path
  function setActiveNav() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/index.html";
    const base = path.split("/").pop() || "index.html";

    document.querySelectorAll(".nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      const name = href.split("/").pop();
      if (name === base) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  setActiveNav();
  window.addEventListener("popstate", setActiveNav);
})();
