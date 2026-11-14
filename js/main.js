// Shared Lost & Found Hub helpers
window.LFH = {
    API_BASE: "http://localhost:3000/api",
escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
},
    setFeedback(element, message, isError = false) {
        if (!element) return;

        element.textContent = message;
        element.classList.toggle("error", isError);
        element.classList.toggle("success", !isError);
    }
};

// Navigation and footer
document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");

    if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
            const isExpanded =
                menuToggle.getAttribute("aria-expanded") === "true";

            menuToggle.setAttribute(
                "aria-expanded",
                String(!isExpanded)
            );

            navLinks.classList.toggle("active");
        });
    }

    const yearElement = document.querySelector("[data-current-year]");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});
// Logout functionality
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-logout]").forEach(button => {
        button.addEventListener("click", () => {
            sessionStorage.removeItem("lfh_user");
            sessionStorage.removeItem("lfh_admin");

            window.location.href = "index.html";
        });
    });
});