(function () {
    "use strict";

    document.querySelectorAll("[data-auth-form]").forEach(form => {
        form.addEventListener("submit", async event => {
            event.preventDefault();

            if (!form.reportValidity()) return;

            const kind = form.dataset.authForm;
            const feedback = form.querySelector(".form-feedback");
            const submitButton = form.querySelector('button[type="submit"]');

            const formData = new FormData(form);

            const payload = {
                email: formData.get("email").trim(),
                password: formData.get("password")
            };

            let endpoint = "/auth/login";

            if (kind === "register") {
                endpoint = "/auth/register";
                payload.name = formData.get("name").trim();
            } else if (kind === "admin") {
                endpoint = "/auth/admin/login";
            }

            try {
                submitButton.disabled = true;
                LFH.setFeedback(feedback, "Please wait...");

                const response = await fetch(
                    `${LFH.API_BASE}${endpoint}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload)
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Authentication failed.");
                }

                if (!result.token || !result.user) {
                    throw new Error("Invalid server response.");
                }

                const storageKey = kind === "admin"
                    ? "lfh_admin"
                    : "lfh_user";

                sessionStorage.setItem(
                    storageKey,
                    JSON.stringify(result)
                );

                LFH.setFeedback(
                    feedback,
                    kind === "register"
                        ? "Account created successfully!"
                        : "Login successful! Redirecting...",
                    false
                );

                window.location.href = kind === "admin"
                    ? "admin-dashboard.html"
                    : "browse.html";

            } catch (error) {
                LFH.setFeedback(feedback, error.message, true);
            } finally {
                submitButton.disabled = false;
            }
        });
    });
})();