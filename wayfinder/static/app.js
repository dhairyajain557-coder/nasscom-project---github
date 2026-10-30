/* Wayfinder front end. Plain JavaScript, no build step.
 *
 * Order of this file follows the order things happen in the browser:
 *   1. constants and tiny helpers
 *   2. page setup (interest chips, example trips, mode badge)
 *   3. reading the form and calling the API
 *   4. rendering the itinerary (always with textContent, never innerHTML,
 *      because the text comes from an AI model)
 *   5. copy / print / "redo this day"
 */

// ---------- 1. constants and helpers ----------
const INTERESTS = ["culture", "food", "nature", "adventure", "history",
                   "shopping", "nightlife", "relaxation", "art", "photography"];

const EXAMPLES = {
  kyoto:  { destination: "Kyoto, Japan", days: 4, travelers: 2, budget: "moderate", pace: "balanced",
            interests: ["culture", "food", "history"], notes: "" },
  lisbon: { destination: "Lisbon, Portugal", days: 3, travelers: 2, budget: "budget", pace: "relaxed",
            interests: ["food", "culture", "art"], notes: "" },
  banff:  { destination: "Banff, Canada", days: 5, travelers: 3, budget: "moderate", pace: "packed",
            interests: ["nature", "adventure", "photography"], notes: "Traveling with a teenager" },
};

const state = { trip: null, itinerary: null, day: 1 };
const $ = (id) => document.getElementById(id);

/** Build a DOM element. Children are strings (inserted as text) or nodes. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

function money(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

// ---------- 2. page setup ----------
function buildInterestChips() {
  const box = $("interests");
  for (const name of INTERESTS) {
    const input = el("input", { type: "checkbox", name: "interest", value: name });
    box.append(el("label", {}, input, el("span", { text: name })));
  }
}

function applyToForm(trip) {
  $("destination").value = trip.destination;
  $("days").value = trip.days;
  $("travelers").value = trip.travelers;
  $("notes").value = trip.notes || "";
  if (trip.currency) $("currency").value = trip.currency;
  document.querySelector(`input[name=budget][value=${trip.budget}]`).checked = true;
  document.querySelector(`input[name=pace][value=${trip.pace}]`).checked = true;
  document.querySelectorAll("input[name=interest]").forEach((box) => {
    box.checked = trip.interests.includes(box.value);
  });
}

async function showMode() {
  if (window.wayfinderLocal) {
    const badge = $("mode-badge");
    badge.textContent = "Hosted demo: sample plans, no AI connected";
    badge.hidden = false;
    return;
  }
  try {
    const info = await (await fetch("/api/health")).json();
    const labels = {
      vertex: `Gemini on Vertex AI (${info.model})`,
      api_key: `Gemini API (${info.model})`,
      demo: "Demo mode: sample itineraries, no AI connected",
    };
    const badge = $("mode-badge");
    badge.textContent = labels[info.mode] || info.mode;
    badge.hidden = false;
  } catch { /* the badge is optional */ }
}

// ---------- 3. form -> API ----------
function readForm() {
  return {
    destination: $("destination").value.trim(),
    days: Number($("days").value),
    travelers: Number($("travelers").value),
    currency: $("currency").value,
    budget: document.querySelector("input[name=budget]:checked").value,
    pace: document.querySelector("input[name=pace]:checked").value,
    interests: [...document.querySelectorAll("input[name=interest]:checked")].map((b) => b.value),
    notes: $("notes").value.trim(),
  };
}

async function postJSON(url, body) {
  // The hosted demo page defines window.wayfinderLocal so it runs with no server.
  if (window.wayfinderLocal) return window.wayfinderLocal(url, body);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

function setView(view) {
  $("empty").hidden = view !== "empty";
  $("loading").hidden = view !== "loading";
  $("itinerary").hidden = view !== "itinerary";
}

function showFormError(message) {
  const box = $("form-error");
  box.textContent = message || "";
  box.hidden = !message;
}

async function onSubmit(event) {
  event.preventDefault();
  showFormError("");
  const trip = readForm();
  if (trip.destination.length < 2) {
    showFormError("Enter a destination.");
    $("destination").focus();
    return;
  }
  const button = $("submit-btn");
  button.disabled = true;
  button.textContent = "Planning...";
  setView("loading");
  try {
    const data = await postJSON("/api/itinerary", trip);
    state.trip = data.trip;
    state.itinerary = data.itinerary;
    state.day = 1;
    render();
    setView("itinerary");
  } catch (error) {
    showFormError(error.message);
    setView(state.itinerary ? "itinerary" : "empty");
  } finally {
    button.disabled = false;
    button.textContent = "Plan my trip";
  }
}

// ---------- 4. rendering ----------
function render() {
  const { itinerary, trip } = state;
  $("trip-title").textContent = itinerary.trip_title;
  $("trip-summary").textContent = itinerary.summary;
  $("trip-season").textContent = itinerary.best_time_note;
  $("trip-total").textContent = money(itinerary.total_estimated_cost, itinerary.currency);
  $("trip-people").textContent =
    `for ${trip.travelers} ${trip.travelers === 1 ? "traveler" : "travelers"}, excluding flights and stays`;
  renderTabs();
  renderDay();
  fillList($("packing"), itinerary.packing_tips);
  fillList($("local-tips"), itinerary.local_tips);
}

function fillList(list, items) {
  list.replaceChildren(...items.map((text) => el("li", { text })));
}

function renderTabs() {
  const tabs = $("day-tabs");
  tabs.replaceChildren(
    ...state.itinerary.days.map((d) => {
      const tab = el("button", {
        type: "button", role: "tab", text: `Day ${d.day}`,
        "aria-selected": String(d.day === state.day),
      });
      tab.addEventListener("click", () => { state.day = d.day; renderTabs(); renderDay(); });
      return tab;
    })
  );
}

function stopNode(activity, currency) {
  const cost = activity.estimated_cost > 0 ? money(activity.estimated_cost, currency) : "Free";
  const body = el("div", { class: "stop-body" },
    el("div", { class: "stop-title" },
      el("h4", { text: activity.title }),
      el("span", { class: "stop-cost", text: cost })),
    el("p", { text: activity.description }));
  if (activity.tip) body.append(el("p", { class: "stop-tip", text: `Tip: ${activity.tip}` }));
  return el("li", { class: "stop", "data-cat": activity.category },
    el("span", { class: "stop-time", text: activity.time }),
    el("span", { class: "stop-rail" }, el("span", { class: "stop-dot" })),
    body);
}

function renderDay() {
  const day = state.itinerary.days.find((d) => d.day === state.day);
  $("day-theme").textContent = `Day ${day.day}: ${day.theme}`;
  $("day-cost").textContent = `About ${money(day.day_cost, state.itinerary.currency)}`;
  $("timeline").replaceChildren(...day.activities.map((a) => stopNode(a, state.itinerary.currency)));
}

// ---------- 5. copy, print, redo a day ----------
function asPlainText() {
  const { itinerary } = state;
  const lines = [itinerary.trip_title, itinerary.summary, ""];
  for (const day of itinerary.days) {
    lines.push(`Day ${day.day}: ${day.theme}`);
    for (const a of day.activities) lines.push(`  ${a.time}  ${a.title}: ${a.description}`);
    lines.push("");
  }
  lines.push(`Estimated total: ${money(itinerary.total_estimated_cost, itinerary.currency)}`);
  return lines.join("\n");
}

async function copyText() {
  const button = $("copy-btn");
  try {
    await navigator.clipboard.writeText(asPlainText());
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  setTimeout(() => { button.textContent = "Copy as text"; }, 1800);
}

/** Print every day, not just the selected tab. */
function printAll() {
  const sheet = el("section", { class: "print-all" });
  for (const day of state.itinerary.days) {
    sheet.append(
      el("h3", { text: `Day ${day.day}: ${day.theme}` }),
      el("ol", { class: "timeline" }, ...day.activities.map((a) => stopNode(a, state.itinerary.currency)))
    );
  }
  $("itinerary").append(sheet);
  window.addEventListener("afterprint", () => sheet.remove(), { once: true });
  window.print();
}

async function onRefine(event) {
  event.preventDefault();
  const button = $("refine-btn");
  button.disabled = true;
  button.textContent = "Redoing...";
  try {
    const data = await postJSON("/api/itinerary/day", {
      trip: state.trip,
      itinerary: state.itinerary,
      day: state.day,
      feedback: $("refine-input").value.trim(),
    });
    state.itinerary = data.itinerary;
    $("refine-input").value = "";
    render();
  } catch (error) {
    showFormError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Redo this day";
  }
}

// ---------- start ----------
buildInterestChips();
showMode();
$("trip-form").addEventListener("submit", onSubmit);
$("refine-form").addEventListener("submit", onRefine);
$("copy-btn").addEventListener("click", copyText);
$("print-btn").addEventListener("click", printAll);
document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    applyToForm(EXAMPLES[button.dataset.example]);
    $("trip-form").requestSubmit();
  });
});
