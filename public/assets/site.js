(function() {
  function qs(sel, parent) { return (parent || document).querySelector(sel); }
  function qsa(sel, parent) { return Array.from((parent || document).querySelectorAll(sel)); }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function fmtYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function fmtYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function renderCalendar(container, bookedDates, monthsToShow = 6) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayYmd = fmtYmd(today);

    const bookedSet = new Set(bookedDates);
    const monthsWrapper = document.createElement('div');
    monthsWrapper.className = 'months';

    const start = new Date();
    start.setDate(1);

    for (let i = 0; i < monthsToShow; i++) {
      const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const firstDow = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const monthEl = document.createElement('div');
      monthEl.className = 'month';

      const title = document.createElement('div');
      title.className = 'title';
      const monthName = monthDate.toLocaleString(undefined, { month: 'long' });
      title.textContent = `${monthName} ${year}`;
      monthEl.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'grid';

      const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (const dow of dows) {
        const el = document.createElement('div');
        el.className = 'dow';
        el.textContent = dow;
        grid.appendChild(el);
      }

      for (let e = 0; e < firstDow; e++) {
        const empty = document.createElement('div');
        empty.className = 'day empty';
        grid.appendChild(empty);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        date.setHours(0,0,0,0);
        const ymd = fmtYmd(date);
        const el = document.createElement('div');
        el.className = 'day';
        if (bookedSet.has(ymd)) el.classList.add('booked');
        if (ymd === todayYmd) el.classList.add('today');
        if (date < today) el.classList.add('past');
        const num = document.createElement('div');
        num.className = 'num';
        num.textContent = String(day);
        el.appendChild(num);
        grid.appendChild(el);
      }

      monthEl.appendChild(grid);
      monthsWrapper.appendChild(monthEl);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'calendar';
    wrapper.appendChild(monthsWrapper);
    container.appendChild(wrapper);
  }

  async function initAvailability() {
    const container = document.getElementById('availability');
    if (!container) return;
    const slug = container.dataset.slug;
    if (!slug) return;
    try {
      const base = document.querySelector('meta[name="base-path"]');
      const basePath = base ? base.getAttribute('content') || '/' : '/';
      const res = await fetch(`${basePath}availability/${slug}.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error('not ok');
      const data = await res.json();
      const booked = Array.isArray(data.bookedDates) ? data.bookedDates : [];
      if (booked.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder';
        placeholder.innerHTML = `No availability loaded yet. Add the Airbnb iCal URL in <code>data/config.json</code> and run <code>npm run sync-calendars</code>.`;
        container.appendChild(placeholder);
      } else {
        renderCalendar(container, booked, 6);
      }
    } catch (e) {
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder';
      placeholder.innerHTML = `Availability not found. Add the Airbnb iCal URL in <code>data/config.json</code> and run <code>npm run sync-calendars</code>.`;
      container.appendChild(placeholder);
    }
  }

  function initSearchBar() {
    const btn = qs('#search-button');
    if (!btn) return;
    const inEl = qs('#search-check-in');
    const outEl = qs('#search-check-out');
    const guestsEl = qs('#search-guests');
    // Defaults
    const today = new Date();
    const tomorrow = addDays(today, 1);
    if (inEl && !inEl.value) inEl.value = fmtYmd(today);
    if (outEl && !outEl.value) outEl.value = fmtYmd(tomorrow);
    btn.addEventListener('click', () => {
      const checkIn = inEl.value;
      const checkOut = outEl.value;
      const guests = guestsEl.value || '2';
      // Scroll to suites section
      const grid = qs('#suites');
      if (grid) grid.scrollIntoView({ behavior: 'smooth' });
      // Optionally filter cards in future; for now, no-op
    });
  }

  function initMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && e.target !== toggle) nav.classList.remove('open');
    });
  }

  function initBookingForm() {
    const form = qs('#booking-form');
    if (!form) return;
    const aside = form.closest('.booking-card');
    const airbnbId = aside ? aside.getAttribute('data-airbnb-id') : '';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const ci = data.get('check_in');
      const co = data.get('check_out');
      const adults = data.get('adults') || '2';
      if (!airbnbId) {
        window.alert('Opening Airbnb listing.');
        return;
      }
      const url = new URL(`https://www.airbnb.com/rooms/${airbnbId}`);
      if (ci) url.searchParams.set('check_in', ci);
      if (co) url.searchParams.set('check_out', co);
      if (adults) url.searchParams.set('adults', String(adults));
      window.open(url.toString(), '_blank', 'noopener');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAvailability();
      initSearchBar();
      initMobileMenu();
      initBookingForm();
    });
  } else {
    initAvailability();
    initSearchBar();
    initMobileMenu();
    initBookingForm();
  }
})();


