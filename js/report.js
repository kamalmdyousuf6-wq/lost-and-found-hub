(function () {
    "use strict";

    const forms = document.querySelectorAll('[data-report-form="lost"]');

    forms.forEach(form => {
        form.addEventListener("submit", async event => {
            event.preventDefault();

            if (!form.reportValidity()) return;

            const feedback = form.querySelector(".form-feedback");
            const submitButton = form.querySelector('button[type="submit"]');
            const data = new FormData(form);

            const savedSession = sessionStorage.getItem("lfh_user");

            if (!savedSession) {
                LFH.setFeedback(
                    feedback,
                    "Please sign in before submitting a lost-item report.",
                    true
                );
                return;
            }

            let session;

            try {
                session = JSON.parse(savedSession);
            } catch {
                sessionStorage.removeItem("lfh_user");
                LFH.setFeedback(feedback, "Please sign in again.", true);
                return;
            }

            if (!session.token) {
                LFH.setFeedback(feedback, "Please sign in again.", true);
                return;
            }

            const payload = {
                title: data.get("title").trim(),
                category: data.get("category"),
                description: data.get("description").trim(),
                date_lost: data.get("date"),
                location_lost: data.get("location").trim(),
                identifying_details: data.get("identifying").trim(),
                image: null
            };

            try {
                submitButton.disabled = true;
                LFH.setFeedback(feedback, "Submitting your lost-item report...");

                const response = await fetch(
                    `${LFH.API_BASE}/items/lost`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${session.token}`
                        },
                        body: JSON.stringify(payload)
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Could not submit your report.");
                }

                LFH.setFeedback(
                    feedback,
                    `Your lost-item report was submitted successfully. Report ID: ${result.id}`,
                    false
                );

                form.reset();

            } catch (error) {
                LFH.setFeedback(feedback, error.message, true);
            } finally {
                submitButton.disabled = false;
            }
        });
    });
})();