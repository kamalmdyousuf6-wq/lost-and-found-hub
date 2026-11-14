(function () {
  "use strict";

  const form = document.getElementById("contactAdminForm");
  if (!form) return;

  const itemInput = document.getElementById("item");
  const queryItem = new URLSearchParams(window.location.search).get("item");

  if (queryItem) {
    itemInput.value = queryItem;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const feedback = form.querySelector(".form-feedback");
    const submitButton = form.querySelector('button[type="submit"]');

    const savedSession = sessionStorage.getItem("lfh_user");

    if (!savedSession) {
      LFH.setFeedback(feedback, "Please sign in before submitting.", true);
      return;
    }

    try {
      const session = JSON.parse(savedSession);

      if (!session.token) {
        throw new Error("Please sign in again.");
      }

      const itemReference = data.get("item").trim();
      const itemId = Number(itemReference.match(/\d+$/)?.[0]);

      if (!itemId) {
        throw new Error("Please select a valid item.");
      }

      const itemType =
        new URLSearchParams(window.location.search).get("type");

      if (!["lost", "found"].includes(itemType)) {
        throw new Error("Please open the request from an item's details page.");
      }

      const message =
        `${data.get("requestType")}: ${data.get("message").trim()}`;

      submitButton.disabled = true;

      const response = await fetch(
        `${LFH.API_BASE}/items/contact-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.token}`
          },
          body: JSON.stringify({
            lost_item_id: itemType === "lost" ? itemId : null,
            found_item_id: itemType === "found" ? itemId : null,
            message
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not submit request.");
      }

      LFH.setFeedback(
        feedback,
        `Request CR-${result.id} submitted successfully. Administration will review it.`,
        false
      );

      form.reset();

    } catch (error) {
      LFH.setFeedback(feedback, error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });
})();