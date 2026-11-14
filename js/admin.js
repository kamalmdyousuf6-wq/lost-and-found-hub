(function () {
  "use strict";

  const labels = {
    overview: "Overview",
    "lost-reports": "Lost reports",
    "found-items": "Found items received",
    matches: "Possible matches",
    "recovery-requests": "Recovery requests",
    "contact-requests": "Contact requests",
    recovered: "Recovered items",
    users: "Users"
  };

  const records = {
    "lost-reports": [
      ["Navy Blue Backpack", "LF-204", "Aarav Mehta", "Science Building", "Oct 1, 2026", "Open"],
      ["Wireless Earbuds Case", "LF-201", "Mina Shah", "Main Library", "Sep 30, 2026", "Possible match"],
      ["Green Canvas Tote", "LF-198", "Leah Wong", "Student Centre", "Sep 28, 2026", "Open"],
      ["Calculus Textbook", "LF-194", "Noah Patel", "Engineering Hall", "Sep 25, 2026", "Open"]
    ],
    "found-items": [
      ["Silver Water Bottle", "FD-089", "Administration", "Student Centre", "Oct 2, 2026", "Received"],
      ["Black Umbrella", "FD-087", "Administration", "Main Library", "Oct 1, 2026", "Received"],
      ["Student ID Card", "FD-084", "Administration", "Admin Office", "Sep 29, 2026", "Possible match"],
      ["Red Knit Scarf", "FD-082", "Administration", "Arts Building", "Sep 27, 2026", "Received"]
    ],
    matches: [
      ["Wireless Earbuds Case", "LF-201 ↔ FD-091", "Main Library", "Oct 3, 2026", "Needs review"],
      ["Navy Blue Backpack", "LF-204 ↔ FD-086", "Science Building", "Oct 2, 2026", "Needs review"],
      ["Calculus Textbook", "LF-194 ↔ FD-079", "Engineering Hall", "Sep 30, 2026", "Needs review"]
    ],
    "recovery-requests": [
      ["Silver Water Bottle", "RR-018", "Jordan Lee", "Student Centre", "Oct 3, 2026", "Needs review"],
      ["Black Umbrella", "RR-016", "Priya Nair", "Main Library", "Oct 2, 2026", "Needs review"]
    ],
    "contact-requests": [
      ["Possible earbuds match", "CR-044", "Mina Shah", "LF-201", "Oct 3, 2026", "New"],
      ["Claim for water bottle", "CR-043", "Jordan Lee", "FD-089", "Oct 3, 2026", "New"],
      ["Question about ID card", "CR-041", "Sam Rivera", "FD-084", "Oct 2, 2026", "In review"]
    ],
    recovered: [
      ["Blue Water Bottle", "FD-073", "Elena Garcia", "Student Centre", "Sep 29, 2026", "Recovered"],
      ["Grey Hoodie", "FD-069", "Marcus Bell", "Gymnasium", "Sep 26, 2026", "Recovered"]
    ],
    users: [
      ["Aarav Mehta", "U-104", "aarav@example.edu", "2 reports", "Active"],
      ["Mina Shah", "U-103", "mina@example.edu", "1 report", "Active"],
      ["Leah Wong", "U-102", "leah@example.edu", "1 report", "Active"],
      ["Noah Patel", "U-101", "noah@example.edu", "1 report", "Active"]
    ]
  };

  const headers = {
    "lost-reports": ["ITEM", "REFERENCE", "REPORTER", "LOCATION", "REPORTED", "STATUS", ""],
    "found-items": ["ITEM", "REFERENCE", "RECORDED BY", "LOCATION", "RECEIVED", "STATUS", ""],
    matches: ["POSSIBLE MATCH", "REPORT REFERENCES", "LOCATION", "IDENTIFIED", "STATUS", ""],
    "recovery-requests": ["ITEM CLAIM", "REQUEST", "REQUESTER", "ITEM LOCATION", "SUBMITTED", "STATUS", ""],
    "contact-requests": ["SUBJECT", "REQUEST", "REQUESTER", "REFERENCE", "SUBMITTED", "STATUS", ""],
    recovered: ["ITEM", "REFERENCE", "OWNER", "FOUND ITEM", "RECOVERED", "STATUS", ""],
    users: ["NAME", "USER ID", "EMAIL", "REGISTERED", "STATUS", ""]
  };

  const searchTerms = {
    overview: ["Overview", "Here’s what’s happening across your lost and found hub today."],
    "lost-reports": ["Lost reports", "Review and manage reports submitted by users."],
    "found-items": ["Found items received", "Physical items recorded by the administration."],
    matches: ["Possible matches", "Review suggested matches between lost reports and received items."],
    "recovery-requests": ["Recovery requests", "Review claims and verify ownership before handover."],
    "contact-requests": ["Contact requests", "Messages sent to administration by users."],
    recovered: ["Recovered items", "Items verified and returned by the administration."],
    users: ["Users", "Sample accounts and report activity for this frontend demo."]
  };

  const overview = document.getElementById("overviewSection");
  const tableSection = document.getElementById("tableSection");
  const sectionTitle = document.getElementById("sectionTitle");
  const sectionSubtitle = document.getElementById("sectionSubtitle");
  const currentSectionName = document.getElementById("currentSectionName");
  const tableHeading = document.getElementById("tableHeading");
  const tableDescription = document.getElementById("tableDescription");
  const tableHead = document.getElementById("adminTableHead");
  const tableBody = document.getElementById("adminTableBody");
  const modal = document.getElementById("adminModal");
  const modalForm = document.getElementById("adminItemForm");
async function loadDashboardStats() {
    const savedSession = sessionStorage.getItem("lfh_admin");

    if (!savedSession) {
      window.location.href = "admin-login.html";
      return;
    }

    let session;

    try {
      session = JSON.parse(savedSession);
    } catch {
      sessionStorage.removeItem("lfh_admin");
      window.location.href = "admin-login.html";
      return;
    }

    if (!session.token) {
      window.location.href = "admin-login.html";
      return;
    }

    try {
      const response = await fetch(
        `${LFH.API_BASE}/admin/dashboard`,
        {
          headers: {
            "Authorization": `Bearer ${session.token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load dashboard.");
      }

      document.getElementById("statLostReports").textContent =
        result.lost_reports ?? 0;

      document.getElementById("statFoundItems").textContent =
        result.found_items_in_custody ?? 0;

      document.getElementById("statPossibleMatches").textContent =
        result.possible_matches ?? 0;

      document.getElementById("statRecoveredItems").textContent =
        result.recovered_items ?? 0;

    } catch (error) {
      console.error("Dashboard loading error:", error);
    }
  }
  function badgeClass(status) {
    const value = status.toLowerCase();
    if (value.includes("match") || value.includes("review")) return "match";
    if (value.includes("recover")) return "recovered";
    if (value.includes("received") || value.includes("active")) return "received";
    return "";
  }

  function renderRows(rows) {
    const query = (document.getElementById("adminSearch")?.value || "")
        .trim().toLowerCase();

    const filtered = rows.filter(row =>
        row.join(" ").toLowerCase().includes(query)
    );

    tableBody.innerHTML = filtered.map(row => {
        const content = row.map((cell, index) => {
            if (index === row.length - 1) {
                return `<td><span class="status-badge ${badgeClass(cell)}">${LFH.escapeHtml(cell)}</span></td>`;
            }
            return `<td>${LFH.escapeHtml(cell)}</td>`;
        }).join("");

        let actions;

        if (row.matchId) {
            actions = `<td>
                <button class="row-action" type="button"
                    data-match-action="CONFIRMED"
                    data-match-id="${row.matchId}">Confirm</button>
                <button class="row-action" type="button"
                    data-match-action="REJECTED"
                    data-match-id="${row.matchId}">Reject</button>
            </td>`;
        } else if (row.recoveryId) {
            actions = `<td>
                <button class="row-action" type="button"
                    data-recovery-id="${row.recoveryId}">Verify & Handover</button>
            </td>`;
        } else {
            actions = `<td>
                <button class="row-action" type="button">Review</button>
            </td>`;
        }

        return `<tr>${content}${actions}</tr>`;
    }).join("");

    if (!filtered.length) {
        tableBody.innerHTML =
            `<tr><td colspan="7">No matching records.</td></tr>`;
    }
}
async function loadFoundItems() {
  const savedSession = sessionStorage.getItem("lfh_admin");

  if (!savedSession) return;

  try {
    const session = JSON.parse(savedSession);

    const response = await fetch(
      `${LFH.API_BASE}/admin/found-items`,
      {
        headers: {
          "Authorization": `Bearer ${session.token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load found items.");
    }

    records["found-items"] = result.records.map(item => [
      item.title,
      `FD-${item.id}`,
      item.recorded_by,
      item.location_found,
      String(item.received_date).slice(0, 10),
      item.status
    ]);

    renderRows(records["found-items"]);

  } catch (error) {
    console.error("Found items loading error:", error);
    tableBody.innerHTML =
      '<tr><td colspan="7">Could not load found items.</td></tr>';
  }
}
async function loadLostReports() {
  const savedSession = sessionStorage.getItem("lfh_admin");

  if (!savedSession) return;

  try {
    const session = JSON.parse(savedSession);

    const response = await fetch(
      `${LFH.API_BASE}/admin/lost-items`,
      {
        headers: {
          "Authorization": `Bearer ${session.token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load lost reports.");
    }

    records["lost-reports"] = result.records.map(item => [
      item.title,
      `LF-${item.id}`,
      item.reporter_name,
      item.location_lost,
      String(item.date_lost).slice(0, 10),
      item.status
    ]);

    renderRows(records["lost-reports"]);

  } catch (error) {
    console.error("Lost reports loading error:", error);
    tableBody.innerHTML =
      '<tr><td colspan="7">Could not load lost reports.</td></tr>';
  }
}
async function loadMatches() {
    const savedSession = sessionStorage.getItem("lfh_admin");
    if (!savedSession) return;

    try {
        const session = JSON.parse(savedSession);

        const response = await fetch(`${LFH.API_BASE}/admin/matches`, {
            headers: {
                "Authorization": `Bearer ${session.token}`
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not load matches.");
        }

        records["matches"] = result.records.map(item => {
    const row = [
        item.lost_title,
        item.found_title,
        item.match_score,
        item.status,
        `Match #${item.id}`
    ];

    row.matchId = item.id;
    return row;
});

        renderRows(records["matches"]);

    } catch (error) {
        console.error("Matches loading error:", error);
        tableBody.innerHTML =
            '<tr><td colspan="7">Could not load matches.</td></tr>';
    }
}
async function loadRecoveryRequests() {
    const savedSession = sessionStorage.getItem("lfh_admin");
    if (!savedSession) return;

    try {
        const session = JSON.parse(savedSession);

        const response = await fetch(
            `${LFH.API_BASE}/admin/recovery-records`,
            {
                headers: {
                    "Authorization": `Bearer ${session.token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not load recovery requests.");
        }

        records["recovery-requests"] = result.records
    .filter(item => item.status !== "HANDED_OVER")
    .map(item => {
    const row = [
        item.lost_title,
        `RR-${item.id}`,
        item.user_name,
        item.found_title,
        String(item.created_at).slice(0, 10),
        item.status
    ];

    row.recoveryId = item.id;
    return row;
});
        renderRows(records["recovery-requests"]);

    } catch (error) {
        console.error("Recovery requests loading error:", error);
        tableBody.innerHTML =
            '<tr><td colspan="7">Could not load recovery requests.</td></tr>';
    }
}
async function loadContactRequests() {
    const savedSession = sessionStorage.getItem("lfh_admin");
    if (!savedSession) return;

    try {
        const session = JSON.parse(savedSession);

        const response = await fetch(
            `${LFH.API_BASE}/admin/contact-requests`,
            {
                headers: {
                    "Authorization": `Bearer ${session.token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not load contact requests.");
        }

        records["contact-requests"] = result.records.map(item => [
            item.subject || item.message || "Contact request",
            `CR-${item.id}`,
            item.user_name,
            item.reference || item.item_reference || "—",
            String(item.created_at).slice(0, 10),
            item.status
        ]);

        renderRows(records["contact-requests"]);

    } catch (error) {
        console.error("Contact requests loading error:", error);
        tableBody.innerHTML =
            '<tr><td colspan="7">Could not load contact requests.</td></tr>';
    }
}
async function loadRecoveredItems() {
    const savedSession = sessionStorage.getItem("lfh_admin");
    if (!savedSession) return;

    try {
        const session = JSON.parse(savedSession);

        const response = await fetch(
            `${LFH.API_BASE}/admin/recovery-records`,
            {
                headers: {
                    "Authorization": `Bearer ${session.token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not load recovered items.");
        }

        records["recovered"] = result.records
            .filter(item => item.status === "HANDED_OVER")
            .map(item => [
                item.lost_title,
                `RR-${item.id}`,
                item.user_name,
                item.found_title,
                String(item.handover_date || item.created_at).slice(0, 10),
                item.status
            ]);

        renderRows(records["recovered"]);

    } catch (error) {
        console.error("Recovered items loading error:", error);
        tableBody.innerHTML =
            '<tr><td colspan="7">Could not load recovered items.</td></tr>';
    }
}
async function loadUsers() {
    const savedSession = sessionStorage.getItem("lfh_admin");
    if (!savedSession) return;

    try {
        const session = JSON.parse(savedSession);

        const response = await fetch(
            `${LFH.API_BASE}/admin/users`,
            {
                headers: {
                    "Authorization": `Bearer ${session.token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not load users.");
        }

        records["users"] = result.records.map(item => [
            item.name,
            `U-${item.id}`,
            item.email,
            String(item.created_at).slice(0, 10),
            "Active"
        ]);

        renderRows(records["users"]);

    } catch (error) {
        console.error("Users loading error:", error);
        tableBody.innerHTML =
            '<tr><td colspan="6">Could not load users.</td></tr>';
    }
}
  function renderSection(section) {
    document.querySelectorAll(".admin-nav a").forEach(link => {
      link.classList.toggle("active", link.dataset.section === section);
    });
    currentSectionName.textContent = labels[section] || "Overview";
    const copy = searchTerms[section] || searchTerms.overview;
    sectionTitle.innerHTML = section === "overview" ? 'Good morning, Admin <span>👋</span>' : LFH.escapeHtml(copy[0]);
    sectionSubtitle.textContent = copy[1];
    overview.classList.toggle("hidden", section !== "overview");
    tableSection.classList.toggle("hidden", section === "overview");

    if (section !== "overview") {
        if (section === "found-items") {
    loadFoundItems();
}
if (section === "matches") {
    loadMatches();
}
if (section === "recovery-requests") {
    loadRecoveryRequests();
}
if (section === "contact-requests") {
    loadContactRequests();
}
if (section === "recovered") {
    loadRecoveredItems();
}
if (section === "users") {
    loadUsers();
}
if (section === "lost-reports") {
    loadLostReports();
}
      tableHeading.textContent = labels[section];
      tableDescription.textContent = copy[1];
      tableHead.innerHTML = `<tr>${headers[section].map(label => `<th>${label}</th>`).join("")}</tr>`;
      renderRows(records[section] || []);
      document.getElementById("adminSearch").value = "";
    }
  }

  document.querySelectorAll(".admin-nav a").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      const section = link.dataset.section;
      history.replaceState(null, "", `#${section}`);
      renderSection(section);
      document.querySelector(".admin-sidebar").classList.remove("open");
    });
  });

  document.querySelectorAll("[data-go-section]").forEach(button => {
    button.addEventListener("click", () => {
      const section = button.dataset.goSection;
      history.replaceState(null, "", `#${section}`);
      renderSection(section);
    });
  });
tableBody.addEventListener("click", async event => {
    const matchButton = event.target.closest("[data-match-action]");
    const recoveryButton = event.target.closest("[data-recovery-id]");

    if (!matchButton && !recoveryButton) return;

    const savedSession = sessionStorage.getItem("lfh_admin");

    if (!savedSession) {
        alert("Please log in again as administrator.");
        return;
    }

    let button = matchButton || recoveryButton;

    try {
        const session = JSON.parse(savedSession);
        button.disabled = true;

        if (matchButton) {
            const matchId = matchButton.dataset.matchId;
            const status = matchButton.dataset.matchAction;

            const response = await fetch(
                `${LFH.API_BASE}/admin/matches/${matchId}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.token}`
                    },
                    body: JSON.stringify({ status })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Could not update match.");
            }

            alert(`Match successfully ${status.toLowerCase()}!`);

            await loadMatches();
            await loadDashboardStats();
        }

        if (recoveryButton) {
            const recoveryId = recoveryButton.dataset.recoveryId;

            const notes = prompt(
                "Enter ownership verification notes (minimum 3 characters):"
            );

            if (notes === null) return;

            if (notes.trim().length < 3) {
                throw new Error("Please enter at least 3 characters.");
            }

            const response = await fetch(
                `${LFH.API_BASE}/admin/recovery-records/${recoveryId}/handover`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.token}`
                    },
                    body: JSON.stringify({
                        verification_notes: notes.trim()
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Could not complete handover.");
            }

            alert("Item successfully handed over!");

            await loadRecoveryRequests();
            await loadRecoveredItems();
            await loadDashboardStats();
        }

    } catch (error) {
        alert(error.message);
    } finally {
        button.disabled = false;
    }
});
  document.getElementById("adminSearch").addEventListener("input", () => {
    const section = location.hash.slice(1) || "overview";
    renderRows(records[section] || []);
  });

  function openModal() {
    modal.classList.remove("hidden");
    document.getElementById("adminItemTitle").focus();
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  document.getElementById("quickAddButton").addEventListener("click", openModal);
  document.getElementById("tableAddButton").addEventListener("click", openModal);
  document.getElementById("modalClose").addEventListener("click", closeModal);
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  modalForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!modalForm.reportValidity()) return;

  const savedSession = sessionStorage.getItem("lfh_admin");
  const feedback = document.getElementById("adminItemFeedback");
  const submitButton = modalForm.querySelector('button[type="submit"]');
  const data = new FormData(modalForm);

  if (!savedSession) {
    alert("Please log in again as administrator.");
    window.location.href = "admin-login.html";
    return;
  }

  let session;

  try {
    session = JSON.parse(savedSession);
  } catch {
    sessionStorage.removeItem("lfh_admin");
    alert("Your session is invalid. Please log in again.");
    window.location.href = "admin-login.html";
    return;
  }

  if (!session.token) {
    window.location.href = "admin-login.html";
    return;
  }

  const payload = {
    title: data.get("title").trim(),
    category: data.get("category"),
    location_found: data.get("location").trim(),
    date_found: data.get("date"),
    description: data.get("description").trim(),
    image: null
  };

  try {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    const response = await fetch(`${LFH.API_BASE}/items/found`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not save found item.");
    }

    alert(`Found item successfully recorded! Database ID: ${result.id}`);

    modalForm.reset();
    closeModal();

    await loadDashboardStats();

  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save found item";
  }
});

  document.getElementById("adminMobileMenu").addEventListener("click", () => {
    document.querySelector(".admin-sidebar").classList.toggle("open");
  });

  document.getElementById("attentionTable").innerHTML = [
    ["Wireless Earbuds Case", "Lost report", "Main Library", "12 min ago", "Needs review"],
    ["Student ID Card", "Found item", "Admin Office", "38 min ago", "Possible match"],
    ["Black Backpack", "Recovery request", "Science Building", "2 hours ago", "Needs review"]
  ].map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td><span class="status-badge ${badgeClass(row[4])}">${row[4]}</span></td><td><button class="row-action" type="button" data-go-section="recovery-requests">Review</button></td></tr>`).join("");

  document.querySelectorAll("#attentionTable [data-go-section]").forEach(button => {
    button.addEventListener("click", () => {
      history.replaceState(null, "", "#recovery-requests");
      renderSection("recovery-requests");
    });
  });

  document.getElementById("adminMenuButton").addEventListener("click", () => {
    alert("Demo administrator profile. Authentication and account settings are not connected.");
  });
loadDashboardStats();
  const initial = location.hash.slice(1);
  renderSection(labels[initial] ? initial : "overview");
})();