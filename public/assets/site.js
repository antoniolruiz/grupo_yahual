(function() {
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
    const todayYmd = fmtYmd(new Date());

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
        const ymd = fmtYmd(date);
        const el = document.createElement('div');
        el.className = 'day';
        if (bookedSet.has(ymd)) el.classList.add('booked');
        if (ymd === todayYmd) el.classList.add('today');
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAvailability);
  } else {
    initAvailability();
  }
})();


