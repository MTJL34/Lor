const sidebar = document.getElementById("pocSidebar");
const navToggle = document.getElementById("pocNavToggle");
const navClose = document.getElementById("pocNavClose");
const navBackdrop = document.getElementById("pocNavBackdrop");

function setMenuOpen(isOpen) {
  if (!sidebar || !navToggle || !navBackdrop) return;

  sidebar.classList.toggle("is-open", isOpen);
  navBackdrop.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  sidebar.setAttribute("aria-hidden", isOpen ? "false" : "true");
  document.body.classList.toggle("poc-nav-open", isOpen);
}

function toggleMenu() {
  const isOpen = sidebar?.classList.contains("is-open");
  setMenuOpen(!isOpen);
}

if (sidebar && navToggle && navBackdrop) {
  navToggle.addEventListener("click", toggleMenu);
  navClose?.addEventListener("click", () => setMenuOpen(false));
  navBackdrop.addEventListener("click", () => setMenuOpen(false));

  sidebar.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("a")) {
      setMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
    }
  });
}
