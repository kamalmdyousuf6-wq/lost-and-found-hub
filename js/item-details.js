(function () {
  "use strict";

  const target = document.getElementById("detailsContent");
  if (!target) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const type = params.get("type");

  function showError(message) {
    target.innerHTML = `
      <div class="empty-state">
        <span>📦</span>
        <h2>Item not found</h2>
        <p>${LFH.escapeHtml(message)}</p>
        <a class="button button-secondary" href="browse.html">Back to browse</a>
      </div>`;
  }

  function formatDate(value) {
    if (!value) return "Not available";
    const date = String(value).slice(0, 10);
    return new Date(date + "T00:00:00").toLocaleDateString("en-IN");
  }

  async function loadItemDetails() {
    if (!id || !type || !["lost", "found"].includes(type)) {
      showError("The item link is incomplete.");
      return;
    }

    try {
      const response = await fetch(
        `${LFH.API_BASE}/items/${type}/${encodeURIComponent(id)}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load item details.");
      }

      const item = result.item;
      const possibleMatches = result.possible_matches || [];

      const isFound = item.type === "found";
      const location = item.item_location || "Not available";
      const date = item.item_date;

      const matchContent = possibleMatches.length
  ? `<h3>${possibleMatches.length === 1 ? "Possible match" : "Possible matches"} identified</h3>
     ${possibleMatches.map(match => {
       const title = isFound ? match.lost_title : match.found_title;
       const category = isFound ? match.lost_category : match.found_category;

       return `
         <div class="possible-match">
           <p>
             <strong>${LFH.escapeHtml(title)}</strong>
             (${LFH.escapeHtml(category)})
             — Score: ${LFH.escapeHtml(match.match_score)}%
           </p>
           ${!isFound && ["RECEIVED", "MATCHED"].includes(match.found_status)
             ? `<button class="button button-primary"
                  type="button"
                  data-recovery-found-id="${LFH.escapeHtml(match.found_item_id)}">
                  Request Recovery
                </button>`
             : ""}
         </div>`;
     }).join("")}
     <p>These are automated suggestions. Administration must verify ownership.</p>`
  : `<h3>No possible match listed yet</h3>
     <p>Administration can compare this report against new items as they are received. Check back later.</p>`;

      target.innerHTML = `
        <div class="detail-layout">
          <div class="detail-image blue-bg">
            <span class="detail-emoji" aria-hidden="true">📦</span>
          </div>

          <div class="detail-content">
            <div class="detail-badges">
              <span class="pill ${isFound ? "found" : ""}">
                ${isFound ? "Found item" : "Lost report"}
              </span>
              <span class="pill" style="color:#748196;background:#f1f3f6">
                ${LFH.escapeHtml(item.status)}
              </span>
            </div>

            <h1>${LFH.escapeHtml(item.title)}</h1>

            <span class="detail-category">
              ${LFH.escapeHtml(item.category)} · Ref. ${LFH.escapeHtml(item.id)}
            </span>

            <p class="detail-description">
              ${LFH.escapeHtml(item.description)}
            </p>

            <div class="detail-info-list">
              <div>
                <small>Location</small>
                <strong>${LFH.escapeHtml(location)}</strong>
              </div>
              <div>
                <small>Date ${isFound ? "found" : "lost"}</small>
                <strong>${formatDate(date)}</strong>
              </div>
              <div>
                <small>Report status</small>
                <strong>${LFH.escapeHtml(item.status)}</strong>
              </div>
              <div>
                <small>Managed by</small>
                <strong>Campus administration</strong>
              </div>
            </div>

            <div class="match-panel">
              ${matchContent}
            </div>

            <div class="detail-actions">
              <a class="button button-primary"
                href="contact-admin.html?item=${encodeURIComponent(item.id)}&type=${encodeURIComponent(type)}">
                Contact Administration →
              </a>
              <a class="button button-secondary" href="browse.html">
                Browse more
              </a>
            </div>

            <p class="private-note">
              🔒 User contact details are private. Administration verifies ownership and coordinates every handover.
            </p>
          </div>
        </div>`;
target.querySelectorAll("[data-recovery-found-id]").forEach(button => {
  button.addEventListener("click", async () => {
    const sessionData = sessionStorage.getItem("lfh_user");

    if (!sessionData) {
      alert("Please sign in as a user before requesting recovery.");
      window.location.href = "login.html";
      return;
    }

    const session = JSON.parse(sessionData);
    const message = prompt(
      "Please explain why you believe this item belongs to you:"
    );

    if (!message || !message.trim()) return;

    try {
      button.disabled = true;
      button.textContent = "Submitting...";

      const response = await fetch(
        `${LFH.API_BASE}/items/recovery-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.token}`
          },
          body: JSON.stringify({
            lost_item_id: Number(id),
            found_item_id: Number(button.dataset.recoveryFoundId),
            message: message.trim()
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Recovery request failed.");
      }

      button.textContent = "Recovery Requested";
      alert("Your recovery request has been submitted successfully!");

    } catch (error) {
      button.disabled = false;
      button.textContent = "Request Recovery";
      alert(error.message);
    }
  });
});
    } catch (error) {
      console.error("Item details loading error:", error);
      showError(error.message);
    }
  }

  loadItemDetails();
})();