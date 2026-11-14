(function () {
  "use strict";

  const notificationList = document.getElementById("notificationList");
  const feedback = document.getElementById("notificationFeedback");

  if (!notificationList) return;

  const sessionData = sessionStorage.getItem("lfh_user");

  if (!sessionData) {
    notificationList.innerHTML = `
      <p>Please sign in to view your notifications.</p>
      <a class="button button-primary" href="login.html">Sign In</a>
    `;
    return;
  }

  const session = JSON.parse(sessionData);

  function escapeHTML(value) {
    return LFH.escapeHtml(String(value ?? ""));
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";
    return new Date(value).toLocaleString("en-IN");
  }

  async function loadNotifications() {
    try {
      notificationList.innerHTML = "Loading notifications...";

      const response = await fetch(
        `${LFH.API_BASE}/items/notifications`,
        {
          headers: {
            Authorization: `Bearer ${session.token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load notifications.");
      }

      const notifications = result.notifications || [];

      if (!notifications.length) {
        notificationList.innerHTML = `
          <div class="empty-state">
            <span>🔔</span>
            <h2>No notifications yet</h2>
            <p>Updates from campus administration will appear here.</p>
          </div>
        `;
        return;
      }

      notificationList.innerHTML = notifications.map(notification => `
        <div class="card" style="padding:20px;margin-bottom:15px;">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <strong>${notification.is_read ? "Notification" : "New notification"}</strong>
            <span>${notification.is_read ? "Read" : "Unread"}</span>
          </div>

          <p>${escapeHTML(notification.message)}</p>

          <small>${formatDate(notification.created_at)}</small>

          ${notification.is_read ? "" : `
            <div style="margin-top:12px;">
              <button class="button button-primary"
                type="button"
                data-read-id="${escapeHTML(notification.id)}">
                Mark as Read
              </button>
            </div>
          `}
        </div>
      `).join("");

      notificationList.querySelectorAll("[data-read-id]").forEach(button => {
        button.addEventListener("click", () => {
          markAsRead(button.dataset.readId);
        });
      });

    } catch (error) {
      notificationList.innerHTML = `
        <p>Could not load notifications.</p>
      `;
      LFH.setFeedback(feedback, error.message, true);
    }
  }

  async function markAsRead(id) {
    try {
      const response = await fetch(
        `${LFH.API_BASE}/items/notifications/${encodeURIComponent(id)}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not update notification.");
      }

      LFH.setFeedback(feedback, "Notification marked as read.", false);
      loadNotifications();

    } catch (error) {
      LFH.setFeedback(feedback, error.message, true);
    }
  }

  loadNotifications();
})();