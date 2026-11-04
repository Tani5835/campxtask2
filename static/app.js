/**
 * CampxTask — iOS Glassmorphic Student Dashboard
 * Modern Vanilla JavaScript (View-Based Architecture)
 */

(function () {
  'use strict';

  // State Management
  const state = {
    currentView: 'overview', // 'overview' | 'wellness' | 'schedule' | 'tasks' | 'insights'
    theme: 'light',
    todayDateStr: getLocalDateString(new Date()),

    // Health Trackers
    stepGoal: 8000,
    stepsHistory: {},        // { 'YYYY-MM-DD': count }
    waterGoal: 2500,
    waterHistory: {},        // { 'YYYY-MM-DD': { total: 0, entries: [] } }
    hydrationIntervalMins: 60,
    hydrationActive: false,
    sleepGoal: 8.0,
    sleepHistory: {},        // { 'YYYY-MM-DD': { bedtime: '23:00', waketime: '07:30', durationHrs: 8.5 } }
    bedtimeAlertActive: false,
    bedtimeAlertTime: '22:30',

    // Schedule
    classes: [],
    scheduleFilter: 'today', // 'today' | 'all'
    classReminderMins: 10,
    alertedClasses: new Set(),

    // Tasks
    tasks: [],
    taskFilter: 'all',       // 'all' | 'pending' | 'completed'
    taskSearch: '',

    // Notifications
    notificationsEnabled: false
  };

  // SVG Circumferences
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 58;  // ~364.42
  const HARMONY_CIRCUMFERENCE = 2 * Math.PI * 50;// ~314.16

  // Timers
  let hydrationTimer = null;
  let countdownTimer = null;

  /* ==========================================================================
     INITIALIZATION
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadPersistedData();
    initClockAndGreeting();
    initViewRouter();
    initNotificationService();
    bindEventListeners();

    // Fetch initial backend data
    fetchTasks();
    fetchClasses();

    // Initial renders
    renderStepGauge();
    renderWaterGauge();
    updateSleepDisplay();
    renderDailyHarmony();
    renderOverviewTasks();
    renderAnalyticsCharts();

    // Start intervals
    startCountdownTimer();
    setupHydrationTimer();
  });

  /* ==========================================================================
     THEME MANAGEMENT (DAY & NIGHT MODE)
     ========================================================================== */
  function initTheme() {
    const saved = localStorage.getItem('campx_theme') || 'light';
    setTheme(saved);

    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        setTheme(state.theme === 'light' ? 'dark' : 'light');
      });
    }
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('campx_theme', theme);
    renderAnalyticsCharts();
  }

  /* ==========================================================================
     VIEW NAVIGATION ROUTER (5 DEDICATED CLEAN VIEWS)
     ========================================================================== */
  function initViewRouter() {
    // Check initial hash
    const initialHash = window.location.hash.replace('#', '');
    if (['overview', 'wellness', 'schedule', 'tasks', 'insights'].includes(initialHash)) {
      switchToView(initialHash);
    } else {
      switchToView('overview');
    }

    // Top view segment buttons
    const navPills = document.querySelectorAll('.view-segments .view-pill');
    navPills.forEach(btn => {
      btn.addEventListener('click', () => {
        const viewName = btn.dataset.view;
        switchToView(viewName);
      });
    });

    // Mobile bottom dock buttons
    const dockBtns = document.querySelectorAll('.mobile-bottom-dock .dock-btn');
    dockBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const viewName = btn.dataset.view;
        switchToView(viewName);
      });
    });

    // Listen to hash changes
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (['overview', 'wellness', 'schedule', 'tasks', 'insights'].includes(hash)) {
        switchToView(hash);
      }
    });
  }

  function switchToView(viewName) {
    state.currentView = viewName;
    window.location.hash = viewName;

    // Switch view sections
    const views = document.querySelectorAll('.app-view');
    views.forEach(v => {
      v.classList.remove('active');
    });

    const activeTarget = document.getElementById(`view-${viewName}`);
    if (activeTarget) {
      activeTarget.classList.add('active');
    }

    // Update top nav pills
    const navPills = document.querySelectorAll('.view-segments .view-pill');
    navPills.forEach(p => {
      p.classList.toggle('active', p.dataset.view === viewName);
    });

    // Update bottom dock buttons
    const dockBtns = document.querySelectorAll('.mobile-bottom-dock .dock-btn');
    dockBtns.forEach(d => {
      d.classList.toggle('active', d.dataset.view === viewName);
    });

    // Trigger charts re-render if insights
    if (viewName === 'insights') {
      setTimeout(renderAnalyticsCharts, 50);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ==========================================================================
     LOCAL STORAGE RESTORATION
     ========================================================================== */
  function loadPersistedData() {
    try {
      // Step Tracker
      const savedStepGoal = localStorage.getItem('campx_step_goal');
      if (savedStepGoal) state.stepGoal = parseInt(savedStepGoal, 10);
      const savedStepsHistory = localStorage.getItem('campx_steps_history');
      if (savedStepsHistory) state.stepsHistory = JSON.parse(savedStepsHistory);

      // Water Tracker
      const savedWaterGoal = localStorage.getItem('campx_water_goal');
      if (savedWaterGoal) state.waterGoal = parseInt(savedWaterGoal, 10);
      const savedWaterHistory = localStorage.getItem('campx_water_history');
      if (savedWaterHistory) state.waterHistory = JSON.parse(savedWaterHistory);

      const savedHydrationMins = localStorage.getItem('campx_hydration_interval');
      if (savedHydrationMins) state.hydrationIntervalMins = parseInt(savedHydrationMins, 10);
      const savedHydrationActive = localStorage.getItem('campx_hydration_active');
      if (savedHydrationActive !== null) state.hydrationActive = savedHydrationActive === 'true';

      // Sleep Tracker
      const savedSleepGoal = localStorage.getItem('campx_sleep_goal');
      if (savedSleepGoal) state.sleepGoal = parseFloat(savedSleepGoal);
      const savedSleepHistory = localStorage.getItem('campx_sleep_history');
      if (savedSleepHistory) state.sleepHistory = JSON.parse(savedSleepHistory);

      const savedBedtimeActive = localStorage.getItem('campx_bedtime_active');
      if (savedBedtimeActive !== null) state.bedtimeAlertActive = savedBedtimeActive === 'true';
      const savedBedtimeTime = localStorage.getItem('campx_bedtime_time');
      if (savedBedtimeTime) state.bedtimeAlertTime = savedBedtimeTime;

      // Class reminders
      const savedClassReminderMins = localStorage.getItem('campx_class_reminder_mins');
      if (savedClassReminderMins) state.classReminderMins = parseInt(savedClassReminderMins, 10);

      // Cached classes & tasks for instant render
      const cachedClasses = localStorage.getItem('campx_cached_classes');
      if (cachedClasses) state.classes = JSON.parse(cachedClasses);

      const cachedTasks = localStorage.getItem('campx_cached_tasks');
      if (cachedTasks) state.tasks = JSON.parse(cachedTasks);

      // Sync form control values
      const stepGoalTag = document.getElementById('wellness-step-goal-tag');
      if (stepGoalTag) stepGoalTag.textContent = `Goal: ${state.stepGoal.toLocaleString()}`;

      const waterGoalTag = document.getElementById('wellness-water-goal-tag');
      if (waterGoalTag) waterGoalTag.textContent = `Goal: ${state.waterGoal.toLocaleString()} ml`;

      const sleepGoalTag = document.getElementById('wellness-sleep-goal-tag');
      if (sleepGoalTag) sleepGoalTag.textContent = `Target: ${state.sleepGoal.toFixed(1)} hrs`;

      const hydPicker = document.getElementById('hydration-interval-picker');
      if (hydPicker) hydPicker.value = state.hydrationIntervalMins;

      const hydCheckbox = document.getElementById('hydration-active-checkbox');
      if (hydCheckbox) hydCheckbox.checked = state.hydrationActive;

      const bedtimeCheckbox = document.getElementById('bedtime-alert-checkbox');
      if (bedtimeCheckbox) bedtimeCheckbox.checked = state.bedtimeAlertActive;

      const bedtimeTimeInput = document.getElementById('bedtime-alert-time');
      if (bedtimeTimeInput) bedtimeTimeInput.value = state.bedtimeAlertTime;

      const classAlertPicker = document.getElementById('class-alert-mins-select');
      if (classAlertPicker) classAlertPicker.value = state.classReminderMins;

    } catch (e) {
      console.warn('Error loading persisted data:', e);
    }
  }

  function getLocalDateString(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /* ==========================================================================
     CLOCK & GREETING
     ========================================================================== */
  function initClockAndGreeting() {
    updateClockAndGreeting();
    setInterval(updateClockAndGreeting, 1000);
  }

  function updateClockAndGreeting() {
    const now = new Date();
    const clockEl = document.getElementById('live-time-str');
    const dateEl = document.getElementById('overview-date-str');
    const greetingEl = document.getElementById('overview-heading');

    // Day change rollover check
    const todayStr = getLocalDateString(now);
    if (todayStr !== state.todayDateStr) {
      state.todayDateStr = todayStr;
      renderStepGauge();
      renderWaterGauge();
      renderDailyHarmony();
      renderClasses();
      renderOverviewTasks();
      renderAnalyticsCharts();
    }

    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    if (greetingEl) {
      const h = now.getHours();
      let msg = 'Good Evening';
      if (h >= 5 && h < 12) msg = 'Good Morning';
      else if (h >= 12 && h < 17) msg = 'Good Afternoon';
      greetingEl.textContent = msg;
    }

    // Check bedtime alert
    checkBedtimeAlert(now);
  }

  /* ==========================================================================
     NOTIFICATIONS & TOAST SYSTEM
     ========================================================================== */
  function initNotificationService() {
    const notifBtn = document.getElementById('notif-perm-btn');
    const dot = document.getElementById('notif-status-dot');

    if ('Notification' in window && Notification.permission === 'granted') {
      state.notificationsEnabled = true;
      if (dot) {
        dot.classList.remove('dot-disabled');
        dot.classList.add('dot-enabled');
      }
    }

    if (notifBtn) {
      notifBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
          showToast('Browser notifications are not supported in this environment.');
          return;
        }

        if (Notification.permission === 'granted') {
          showToast('Notifications are active & configured.');
        } else if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            state.notificationsEnabled = true;
            if (dot) {
              dot.classList.remove('dot-disabled');
              dot.classList.add('dot-enabled');
            }
            showToast('Notifications enabled!');
            sendNotification('CampxTask Active', 'You will receive timely alerts for classes and wellness.');
          } else {
            showToast('Notifications permission declined. Using in-app alerts.');
          }
        } else {
          showToast('Notifications blocked in browser settings. In-app alerts remain active.');
        }
      });
    }
  }

  function sendNotification(title, body) {
    if (state.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch (e) {
        // Fallback to toast
      }
    }
    showToast(`${title}: ${body}`);
  }

  function showToast(message) {
    const shelf = document.getElementById('toast-shelf');
    if (!shelf) return;

    const toast = document.createElement('div');
    toast.className = 'toast-bubble';
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <span>${escapeHtml(message)}</span>
    `;

    shelf.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(16px)';
      setTimeout(() => toast.remove(), 280);
    }, 3200);
  }

  /* ==========================================================================
     WELLNESS: STEP TRACKER
     ========================================================================== */
  function getTodaySteps() {
    return state.stepsHistory[state.todayDateStr] || 0;
  }

  function setTodaySteps(val) {
    const count = Math.max(0, parseInt(val, 10) || 0);
    state.stepsHistory[state.todayDateStr] = count;
    localStorage.setItem('campx_steps_history', JSON.stringify(state.stepsHistory));
    renderStepGauge();
    renderDailyHarmony();
    renderAnalyticsCharts();
  }

  function addSteps(amt) {
    const current = getTodaySteps();
    setTodaySteps(current + amt);
    showToast(`Added ${amt.toLocaleString()} steps!`);
  }

  function renderStepGauge() {
    const steps = getTodaySteps();
    const goal = state.stepGoal;
    const pct = Math.min(100, Math.round((steps / goal) * 100));

    // Wellness View Elements
    const ring = document.getElementById('wellness-step-ring');
    const num = document.getElementById('wellness-steps-num');
    const pctEl = document.getElementById('wellness-steps-pct');

    if (num) num.textContent = steps.toLocaleString();
    if (pctEl) pctEl.textContent = `${pct}% of target`;

    if (ring) {
      const offset = GAUGE_CIRCUMFERENCE - (pct / 100) * GAUGE_CIRCUMFERENCE;
      ring.style.strokeDashoffset = offset;
    }

    // Overview Vitals Card
    const ovStepsVal = document.getElementById('overview-steps-val');
    const ovStepsSub = document.getElementById('overview-steps-sub');
    if (ovStepsVal) ovStepsVal.textContent = steps.toLocaleString();
    if (ovStepsSub) ovStepsSub.textContent = `Goal: ${(goal / 1000).toFixed(0)}k (${pct}%)`;
  }

  // Mobile Motion Sensor Integration
  function initMotionSensor() {
    const permBtn = document.getElementById('motion-perm-btn');
    const caption = document.getElementById('sensor-caption');

    if (!permBtn) return;

    if (window.DeviceMotionEvent) {
      permBtn.addEventListener('click', async () => {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          try {
            const resp = await DeviceMotionEvent.requestPermission();
            if (resp === 'granted') {
              startMotionListener();
              caption.textContent = 'Motion Sensor Active';
              permBtn.style.display = 'none';
              showToast('Motion sensor connected!');
            } else {
              showToast('Motion sensor access declined.');
            }
          } catch (e) {
            showToast('Unable to request motion permission.');
          }
        } else {
          startMotionListener();
          caption.textContent = 'Motion Sensor Active';
          permBtn.style.display = 'none';
          showToast('Motion sensor connected!');
        }
      });
    } else {
      permBtn.style.display = 'none';
      if (caption) caption.textContent = 'Manual Input (Desktop)';
    }
  }

  let lastStepTimestamp = 0;
  function startMotionListener() {
    window.addEventListener('devicemotion', (evt) => {
      const acc = evt.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      const now = Date.now();
      if (mag > 12.5 && now - lastStepTimestamp > 320) {
        lastStepTimestamp = now;
        setTodaySteps(getTodaySteps() + 1);
      }
    });
  }

  /* ==========================================================================
     WELLNESS: WATER TRACKER
     ========================================================================== */
  function getTodayWater() {
    if (!state.waterHistory[state.todayDateStr]) {
      state.waterHistory[state.todayDateStr] = { total: 0, entries: [] };
    }
    return state.waterHistory[state.todayDateStr];
  }

  function addWater(amt) {
    const rec = getTodayWater();
    rec.total += amt;
    rec.entries.push(amt);
    localStorage.setItem('campx_water_history', JSON.stringify(state.waterHistory));
    renderWaterGauge();
    renderDailyHarmony();
    renderAnalyticsCharts();
    showToast(`Logged +${amt} ml water!`);
  }

  function undoLastWater() {
    const rec = getTodayWater();
    if (!rec.entries || rec.entries.length === 0) {
      showToast('No water entries to undo today.');
      return;
    }
    const popped = rec.entries.pop();
    rec.total = Math.max(0, rec.total - popped);
    localStorage.setItem('campx_water_history', JSON.stringify(state.waterHistory));
    renderWaterGauge();
    renderDailyHarmony();
    renderAnalyticsCharts();
    showToast(`Undid -${popped} ml.`);
  }

  function renderWaterGauge() {
    const rec = getTodayWater();
    const consumed = rec.total;
    const goal = state.waterGoal;
    const pct = Math.min(100, Math.round((consumed / goal) * 100));
    const remaining = Math.max(0, goal - consumed);

    const ring = document.getElementById('wellness-water-ring');
    const num = document.getElementById('wellness-water-num');
    const rem = document.getElementById('wellness-water-rem');

    if (num) num.textContent = consumed.toLocaleString();
    if (rem) {
      rem.textContent = remaining > 0 ? `${remaining.toLocaleString()} ml remaining` : 'Target Achieved!';
    }

    if (ring) {
      const offset = GAUGE_CIRCUMFERENCE - (pct / 100) * GAUGE_CIRCUMFERENCE;
      ring.style.strokeDashoffset = offset;
    }

    // Dynamic Translucent Water Tumbler Fill Animation
    const tumblerRect = document.getElementById('water-tumbler-fill-rect');
    const waveGroup = document.getElementById('water-wave-group');
    if (tumblerRect) {
      const maxH = 138;
      const fillH = (pct / 100) * maxH;
      const topY = 158 - fillH;
      tumblerRect.setAttribute('y', topY);
      tumblerRect.setAttribute('height', fillH);
      if (waveGroup) {
        waveGroup.setAttribute('transform', `translate(0, ${topY})`);
        waveGroup.style.display = pct > 0 ? 'block' : 'none';
      }
    }

    // Overview Vitals Card
    const ovWaterVal = document.getElementById('overview-water-val');
    const ovWaterSub = document.getElementById('overview-water-sub');
    if (ovWaterVal) ovWaterVal.textContent = `${consumed.toLocaleString()} ml`;
    if (ovWaterSub) ovWaterSub.textContent = `Goal: ${(goal / 1000).toFixed(1)}L (${pct}%)`;
  }

  function setupHydrationTimer() {
    clearInterval(hydrationTimer);
    if (state.hydrationActive && state.hydrationIntervalMins > 0) {
      const ms = state.hydrationIntervalMins * 60 * 1000;
      hydrationTimer = setInterval(() => {
        sendNotification('Hydration Reminder', 'Take a sip of water and stay energized!');
      }, ms);
    }
  }

  /* ==========================================================================
     WELLNESS: SLEEP TRACKER
     ========================================================================== */
  function calculateSleep(bedtime, waketime) {
    const [bH, bM] = bedtime.split(':').map(Number);
    const [wH, wM] = waketime.split(':').map(Number);

    let start = bH * 60 + bM;
    let end = wH * 60 + wM;

    if (end <= start) {
      end += 24 * 60; // Overnight rollover
    }

    const diff = end - start;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    const durationHrs = +(diff / 60).toFixed(2);

    return { hrs, mins, durationHrs };
  }

  function updateSleepDisplay() {
    const bInput = document.getElementById('wellness-bedtime-input');
    const wInput = document.getElementById('wellness-waketime-input');
    const durEl = document.getElementById('wellness-sleep-calculated');
    const qualityTag = document.getElementById('wellness-sleep-quality-tag');

    if (!bInput || !wInput) return;

    const { hrs, mins, durationHrs } = calculateSleep(bInput.value, wInput.value);

    if (durEl) durEl.textContent = `${hrs}h ${mins}m`;

    if (qualityTag) {
      qualityTag.className = 'quality-tag';
      if (durationHrs >= 7.5) {
        qualityTag.textContent = 'Optimal Rest';
        qualityTag.classList.add('tag-optimal');
      } else if (durationHrs >= 6.5) {
        qualityTag.textContent = 'Good Rest';
        qualityTag.classList.add('tag-good');
      } else {
        qualityTag.textContent = 'Needs More Sleep';
        qualityTag.classList.add('tag-fair');
      }
    }
  }

  function logSleep() {
    const bInput = document.getElementById('wellness-bedtime-input');
    const wInput = document.getElementById('wellness-waketime-input');
    if (!bInput || !wInput) return;

    const { durationHrs } = calculateSleep(bInput.value, wInput.value);

    state.sleepHistory[state.todayDateStr] = {
      bedtime: bInput.value,
      waketime: wInput.value,
      durationHrs
    };

    localStorage.setItem('campx_sleep_history', JSON.stringify(state.sleepHistory));
    renderDailyHarmony();
    renderAnalyticsCharts();
    showToast(`Recorded ${durationHrs} hours of sleep!`);
  }

  let lastCheckedMin = -1;
  function checkBedtimeAlert(now) {
    if (!state.bedtimeAlertActive || !state.bedtimeAlertTime) return;

    const curMin = now.getMinutes();
    if (curMin === lastCheckedMin) return;
    lastCheckedMin = curMin;

    const curHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (curHHMM === state.bedtimeAlertTime) {
      sendNotification('Bedtime Wind-Down', 'Time to turn off screens and prepare for rest.');
    }
  }

  /* ==========================================================================
     OVERVIEW: DAILY HARMONY INDEX (0 - 100%)
     ========================================================================== */
  function renderDailyHarmony() {
    // 1. Steps
    const steps = getTodaySteps();
    const stepsPct = Math.min(100, Math.round((steps / state.stepGoal) * 100));

    // 2. Water
    const water = getTodayWater().total;
    const waterPct = Math.min(100, Math.round((water / state.waterGoal) * 100));

    // 3. Sleep
    const sleepRec = state.sleepHistory[state.todayDateStr];
    const sleepHrs = sleepRec ? sleepRec.durationHrs : 0;
    const sleepPct = Math.min(100, Math.round((sleepHrs / state.sleepGoal) * 100));

    // 4. Tasks
    const totalT = state.tasks.length;
    const doneT = state.tasks.filter(t => t.completed).length;
    const tasksPct = totalT > 0 ? Math.round((doneT / totalT) * 100) : 100;

    // Daily Score
    const dailyScore = Math.round((stepsPct + waterPct + sleepPct + tasksPct) / 4);

    const ring = document.getElementById('overview-score-ring');
    const num = document.getElementById('overview-score-num');
    const summaryText = document.getElementById('overview-summary-phrase');

    if (num) num.textContent = `${dailyScore}%`;

    if (ring) {
      const offset = HARMONY_CIRCUMFERENCE - (dailyScore / 100) * HARMONY_CIRCUMFERENCE;
      ring.style.strokeDashoffset = offset;
    }

    // Apple Fitness Concentric Activity Rings
    const ringSteps = document.getElementById('overview-ring-steps');
    const ringWater = document.getElementById('overview-ring-water');
    const ringSleep = document.getElementById('overview-ring-sleep');
    if (ringSteps) {
      const circ = 2 * Math.PI * 54;
      ringSteps.style.strokeDashoffset = circ - (stepsPct / 100) * circ;
    }
    if (ringWater) {
      const circ = 2 * Math.PI * 42;
      ringWater.style.strokeDashoffset = circ - (waterPct / 100) * circ;
    }
    if (ringSleep) {
      const circ = 2 * Math.PI * 30;
      ringSleep.style.strokeDashoffset = circ - (sleepPct / 100) * circ;
    }

    const sPct = document.getElementById('overview-steps-pct');
    if (sPct) sPct.textContent = `${stepsPct}%`;
    const wPct = document.getElementById('overview-water-pct');
    if (wPct) wPct.textContent = `${waterPct}%`;
    const slPct = document.getElementById('overview-sleep-pct');
    if (slPct) slPct.textContent = `${sleepPct}%`;
    const tPct = document.getElementById('overview-tasks-pct');
    if (tPct) tPct.textContent = `${tasksPct}%`;

    // Overview Sleep vitals box
    const ovSleepVal = document.getElementById('overview-sleep-val');
    const ovSleepSub = document.getElementById('overview-sleep-sub');
    if (ovSleepVal) ovSleepVal.textContent = `${sleepHrs.toFixed(1)}h`;
    if (ovSleepSub) ovSleepSub.textContent = `Target: ${state.sleepGoal.toFixed(0)}h (${sleepPct}%)`;

    // Update Wellness View Sleep Ring
    const sleepRing = document.getElementById('wellness-sleep-ring');
    if (sleepRing) {
      const offset = GAUGE_CIRCUMFERENCE - (sleepPct / 100) * GAUGE_CIRCUMFERENCE;
      sleepRing.style.strokeDashoffset = offset;
    }

    // Dynamic Summary
    if (summaryText) {
      const todayClasses = getClassesForToday();
      const pendingTasks = state.tasks.filter(t => !t.completed).length;
      summaryText.textContent = `Take a breath. You have ${todayClasses.length} class${todayClasses.length === 1 ? '' : 'es'} today, ${pendingTasks} task${pendingTasks === 1 ? '' : 's'} pending, and a daily wellness score of ${dailyScore}%.`;
    }
  }

  /* ==========================================================================
     CLASS SCHEDULE & NEXT CLASS COUNTDOWN
     ========================================================================== */
  async function fetchClasses() {
    try {
      const res = await fetch('/api/classes');
      if (res.ok) {
        state.classes = await res.json();
        localStorage.setItem('campx_cached_classes', JSON.stringify(state.classes));
      }
    } catch (e) {
      console.warn('Using cached classes:', e);
    }
    renderClasses();
    updateNextClassSpotlight();
    renderDailyHarmony();
  }

  function getDayName(d) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[d.getDay()];
  }

  function getClassesForToday() {
    const todayName = getDayName(new Date());
    return state.classes.filter(c => Array.isArray(c.days) && c.days.includes(todayName));
  }

  function renderClasses() {
    const container = document.getElementById('schedule-cards-grid');
    const emptyState = document.getElementById('schedule-empty-view');
    if (!container) return;

    container.innerHTML = '';

    const todayName = getDayName(new Date());
    let list = state.scheduleFilter === 'today' ? getClassesForToday() : [...state.classes];

    list.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    if (list.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const now = new Date();
    const curHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    list.forEach(cls => {
      const card = document.createElement('div');
      card.className = 'floating-card timetable-card';

      const isToday = cls.days && cls.days.includes(todayName);
      let statusTag = '';
      if (isToday) {
        if (cls.start_time && cls.end_time && curHHMM >= cls.start_time && curHHMM <= cls.end_time) {
          statusTag = '<span class="pastel-badge badge-mint">In Session</span>';
        } else if (cls.start_time && curHHMM < cls.start_time) {
          statusTag = '<span class="pastel-badge badge-coral">Upcoming</span>';
        } else {
          statusTag = '<span class="pastel-badge" style="background: rgba(15,35,65,0.06); color: var(--text-muted);">Completed</span>';
        }
      }

      const daysBadges = (cls.days || []).map(d => {
        const isCurrent = d === todayName;
        return `<span class="t-day-pill ${isCurrent ? 'active-today' : ''}">${d.slice(0, 3)}</span>`;
      }).join('');

      card.innerHTML = `
        <div class="t-card-top">
          <div class="t-title-block">
            <h4>${escapeHtml(cls.subject)}</h4>
            <span class="t-code">${escapeHtml(cls.code || '')} &bull; ${escapeHtml(cls.class_num || 'Lecture')}</span>
          </div>
          <div class="t-actions">
            ${statusTag}
            <button type="button" class="btn-icon-subtle edit-cls-btn" data-id="${cls.id}" title="Edit Course">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button type="button" class="btn-icon-subtle delete del-cls-btn" data-id="${cls.id}" title="Delete Course">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        <div class="t-meta-stack">
          <div class="t-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4"></path></svg>
            <span><strong>${escapeHtml(cls.block || 'Academic Block')}</strong> &bull; ${escapeHtml(cls.room || 'Room')}</span>
          </div>
          <div class="t-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>${escapeHtml(cls.start_time || '')} &ndash; ${escapeHtml(cls.end_time || '')}</span>
          </div>
          ${cls.faculty ? `
          <div class="t-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>${escapeHtml(cls.faculty)}</span>
          </div>` : ''}
        </div>

        <div class="t-days-row">
          ${daysBadges}
        </div>
      `;

      card.querySelector('.edit-cls-btn').addEventListener('click', () => openEditClassModal(cls));
      card.querySelector('.del-cls-btn').addEventListener('click', () => deleteClass(cls.id));

      container.appendChild(card);
    });
  }

  function startCountdownTimer() {
    clearInterval(countdownTimer);
    updateNextClassSpotlight();
    countdownTimer = setInterval(updateNextClassSpotlight, 1000);
  }

  function updateNextClassSpotlight() {
    const todayClasses = getClassesForToday();
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const nowSecs = now.getSeconds();

    // Elements in Overview
    const ovSubject = document.getElementById('spotlight-subject-name');
    const ovCode = document.getElementById('spotlight-code-badge');
    const ovBlock = document.getElementById('spotlight-block-val');
    const ovRoom = document.getElementById('spotlight-room-val');
    const ovTime = document.getElementById('spotlight-time-val');
    const ovFaculty = document.getElementById('spotlight-faculty-text');
    const ovStatus = document.getElementById('spotlight-status-text');
    const ovCountdown = document.getElementById('spotlight-countdown-pill');

    // Elements in Schedule View
    const schSubject = document.getElementById('timetable-next-subject');
    const schCode = document.getElementById('timetable-next-code');
    const schBlock = document.getElementById('timetable-block-val');
    const schRoom = document.getElementById('timetable-room-val');
    const schClassnum = document.getElementById('timetable-classnum-val');
    const schTime = document.getElementById('timetable-time-val');
    const schFaculty = document.getElementById('timetable-faculty-val');
    const schStatus = document.getElementById('timetable-live-status');
    const schCountdown = document.getElementById('timetable-live-countdown');
    const schHint = document.getElementById('timetable-countdown-sub');

    if (todayClasses.length === 0) {
      const noneTxt = 'No classes today';
      if (ovSubject) ovSubject.textContent = noneTxt;
      if (ovCode) ovCode.textContent = 'REST DAY';
      if (ovBlock) ovBlock.textContent = 'Campus Free';
      if (ovRoom) ovRoom.textContent = 'Relax';
      if (ovTime) ovTime.textContent = 'All Day';
      if (ovFaculty) ovFaculty.textContent = 'Personal Study';
      if (ovStatus) ovStatus.textContent = 'NO SCHEDULED CLASSES';
      if (ovCountdown) ovCountdown.textContent = '--:--';

      if (schSubject) schSubject.textContent = noneTxt;
      if (schCode) schCode.textContent = 'FREE DAY';
      if (schBlock) schBlock.textContent = 'No venue';
      if (schRoom) schRoom.textContent = 'Study';
      if (schClassnum) schClassnum.textContent = 'Self-Paced';
      if (schTime) schTime.textContent = 'All Day';
      if (schFaculty) schFaculty.textContent = 'Independent Study';
      if (schStatus) schStatus.textContent = 'ALL CLEAR TODAY';
      if (schCountdown) schCountdown.textContent = 'Rest Day';
      if (schHint) schHint.textContent = 'Enjoy your downtime';
      return;
    }

    todayClasses.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    let activeClass = null;
    let nextClass = null;

    for (const cls of todayClasses) {
      if (!cls.start_time || !cls.end_time) continue;
      const [sH, sM] = cls.start_time.split(':').map(Number);
      const [eH, eM] = cls.end_time.split(':').map(Number);
      const startMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;

      if (nowMins >= startMin && nowMins < endMin) {
        activeClass = cls;
        break;
      } else if (nowMins < startMin && !nextClass) {
        nextClass = cls;
      }
    }

    const target = activeClass || nextClass || todayClasses[0];

    // Populate Overview Card
    if (ovSubject) ovSubject.textContent = target.subject;
    if (ovCode) ovCode.textContent = target.code || 'COURSE';
    if (ovBlock) ovBlock.textContent = target.block || 'Academic Block';
    if (ovRoom) ovRoom.textContent = target.room || 'Room';
    if (ovTime) ovTime.textContent = `${target.start_time} - ${target.end_time}`;
    if (ovFaculty) ovFaculty.textContent = target.faculty || 'Instructor';

    // Populate Schedule Hero Card
    if (schSubject) schSubject.textContent = target.subject;
    if (schCode) schCode.textContent = target.code || 'COURSE';
    if (schBlock) schBlock.textContent = target.block || 'Academic Block';
    if (schRoom) schRoom.textContent = target.room || 'Room';
    if (schClassnum) schClassnum.textContent = target.class_num || 'Lecture';
    if (schTime) schTime.textContent = `${target.start_time} - ${target.end_time}`;
    if (schFaculty) schFaculty.textContent = target.faculty || 'Instructor';

    if (activeClass) {
      const [eH, eM] = activeClass.end_time.split(':').map(Number);
      const endTotalSec = (eH * 60 + eM) * 60;
      const curTotalSec = (now.getHours() * 60 + now.getMinutes()) * 60 + nowSecs;
      const remSec = Math.max(0, endTotalSec - curTotalSec);
      const formatted = formatHMS(remSec);

      if (ovStatus) ovStatus.textContent = 'CLASS CURRENTLY IN SESSION';
      if (ovCountdown) ovCountdown.textContent = formatted;

      if (schStatus) schStatus.textContent = 'IN SESSION NOW';
      if (schCountdown) schCountdown.textContent = formatted;
      if (schHint) schHint.textContent = 'Remaining in class';
    } else if (nextClass) {
      const [sH, sM] = nextClass.start_time.split(':').map(Number);
      const startTotalSec = (sH * 60 + sM) * 60;
      const curTotalSec = (now.getHours() * 60 + now.getMinutes()) * 60 + nowSecs;
      const diffSec = Math.max(0, startTotalSec - curTotalSec);
      const formatted = formatHMS(diffSec);

      if (ovStatus) ovStatus.textContent = 'NEXT CLASS TODAY';
      if (ovCountdown) ovCountdown.textContent = formatted;

      if (schStatus) schStatus.textContent = 'NEXT UPCOMING CLASS';
      if (schCountdown) schCountdown.textContent = formatted;
      if (schHint) schHint.textContent = `Starts at ${nextClass.start_time}`;

      // Check class reminder alert
      checkClassReminderAlert(nextClass, diffSec);
    } else {
      if (ovStatus) ovStatus.textContent = 'CLASSES COMPLETE TODAY';
      if (ovCountdown) ovCountdown.textContent = 'Done!';

      if (schStatus) schStatus.textContent = 'CLASSES COMPLETE FOR TODAY';
      if (schCountdown) schCountdown.textContent = 'Done!';
      if (schHint) schHint.textContent = 'Well done today!';
    }
  }

  function formatHMS(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function checkClassReminderAlert(cls, remainingSec) {
    const alertSec = state.classReminderMins * 60;
    if (remainingSec <= alertSec && remainingSec > alertSec - 60) {
      const key = `${cls.id}_${state.todayDateStr}_${state.classReminderMins}`;
      if (!state.alertedClasses.has(key)) {
        state.alertedClasses.add(key);
        sendNotification(
          `Class Starting in ${state.classReminderMins} Minutes`,
          `${cls.subject} (${cls.code}) in ${cls.block}, ${cls.room}`
        );
      }
    }
  }

  // Schedule Modal Handlers
  function openAddClassModal() {
    const modal = document.getElementById('modal-class');
    document.getElementById('modal-class-title').textContent = 'Add Course to Schedule';
    document.getElementById('modal-class-id').value = '';
    document.getElementById('form-class-schedule').reset();
    document.getElementById('error-class-subject').textContent = '';
    document.getElementById('error-class-days').textContent = '';
    modal.classList.remove('hidden');
  }

  function openEditClassModal(cls) {
    const modal = document.getElementById('modal-class');
    document.getElementById('modal-class-title').textContent = 'Edit Course Details';
    document.getElementById('modal-class-id').value = cls.id;
    document.getElementById('input-class-subject').value = cls.subject || '';
    document.getElementById('input-class-code').value = cls.code || '';
    document.getElementById('input-class-number').value = cls.class_num || '';
    document.getElementById('input-class-block').value = cls.block || '';
    document.getElementById('input-class-room').value = cls.room || '';
    document.getElementById('input-class-start').value = cls.start_time || '09:30';
    document.getElementById('input-class-end').value = cls.end_time || '11:00';
    document.getElementById('input-class-faculty').value = cls.faculty || '';

    const checks = document.querySelectorAll('input[name="sched-day"]');
    checks.forEach(c => {
      c.checked = Array.isArray(cls.days) && cls.days.includes(c.value);
    });

    document.getElementById('error-class-subject').textContent = '';
    document.getElementById('error-class-days').textContent = '';
    modal.classList.remove('hidden');
  }

  async function handleClassSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modal-class-id').value;
    const subject = document.getElementById('input-class-subject').value.trim();
    const code = document.getElementById('input-class-code').value.trim();
    const class_num = document.getElementById('input-class-number').value.trim();
    const block = document.getElementById('input-class-block').value.trim();
    const room = document.getElementById('input-class-room').value.trim();
    const start_time = document.getElementById('input-class-start').value;
    const end_time = document.getElementById('input-class-end').value;
    const faculty = document.getElementById('input-class-faculty').value.trim();

    const days = [];
    document.querySelectorAll('input[name="sched-day"]:checked').forEach(c => days.push(c.value));

    let err = false;
    const sErr = document.getElementById('error-class-subject');
    const dErr = document.getElementById('error-class-days');

    if (!subject) {
      sErr.textContent = 'Please enter a course name.';
      err = true;
    }
    if (days.length === 0) {
      dErr.textContent = 'Select at least one day.';
      err = true;
    }
    if (err) return;

    const payload = { subject, code, class_num, block, room, start_time, end_time, days, faculty };

    try {
      if (id) {
        const res = await fetch(`/api/classes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = state.classes.findIndex(c => c.id === parseInt(id, 10));
          if (idx !== -1) state.classes[idx] = updated;
          showToast('Course updated!');
        }
      } else {
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          state.classes.push(created);
          showToast('Course added to schedule!');
        }
      }
      localStorage.setItem('campx_cached_classes', JSON.stringify(state.classes));
      document.getElementById('modal-class').classList.add('hidden');
      renderClasses();
      updateNextClassSpotlight();
      renderDailyHarmony();
    } catch (e) {
      showToast('Error saving course.');
    }
  }

  async function deleteClass(id) {
    if (!confirm('Remove this course from your schedule?')) return;
    try {
      const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        state.classes = state.classes.filter(c => c.id !== id);
        localStorage.setItem('campx_cached_classes', JSON.stringify(state.classes));
        renderClasses();
        updateNextClassSpotlight();
        renderDailyHarmony();
        showToast('Course removed.');
      }
    } catch (e) {
      showToast('Failed to delete course.');
    }
  }

  /* ==========================================================================
     TASK PLANNER (FLASK API + LOCAL STORAGE)
     ========================================================================= */
  async function fetchTasks() {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        state.tasks = await res.json();
        localStorage.setItem('campx_cached_tasks', JSON.stringify(state.tasks));
      }
    } catch (e) {
      console.warn('Using cached tasks:', e);
    }
    updateTaskMetrics();
    renderTasks();
    renderOverviewTasks();
    renderDailyHarmony();
    renderAnalyticsCharts();
  }

  async function handleTaskCreate(e) {
    e.preventDefault();
    const titleInput = document.getElementById('task-input-title');
    const deadlineInput = document.getElementById('task-input-deadline');
    const descInput = document.getElementById('task-input-desc');
    const errTitle = document.getElementById('task-error-title');
    const errDeadline = document.getElementById('task-error-deadline');

    const title = titleInput.value.trim();
    const deadline = deadlineInput.value;
    const description = descInput.value.trim();

    let err = false;
    if (!title) {
      errTitle.textContent = 'Please enter an assignment title.';
      err = true;
    }
    if (!deadline) {
      errDeadline.textContent = 'Please select a deadline.';
      err = true;
    }
    if (err) return;

    const btn = document.getElementById('task-submit-button');
    btn.disabled = true;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, deadline, description })
      });

      if (res.ok) {
        const created = await res.json();
        state.tasks.unshift(created);
        localStorage.setItem('campx_cached_tasks', JSON.stringify(state.tasks));

        titleInput.value = '';
        descInput.value = '';
        errTitle.textContent = '';
        errDeadline.textContent = '';

        updateTaskMetrics();
        renderTasks();
        renderOverviewTasks();
        renderDailyHarmony();
        renderAnalyticsCharts();
        showToast('Assignment added to planner!');
      } else {
        const errJson = await res.json();
        showToast(errJson.error || 'Failed to add task.');
      }
    } catch (e) {
      showToast('Network error adding assignment.');
    } finally {
      btn.disabled = false;
    }
  }

  async function toggleTaskDone(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const newCompleted = !task.completed;

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted })
      });

      if (res.ok) {
        const updated = await res.json();
        const idx = state.tasks.findIndex(t => t.id === id);
        if (idx !== -1) state.tasks[idx] = updated;
        localStorage.setItem('campx_cached_tasks', JSON.stringify(state.tasks));

        updateTaskMetrics();
        renderTasks();
        renderOverviewTasks();
        renderDailyHarmony();
        renderAnalyticsCharts();
        showToast(updated.completed ? 'Assignment marked complete!' : 'Assignment returned to pending.');
      }
    } catch (e) {
      showToast('Could not update task.');
    }
  }

  function openEditTaskModal(task) {
    const modal = document.getElementById('modal-task-edit');
    document.getElementById('modal-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title || '';
    document.getElementById('edit-task-deadline').value = task.deadline || '';
    document.getElementById('edit-task-description').value = task.description || '';
    document.getElementById('edit-task-completed').checked = !!task.completed;
    document.getElementById('edit-task-error').textContent = '';
    modal.classList.remove('hidden');
  }

  async function handleEditTaskSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modal-task-id').value;
    const title = document.getElementById('edit-task-title').value.trim();
    const deadline = document.getElementById('edit-task-deadline').value;
    const description = document.getElementById('edit-task-description').value.trim();
    const completed = document.getElementById('edit-task-completed').checked;

    if (!title) {
      document.getElementById('edit-task-error').textContent = 'Title is required.';
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, deadline, description, completed })
      });

      if (res.ok) {
        const updated = await res.json();
        const idx = state.tasks.findIndex(t => t.id === parseInt(id, 10));
        if (idx !== -1) state.tasks[idx] = updated;
        localStorage.setItem('campx_cached_tasks', JSON.stringify(state.tasks));

        document.getElementById('modal-task-edit').classList.add('hidden');
        updateTaskMetrics();
        renderTasks();
        renderOverviewTasks();
        renderDailyHarmony();
        renderAnalyticsCharts();
        showToast('Assignment updated!');
      }
    } catch (e) {
      showToast('Error updating assignment.');
    }
  }

  async function deleteTask(id) {
    if (!confirm('Delete this assignment?')) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        localStorage.setItem('campx_cached_tasks', JSON.stringify(state.tasks));
        updateTaskMetrics();
        renderTasks();
        renderOverviewTasks();
        renderDailyHarmony();
        renderAnalyticsCharts();
        showToast('Assignment deleted.');
      }
    } catch (e) {
      showToast('Failed to delete assignment.');
    }
  }

  function updateTaskMetrics() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pending = total - completed;

    const tEl = document.getElementById('planner-count-total');
    const pEl = document.getElementById('planner-count-pending');
    const dEl = document.getElementById('planner-count-done');
    const ovCounter = document.getElementById('overview-pending-counter');

    if (tEl) tEl.textContent = total;
    if (pEl) pEl.textContent = pending;
    if (dEl) dEl.textContent = completed;
    if (ovCounter) ovCounter.textContent = `${pending} pending`;
  }

  function renderTasks() {
    const container = document.getElementById('planner-items-container');
    const emptyState = document.getElementById('planner-empty-view');
    if (!container) return;

    container.innerHTML = '';

    const query = state.taskSearch.toLowerCase();
    const filtered = state.tasks.filter(t => {
      if (state.taskFilter === 'pending' && t.completed) return false;
      if (state.taskFilter === 'completed' && !t.completed) return false;
      if (query) {
        return (t.title || '').toLowerCase().includes(query) || (t.description || '').toLowerCase().includes(query);
      }
      return true;
    });

    if (filtered.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const todayStr = state.todayDateStr;

    filtered.forEach(task => {
      const card = document.createElement('div');
      card.className = `planner-task-item ${task.completed ? 'is-done' : ''}`;

      const isOverdue = task.deadline && !task.completed && task.deadline < todayStr;

      card.innerHTML = `
        <button type="button" class="planner-check-btn" aria-label="${task.completed ? 'Mark task as pending' : 'Mark task as complete'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>

        <div class="planner-task-content">
          <div class="planner-task-title">${escapeHtml(task.title)}</div>
          ${task.description ? `<div class="planner-task-desc">${escapeHtml(task.description)}</div>` : ''}
          <div class="planner-task-meta">
            <span class="deadline-pill-tag ${isOverdue ? 'is-overdue' : ''}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line></svg>
              ${isOverdue ? 'Overdue: ' : ''}${escapeHtml(task.deadline || 'No deadline')}
            </span>
            <span class="pastel-badge ${task.completed ? 'badge-mint' : 'badge-coral'}">
              ${task.completed ? 'Completed' : 'Pending'}
            </span>
          </div>
        </div>

        <div class="t-actions">
          <button type="button" class="btn-icon-subtle edit-task-action-btn" title="Edit Assignment">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button type="button" class="btn-icon-subtle delete del-task-action-btn" title="Delete Assignment">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      card.querySelector('.planner-check-btn').addEventListener('click', () => toggleTaskDone(task.id));
      card.querySelector('.edit-task-action-btn').addEventListener('click', () => openEditTaskModal(task));
      card.querySelector('.del-task-action-btn').addEventListener('click', () => deleteTask(task.id));

      container.appendChild(card);
    });
  }

  // Render Priorities in Overview Screen
  function renderOverviewTasks() {
    const container = document.getElementById('overview-tasks-container');
    if (!container) return;

    container.innerHTML = '';

    const priorityTasks = state.tasks.slice(0, 3);
    if (priorityTasks.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.8438rem;">No assignments active right now.</div>`;
      return;
    }

    priorityTasks.forEach(task => {
      const item = document.createElement('div');
      item.className = `mini-task-item ${task.completed ? 'is-done' : ''}`;
      item.innerHTML = `
        <div class="mini-task-left">
          <button type="button" class="mini-check-circle" aria-label="Toggle task">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <span class="mini-task-title">${escapeHtml(task.title)}</span>
        </div>
        <span class="mini-task-deadline">${escapeHtml(task.deadline || '')}</span>
      `;
      item.querySelector('.mini-check-circle').addEventListener('click', () => toggleTaskDone(task.id));
      container.appendChild(item);
    });
  }

  /* ==========================================================================
     ANALYTICS: PURE SVG CHARTS (CLEAN, MINIMAL, SPACIOUS)
     ========================================================================== */
  function getLast7Days() {
    const list = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      list.push(getLocalDateString(d));
    }
    return list;
  }

  function renderAnalyticsCharts() {
    const days = getLast7Days();
    renderStepsChart(days);
    renderWaterChart(days);
    renderSleepChart(days);
    renderTasksDonut();
  }

  function renderStepsChart(days) {
    const host = document.getElementById('insights-chart-steps');
    const avgEl = document.getElementById('chart-steps-average');
    if (!host) return;

    const values = days.map(d => state.stepsHistory[d] || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / 7);
    if (avgEl) avgEl.textContent = `Avg: ${avg.toLocaleString()} / day`;

    const maxVal = Math.max(state.stepGoal, ...values, 5000);
    const w = 320;
    const h = 160;
    const barW = 22;
    const spacing = (w - 7 * barW) / 8;

    const isDark = state.theme === 'dark';
    const barColor = isDark ? '#ff6b70' : '#ff5a5f';
    const labelColor = isDark ? '#94a3b8' : '#62758e';

    let bars = '';
    days.forEach((dayStr, idx) => {
      const val = values[idx];
      const barH = Math.max(5, (val / maxVal) * (h - 35));
      const x = spacing + idx * (barW + spacing);
      const y = h - 25 - barH;
      const letter = new Date(dayStr).toLocaleDateString([], { weekday: 'narrow' });

      bars += `
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" fill="${barColor}" opacity="${idx === 6 ? '1' : '0.65'}">
          <title>${dayStr}: ${val.toLocaleString()} steps</title>
        </rect>
        <text x="${x + barW / 2}" y="${h - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="${labelColor}">${letter}</text>
      `;
    });

    host.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: 100%;">
        <line x1="0" y1="${h - 25}" x2="${w}" y2="${h - 25}" stroke="${labelColor}" stroke-opacity="0.18" stroke-width="1" />
        ${bars}
      </svg>
    `;
  }

  function renderWaterChart(days) {
    const host = document.getElementById('insights-chart-water');
    const avgEl = document.getElementById('chart-water-average');
    if (!host) return;

    const values = days.map(d => (state.waterHistory[d] ? state.waterHistory[d].total : 0));
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / 7);
    if (avgEl) avgEl.textContent = `Avg: ${avg.toLocaleString()} ml / day`;

    const maxVal = Math.max(state.waterGoal, ...values, 2000);
    const w = 320;
    const h = 160;
    const barW = 22;
    const spacing = (w - 7 * barW) / 8;

    const isDark = state.theme === 'dark';
    const barColor = isDark ? '#38bdf8' : '#0284c7';
    const labelColor = isDark ? '#94a3b8' : '#62758e';

    let bars = '';
    days.forEach((dayStr, idx) => {
      const val = values[idx];
      const barH = Math.max(5, (val / maxVal) * (h - 35));
      const x = spacing + idx * (barW + spacing);
      const y = h - 25 - barH;
      const letter = new Date(dayStr).toLocaleDateString([], { weekday: 'narrow' });

      bars += `
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" fill="${barColor}" opacity="${idx === 6 ? '1' : '0.65'}">
          <title>${dayStr}: ${val.toLocaleString()} ml</title>
        </rect>
        <text x="${x + barW / 2}" y="${h - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="${labelColor}">${letter}</text>
      `;
    });

    host.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: 100%;">
        <line x1="0" y1="${h - 25}" x2="${w}" y2="${h - 25}" stroke="${labelColor}" stroke-opacity="0.18" stroke-width="1" />
        ${bars}
      </svg>
    `;
  }

  function renderSleepChart(days) {
    const host = document.getElementById('insights-chart-sleep');
    const avgEl = document.getElementById('chart-sleep-average');
    if (!host) return;

    const values = days.map(d => (state.sleepHistory[d] ? state.sleepHistory[d].durationHrs : 0));
    const active = values.filter(v => v > 0);
    const avg = active.length > 0 ? (active.reduce((a, b) => a + b, 0) / active.length).toFixed(1) : '0.0';
    if (avgEl) avgEl.textContent = `Avg: ${avg} hrs / night`;

    const maxVal = 10;
    const w = 320;
    const h = 160;
    const barW = 22;
    const spacing = (w - 7 * barW) / 8;

    const isDark = state.theme === 'dark';
    const barColor = isDark ? '#a78bfa' : '#7c3aed';
    const labelColor = isDark ? '#94a3b8' : '#62758e';

    let bars = '';
    days.forEach((dayStr, idx) => {
      const val = values[idx];
      const barH = Math.max(4, (val / maxVal) * (h - 35));
      const x = spacing + idx * (barW + spacing);
      const y = h - 25 - barH;
      const letter = new Date(dayStr).toLocaleDateString([], { weekday: 'narrow' });

      bars += `
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" fill="${barColor}" opacity="${idx === 6 ? '1' : '0.65'}">
          <title>${dayStr}: ${val} hrs</title>
        </rect>
        <text x="${x + barW / 2}" y="${h - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="${labelColor}">${letter}</text>
      `;
    });

    const targetY = h - 25 - (8 / maxVal) * (h - 35);

    host.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: 100%;">
        <line x1="0" y1="${targetY}" x2="${w}" y2="${targetY}" stroke="${barColor}" stroke-dasharray="3 3" stroke-width="1.2" opacity="0.6" />
        <line x1="0" y1="${h - 25}" x2="${w}" y2="${h - 25}" stroke="${labelColor}" stroke-opacity="0.18" stroke-width="1" />
        ${bars}
      </svg>
    `;
  }

  function renderTasksDonut() {
    const host = document.getElementById('insights-chart-tasks');
    const rateEl = document.getElementById('chart-tasks-completion-rate');
    if (!host) return;

    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 100;

    if (rateEl) rateEl.textContent = `${rate}% Completed`;

    const isDark = state.theme === 'dark';
    const completedColor = isDark ? '#34d399' : '#059669';
    const pendingColor = isDark ? '#fbbf24' : '#d97706';
    const textPrimary = isDark ? '#f8fafc' : '#091b34';
    const textMuted = isDark ? '#94a3b8' : '#62758e';

    const circ = 2 * Math.PI * 45; // ~282.74
    const offset = circ - (rate / 100) * circ;

    host.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-around; width: 100%; height: 100%;">
        <div style="position: relative; width: 110px; height: 110px;">
          <svg viewBox="0 0 110 110" style="transform: rotate(-90deg); width: 100%; height: 100%;">
            <circle cx="55" cy="55" r="45" fill="none" stroke="${pendingColor}" stroke-width="12" opacity="0.35" />
            <circle cx="55" cy="55" r="45" fill="none" stroke="${completedColor}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition: stroke-dashoffset 1.2s ease;" />
          </svg>
          <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <span style="font-size: 1.35rem; font-weight: 800; color: ${textPrimary}; font-family: var(--font-mono);">${rate}%</span>
            <span style="font-size: 0.625rem; font-weight: 700; color: ${textMuted}; text-transform: uppercase;">Done</span>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.8125rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${completedColor};"></span>
            <span style="color: ${textMuted};">Completed:</span>
            <strong style="color: ${textPrimary}; font-family: var(--font-mono);">${completed}</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${pendingColor};"></span>
            <span style="color: ${textMuted};">Pending:</span>
            <strong style="color: ${textPrimary}; font-family: var(--font-mono);">${pending}</strong>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
     EVENT LISTENERS & BINDINGS
     ========================================================================== */
  function bindEventListeners() {
    // Tomorrow as default deadline
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const deadlineInput = document.getElementById('task-input-deadline');
    if (deadlineInput) deadlineInput.value = getLocalDateString(tom);

    // Sleep inputs
    const bIn = document.getElementById('wellness-bedtime-input');
    const wIn = document.getElementById('wellness-waketime-input');
    if (bIn) bIn.addEventListener('input', updateSleepDisplay);
    if (wIn) wIn.addEventListener('input', updateSleepDisplay);

    const logSleepBtn = document.getElementById('record-sleep-btn');
    if (logSleepBtn) logSleepBtn.addEventListener('click', logSleep);

    const bedtimeAlertBox = document.getElementById('bedtime-alert-checkbox');
    if (bedtimeAlertBox) {
      bedtimeAlertBox.addEventListener('change', (e) => {
        state.bedtimeAlertActive = e.target.checked;
        localStorage.setItem('campx_bedtime_active', String(state.bedtimeAlertActive));
        showToast(state.bedtimeAlertActive ? 'Bedtime alert set!' : 'Bedtime alert turned off.');
      });
    }

    const bedtimeTimeInput = document.getElementById('bedtime-alert-time');
    if (bedtimeTimeInput) {
      bedtimeTimeInput.addEventListener('change', (e) => {
        state.bedtimeAlertTime = e.target.value;
        localStorage.setItem('campx_bedtime_time', state.bedtimeAlertTime);
        showToast(`Bedtime alert scheduled for ${state.bedtimeAlertTime}`);
      });
    }

    // Hydration settings
    const undoWaterBtn = document.getElementById('undo-water-action-btn');
    if (undoWaterBtn) undoWaterBtn.addEventListener('click', undoLastWater);

    const hydIntervalPicker = document.getElementById('hydration-interval-picker');
    if (hydIntervalPicker) {
      hydIntervalPicker.addEventListener('change', (e) => {
        state.hydrationIntervalMins = parseInt(e.target.value, 10);
        localStorage.setItem('campx_hydration_interval', String(state.hydrationIntervalMins));
        setupHydrationTimer();
        showToast(`Hydration alerts every ${state.hydrationIntervalMins} mins.`);
      });
    }

    const hydActiveCheckbox = document.getElementById('hydration-active-checkbox');
    if (hydActiveCheckbox) {
      hydActiveCheckbox.addEventListener('change', (e) => {
        state.hydrationActive = e.target.checked;
        localStorage.setItem('campx_hydration_active', String(state.hydrationActive));
        setupHydrationTimer();
        showToast(state.hydrationActive ? 'Hydration alerts active!' : 'Hydration alerts turned off.');
      });
    }

    // Motion Sensor
    initMotionSensor();

    // Set exact steps modal
    const exactStepsBtn = document.getElementById('open-exact-steps-btn');
    const exactStepsModal = document.getElementById('modal-set-steps');
    if (exactStepsBtn && exactStepsModal) {
      exactStepsBtn.addEventListener('click', () => {
        document.getElementById('input-exact-steps').value = getTodaySteps();
        exactStepsModal.classList.remove('hidden');
      });
    }
    const closeStepsBtn = document.getElementById('close-modal-steps');
    const cancelStepsBtn = document.getElementById('cancel-modal-steps');
    if (closeStepsBtn) closeStepsBtn.addEventListener('click', () => exactStepsModal.classList.add('hidden'));
    if (cancelStepsBtn) cancelStepsBtn.addEventListener('click', () => exactStepsModal.classList.add('hidden'));

    const setStepsForm = document.getElementById('form-set-steps');
    if (setStepsForm) {
      setStepsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = document.getElementById('input-exact-steps').value;
        setTodaySteps(v);
        exactStepsModal.classList.add('hidden');
        showToast(`Today's steps set to ${v}!`);
      });
    }

    // Goals customization modal
    const openGoalsBtn = document.getElementById('open-goals-btn');
    const goalsModal = document.getElementById('modal-wellness-goals');
    if (openGoalsBtn && goalsModal) {
      openGoalsBtn.addEventListener('click', () => {
        document.getElementById('custom-goal-steps').value = state.stepGoal;
        document.getElementById('custom-goal-water').value = state.waterGoal;
        document.getElementById('custom-goal-sleep').value = state.sleepGoal;
        goalsModal.classList.remove('hidden');
      });
    }
    const closeGoalsBtn = document.getElementById('close-modal-goals');
    const cancelGoalsBtn = document.getElementById('cancel-modal-goals');
    if (closeGoalsBtn) closeGoalsBtn.addEventListener('click', () => goalsModal.classList.add('hidden'));
    if (cancelGoalsBtn) cancelGoalsBtn.addEventListener('click', () => goalsModal.classList.add('hidden'));

    const goalsForm = document.getElementById('form-wellness-goals');
    if (goalsForm) {
      goalsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.stepGoal = parseInt(document.getElementById('custom-goal-steps').value, 10) || 8000;
        state.waterGoal = parseInt(document.getElementById('custom-goal-water').value, 10) || 2500;
        state.sleepGoal = parseFloat(document.getElementById('custom-goal-sleep').value) || 8.0;

        localStorage.setItem('campx_step_goal', String(state.stepGoal));
        localStorage.setItem('campx_water_goal', String(state.waterGoal));
        localStorage.setItem('campx_sleep_goal', String(state.sleepGoal));

        document.getElementById('wellness-step-goal-tag').textContent = `Goal: ${state.stepGoal.toLocaleString()}`;
        document.getElementById('wellness-water-goal-tag').textContent = `Goal: ${state.waterGoal.toLocaleString()} ml`;
        document.getElementById('wellness-sleep-goal-tag').textContent = `Target: ${state.sleepGoal.toFixed(1)} hrs`;

        goalsModal.classList.add('hidden');
        renderStepGauge();
        renderWaterGauge();
        renderDailyHarmony();
        renderAnalyticsCharts();
        showToast('Health targets saved!');
      });
    }

    // Schedule view segment (Today vs Full Week)
    const schedSegs = document.querySelectorAll('.schedule-head-actions .seg-btn');
    schedSegs.forEach(btn => {
      btn.addEventListener('click', () => {
        schedSegs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.scheduleFilter = btn.dataset.schedFilter;
        renderClasses();
      });
    });

    const classAlertSelect = document.getElementById('class-alert-mins-select');
    if (classAlertSelect) {
      classAlertSelect.addEventListener('change', (e) => {
        state.classReminderMins = parseInt(e.target.value, 10);
        localStorage.setItem('campx_class_reminder_mins', String(state.classReminderMins));
        showToast(`Reminders set for ${state.classReminderMins} mins before class.`);
      });
    }

    // Add Class Modal
    const btnOpenAddClass = document.getElementById('btn-open-add-class');
    if (btnOpenAddClass) btnOpenAddClass.addEventListener('click', openAddClassModal);

    const closeClassBtn = document.getElementById('close-modal-class');
    const cancelClassBtn = document.getElementById('cancel-modal-class');
    const classModal = document.getElementById('modal-class');
    if (closeClassBtn) closeClassBtn.addEventListener('click', () => classModal.classList.add('hidden'));
    if (cancelClassBtn) cancelClassBtn.addEventListener('click', () => classModal.classList.add('hidden'));

    const classForm = document.getElementById('form-class-schedule');
    if (classForm) classForm.addEventListener('submit', handleClassSubmit);

    // Task Creation Form
    const taskForm = document.getElementById('planner-add-task-form');
    if (taskForm) taskForm.addEventListener('submit', handleTaskCreate);

    // Edit Task Modal
    const closeTaskBtn = document.getElementById('close-modal-task');
    const cancelTaskBtn = document.getElementById('cancel-modal-task');
    const taskModal = document.getElementById('modal-task-edit');
    if (closeTaskBtn) closeTaskBtn.addEventListener('click', () => taskModal.classList.add('hidden'));
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', () => taskModal.classList.add('hidden'));

    const editTaskForm = document.getElementById('form-task-edit');
    if (editTaskForm) editTaskForm.addEventListener('submit', handleEditTaskSubmit);

    // Task Filter Pills
    const filterPills = document.querySelectorAll('.task-filter-pill');
    filterPills.forEach(p => {
      p.addEventListener('click', () => {
        filterPills.forEach(b => b.classList.remove('active'));
        p.classList.add('active');
        state.taskFilter = p.dataset.filter;
        renderTasks();
      });
    });

    // Task Search
    const searchBox = document.getElementById('planner-search-box');
    if (searchBox) {
      searchBox.addEventListener('input', (e) => {
        state.taskSearch = e.target.value;
        renderTasks();
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Global methods for inline buttons
  window.Campx = {
    addSteps,
    addWater
  };

  window.CampxNav = {
    switchTo: switchToView
  };

})();
