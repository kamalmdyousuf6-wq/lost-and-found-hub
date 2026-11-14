(function () {
  "use strict";

  const grid = document.getElementById("itemGrid");
  if (!grid) return;
let allItems = [];
  const searchInput = document.getElementById("searchInput");
  const typeFilter = document.getElementById("typeFilter");
  const categoryFilter = document.getElementById("categoryFilter");
  const locationFilter = document.getElementById("locationFilter");
  const dateFilter = document.getElementById("dateFilter");
  const count = document.getElementById("resultsCount");
  const emptyState = document.getElementById("emptyState");
  const clearButton = document.getElementById("clearFilters");

  function cardMarkup(item) {
    const typeLabel = item.type === "found" ? "Found item" : "Lost report";
    const typeClass = item.type === "found" ? "found" : "";
    const safeTitle = LFH.escapeHtml(item.title);
    const safeCategory = LFH.escapeHtml(item.category);
    const safeDescription = LFH.escapeHtml(item.description);
    const safeLocation = LFH.escapeHtml(item.location);
    const href = `item-details.html?type=${encodeURIComponent(item.type)}&id=${encodeURIComponent(item.id)}`;
    return `
      <article class="item-card">
        <a class="item-card-image ${LFH.escapeHtml(item.theme || "blue-bg")}" href="${href}" aria-label="View ${safeTitle}">
          <span class="item-type-badge ${typeClass}">${typeLabel}</span>
          <span class="item-big-emoji" aria-hidden="true">${LFH.escapeHtml(item.emoji || "📦")}</span>
        </a>
        <div class="item-card-body">
          <div class="item-card-top"><h3>${safeTitle}</h3><span class="category-label">${safeCategory}</span></div>
          <p class="item-card-description">${safeDescription}</p>
          <div class="item-meta"><span>⌖ ${safeLocation}</span><span>◷ ${new Date(item.date + "T00:00:00").toLocaleDateString("en-IN")}</span></div>
          <div class="item-card-footer"><span>Ref. ${LFH.escapeHtml(item.id)}</span><a class="text-link" href="${href}">View details →</a></div>
        </div>
      </article>`;
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const type = typeFilter.value;
    const category = categoryFilter.value.toLowerCase();
    const location = locationFilter.value.trim().toLowerCase();
    const date = dateFilter.value;

    const results = allItems.filter(item => {
      const text = `${item.title} ${item.description} ${item.category} ${item.location}`.toLowerCase();
      return (!query || text.includes(query))
        && (!type || item.type === type)
        && (!category || item.category.toLowerCase() === category)
        && (!location || item.location.toLowerCase().includes(location))
        && (!date || item.date === date);
    });

    grid.innerHTML = results.map(cardMarkup).join("");
    count.textContent = `Showing ${results.length} ${results.length === 1 ? "item" : "items"}`;
    emptyState.classList.toggle("hidden", results.length !== 0);
    grid.classList.toggle("hidden", results.length === 0);
  }
async function loadAllItems() {
    try {
        const response = await fetch(`${LFH.API_BASE}/items`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not load items.");
        }

        allItems = result.items.map(item => ({
            ...item,
            date: String(item.item_date).slice(0, 10),
            location: item.item_location
        }));

        applyFilters();

    } catch (error) {
        console.error("Browse items loading error:", error);
        count.textContent = "Could not load items. Please try again.";
    }
}
  function clearFilters() {
    searchInput.value = "";
    typeFilter.value = "";
    categoryFilter.value = "";
    locationFilter.value = "";
    dateFilter.value = "";
    applyFilters();
  }

  [searchInput, typeFilter, categoryFilter, locationFilter, dateFilter].forEach(control => {
    control.addEventListener("input", applyFilters);
    control.addEventListener("change", applyFilters);
  });

  clearButton.addEventListener("click", clearFilters);
  document.getElementById("emptyClear").addEventListener("click", clearFilters);
  loadAllItems();
})();