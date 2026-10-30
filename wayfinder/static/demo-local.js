/* Browser-only demo backend, used by the hosted demo page. It mirrors the
   Python demo generator so the page works with no server and no AI key. */
(() => {
  const RATE = { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83 };
  const FACTOR = { budget: 0.6, moderate: 1, luxury: 2.4 };
  const SLOTS = {
    relaxed: ["10:00", "13:30", "19:30"],
    balanced: ["09:30", "12:30", "15:30", "19:30"],
    packed: ["08:30", "11:00", "13:00", "16:00", "19:30"],
  };
  const POOLS = {
    culture: [["Old town walking tour", "Follow a local guide through the oldest streets of {d} and learn how the city grew.", "culture", 18, "Book the first slot of the day to beat the crowds."],
              ["City museum visit", "See the story of {d} told through artefacts, maps, and photographs.", "culture", 14, "Check for a free-entry evening once a week."]],
    food: [["Street-food crawl", "Sample five local dishes from market stalls in {d}, sharing plates as you go.", "food", 22, "Go where the queue is local, not where the menu has photos."],
           ["Cooking class", "Cook a regional dish with a local host, then eat what you made.", "food", 45, "Tell the host about allergies when you book."]],
    nature: [["Sunrise viewpoint", "Climb to the best lookout near {d} for first light over the landscape.", "nature", 0, "Carry a layer; it is colder at the top."],
             ["Botanical garden stroll", "A slow loop through gardens and green space close to the centre of {d}.", "nature", 8, "Weekday mornings are the quietest."]],
    adventure: [["Guided bike ride", "Cover more ground by bike on a half-day route around {d}.", "adventure", 30, "Ask for a route that avoids main roads."],
                ["Day hike", "A moderate trail with a payoff view, within an hour of {d}.", "adventure", 12, "Start before 9:00 and bring water."]],
    history: [["Historic fort or palace", "Explore the best-preserved landmark in {d} with an audio guide.", "culture", 16, "Audio guides are usually cheaper at the gate than online."],
              ["Heritage quarter", "Walk the district where {d}'s older buildings and traditions survive.", "culture", 6, "Look up: the best details are above shopfronts."]],
    shopping: [["Local craft market", "Browse makers' stalls in {d} for gifts you will not find at home.", "shopping", 25, "Bargain politely; start at about 60% of the first price."]],
    nightlife: [["Evening live-music venue", "Hear local musicians at a well-reviewed venue in {d}.", "nightlife", 20, "Arrive an hour before the set for a good table."]],
    relaxation: [["Spa or hot-spring session", "Unwind with a traditional treatment popular in {d}.", "relax", 40, "Book a weekday slot for a discount."]],
    art: [["Gallery hop", "Visit two small galleries showing contemporary work from {d}.", "culture", 10, "Small galleries often open late morning."]],
    photography: [["Golden-hour photo walk", "Shoot the most photogenic corners of {d} in the best light of the day.", "nature", 0, "Scout the location at midday, shoot it at golden hour."]],
  };
  const MEALS = [
    ["Lunch at a neighbourhood favourite", "A relaxed midday meal where locals eat in {d}.", "food", 15, "Ask for the dish of the day."],
    ["Dinner at a regional restaurant", "End the day with a sit-down dinner built around local specialities.", "food", 28, "Reserve ahead on weekends."],
  ];
  const MEAL_SLOTS = ["12:30", "13:00", "13:30"];

  const clean = (v, n) => String(v ?? "").replace(/[\x00-\x1f\x7f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

  function validate(t) {
    const trip = {
      destination: clean(t?.destination, 80),
      days: Math.round(Number(t?.days)),
      travelers: Math.round(Number(t?.travelers)),
      budget: String(t?.budget || "moderate"),
      pace: String(t?.pace || "balanced"),
      currency: String(t?.currency || "USD"),
      interests: (Array.isArray(t?.interests) ? t.interests : []).slice(0, 8).map((i) => clean(i, 30).toLowerCase()).filter(Boolean),
      notes: clean(t?.notes, 500),
    };
    if (trip.destination.length < 2) throw new Error("Enter a destination.");
    if (!(trip.days >= 1 && trip.days <= 14)) throw new Error("Days must be between 1 and 14.");
    if (!(trip.travelers >= 1 && trip.travelers <= 20)) throw new Error("Travelers must be between 1 and 20.");
    if (!FACTOR[trip.budget] || !SLOTS[trip.pace] || !RATE[trip.currency]) throw new Error("Check budget, pace and currency.");
    return trip;
  }

  function makeDay(trip, number, offset = 0) {
    const interests = trip.interests.filter((i) => POOLS[i]);
    const list = interests.length ? interests : ["culture", "food", "nature"];
    const factor = FACTOR[trip.budget] * RATE[trip.currency] * trip.travelers;
    const pick = number * 3 + offset;
    const activities = SLOTS[trip.pace].map((time, index) => {
      let entry;
      if (MEAL_SLOTS.includes(time)) entry = MEALS[0];
      else if (time === "19:30") entry = MEALS[1];
      else {
        const pool = POOLS[list[(pick + index) % list.length]];
        entry = pool[Math.floor((pick + index) / list.length) % pool.length];
      }
      const [title, description, category, base, tip] = entry;
      return { time, title, description: description.replaceAll("{d}", trip.destination),
               category, estimated_cost: Math.round(base * factor), tip };
    });
    const name = list[pick % list.length];
    return { day: number, theme: name[0].toUpperCase() + name.slice(1) + " day", activities };
  }

  function totals(it) {
    it.days.forEach((d) => { d.day_cost = d.activities.reduce((s, a) => s + a.estimated_cost, 0); });
    it.total_estimated_cost = it.days.reduce((s, d) => s + d.day_cost, 0);
    return it;
  }

  window.wayfinderLocal = async (url, body) => {
    await new Promise((r) => setTimeout(r, 700)); // brief pause so the loading state is visible
    if (url === "/api/itinerary") {
      const trip = validate(body);
      const days = Array.from({ length: trip.days }, (_, i) => makeDay(trip, i + 1));
      return { trip, itinerary: totals({
        trip_title: `${trip.days} days in ${trip.destination}`,
        summary: `A ${trip.pace} ${trip.days}-day plan for ${trip.travelers} traveler(s) in ${trip.destination}, built around ${trip.interests.join(", ") || "a mix of sights and local food"}. This is sample content; the full project connects to Gemini for a tailored plan.`,
        best_time_note: "Demo mode does not know the season; check a forecast before you pack.",
        currency: trip.currency, days,
        packing_tips: ["Comfortable walking shoes", "Light rain layer", "Portable charger", "Reusable water bottle"],
        local_tips: ["Carry some cash for small vendors", "Download an offline map", "Learn three polite phrases in the local language"],
      }) };
    }
    if (url === "/api/itinerary/day") {
      const trip = validate(body.trip);
      const it = body.itinerary;
      const day = Number(body.day);
      if (!it || !it.days || !(day >= 1 && day <= it.days.length)) throw new Error("That day is not part of this trip.");
      it.days[day - 1] = makeDay(trip, day, clean(body.feedback, 300).length + 1);
      return { trip, itinerary: totals(it) };
    }
    throw new Error("Not found.");
  };
})();
