const els = {
  stage: document.getElementById("stage"),
  dateLine: document.getElementById("dateLine"),
  hourText: document.getElementById("hourText"),
  minuteText: document.getElementById("minuteText"),
  secondText: document.getElementById("secondText"),
  directionText: document.getElementById("directionText"),
  targetChip: document.getElementById("targetChip"),
  batteryLevel: document.getElementById("batteryLevel"),
  batteryFill: document.getElementById("batteryFill"),
  railGlow: document.getElementById("railGlow"),
  tickStrip: document.getElementById("tickStrip"),
  tapGrid: document.getElementById("tapGrid"),
  settingsPanel: document.getElementById("settingsPanel"),
  settingsHit: document.getElementById("settingsHit"),
  peekHit: document.getElementById("peekHit"),
  closeSettings: document.getElementById("closeSettings"),
  targetMinutes: document.getElementById("targetMinutes"),
  delaySeconds: document.getElementById("delaySeconds"),
  delayOut: document.getElementById("delayOut"),
  speed: document.getElementById("speed"),
  speedOut: document.getElementById("speedOut"),
  brightness: document.getElementById("brightness"),
  brightnessOut: document.getElementById("brightnessOut"),
  contrast: document.getElementById("contrast"),
  contrastOut: document.getElementById("contrastOut"),
  clockY: document.getElementById("clockY"),
  clockYOut: document.getElementById("clockYOut"),
  clockScale: document.getElementById("clockScale"),
  clockScaleOut: document.getElementById("clockScaleOut"),
  clockStretch: document.getElementById("clockStretch"),
  clockStretchOut: document.getElementById("clockStretchOut"),
  glassBlur: document.getElementById("glassBlur"),
  glassBlurOut: document.getElementById("glassBlurOut"),
  showGrid: document.getElementById("showGrid"),
  skipZero: document.getElementById("skipZero"),
  haptics: document.getElementById("haptics"),
  alwaysOn: document.getElementById("alwaysOn"),
  wallpaperInput: document.getElementById("wallpaperInput"),
  clearWallpaper: document.getElementById("clearWallpaper"),
  armButton: document.getElementById("armButton"),
  resetButton: document.getElementById("resetButton"),
  peekCard: document.getElementById("peekCard"),
};

const state = {
  mode: "idle",
  displayDate: new Date(),
  liveTimer: 0,
  rewindRaf: 0,
  rewindStart: 0,
  triggerTimer: 0,
  settingsClicks: [],
  peekTimer: 0,
  wakeLock: null,
};

const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {
  weekday: "short",
  month: "long",
  day: "numeric",
});

const lunarDayNames = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十", "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(date) {
  const format = document.querySelector("input[name='format']:checked").value;
  let hours = date.getHours();
  if (format === "12") {
    hours = hours % 12 || 12;
  }
  return {
    hours: pad(hours),
    minutes: pad(date.getMinutes()),
    seconds: pad(date.getSeconds()),
  };
}

function renderTime(date = state.displayDate) {
  const parts = formatTime(date);
  els.dateLine.textContent = `${weekdayFormatter.format(date)} · ${formatLunar(date)}`;
  els.hourText.textContent = parts.hours;
  els.minuteText.textContent = parts.minutes;
  els.secondText.textContent = parts.seconds;
}

function formatLunar(date) {
  try {
    const formatted = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
    const normalized = formatted.replace(/\s/g, "");
    const dayMatch = normalized.match(/(\d{1,2})$/);
    if (!dayMatch) return normalized;
    const day = Number(dayMatch[1]);
    return normalized.replace(/^\d{4}/, "").replace(/\d{1,2}$/, lunarDayNames[day - 1] || dayMatch[1]);
  } catch {
    return "";
  }
}

function readSettings() {
  return {
    targetMinutes: clamp(Number(els.targetMinutes.value) || 5, 1, 120),
    delaySeconds: Number(els.delaySeconds.value) || 0,
    speed: Number(els.speed.value) || 1,
    showGrid: els.showGrid.checked,
    skipZero: els.skipZero.checked,
    haptics: els.haptics.checked,
    alwaysOn: els.alwaysOn.checked,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function syncOutputs() {
  const settings = readSettings();
  const clockScale = Number(els.clockScale.value) || 100;
  const clockStretch = Number(els.clockStretch.value) || 100;
  const glassBlur = Number(els.glassBlur.value) || 0;
  els.targetMinutes.value = settings.targetMinutes;
  els.delayOut.value = `${settings.delaySeconds}s`;
  els.speedOut.value = `${settings.speed.toFixed(1)}x`;
  els.brightnessOut.value = `${els.brightness.value}%`;
  els.contrastOut.value = `${els.contrast.value}%`;
  els.clockYOut.value = `${els.clockY.value}vh`;
  els.clockScaleOut.value = `${clockScale}%`;
  els.clockStretchOut.value = `${clockStretch}%`;
  els.glassBlurOut.value = `${glassBlur}px`;
  els.targetChip.textContent = `-${pad(Math.floor(settings.targetMinutes / 60))}:${pad(settings.targetMinutes % 60)}`;
  document.documentElement.style.setProperty("--brightness", `${els.brightness.value}%`);
  document.documentElement.style.setProperty("--contrast", `${els.contrast.value}%`);
  document.documentElement.style.setProperty("--clock-y", `${els.clockY.value}vh`);
  document.documentElement.style.setProperty("--clock-scale", `${clockScale / 100}`);
  document.documentElement.style.setProperty("--clock-stretch", `${clockStretch / 100}`);
  document.documentElement.style.setProperty("--glass-blur", `${glassBlur}px`);
  document.documentElement.style.setProperty("--glass-opacity", `${Math.max(0.08, Math.min(0.34, 0.08 + glassBlur / 150))}`);
  drawGrid();
  persistSettings();
}

function persistSettings() {
  const format = document.querySelector("input[name='format']:checked").value;
  const payload = {
    displayPresetVersion: "ios26-v2",
    targetMinutes: els.targetMinutes.value,
    delaySeconds: els.delaySeconds.value,
    speed: els.speed.value,
    brightness: els.brightness.value,
    contrast: els.contrast.value,
    clockY: els.clockY.value,
    clockScale: els.clockScale.value,
    clockStretch: els.clockStretch.value,
    glassBlur: els.glassBlur.value,
    showGrid: els.showGrid.checked,
    skipZero: els.skipZero.checked,
    haptics: els.haptics.checked,
    alwaysOn: els.alwaysOn.checked,
    format,
  };
  localStorage.setItem("time-rewind-settings", JSON.stringify(payload));
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem("time-rewind-settings") || "{}");
  if (saved.displayPresetVersion !== "ios26-v2") {
    saved.clockY = "0";
    saved.clockScale = "100";
    saved.clockStretch = "100";
    saved.glassBlur = "26";
  }
  for (const [key, value] of Object.entries(saved)) {
    if (key === "format") {
      const option = document.querySelector(`input[name='format'][value='${value}']`);
      if (option) option.checked = true;
    } else if (els[key] && typeof els[key].checked === "boolean") {
      els[key].checked = Boolean(value);
    } else if (els[key]) {
      els[key].value = value;
    }
  }
}

function applyWallpaper(dataUrl) {
  if (dataUrl) {
    document.documentElement.style.setProperty("--wallpaper-image", `url("${dataUrl}")`);
    els.stage.classList.add("has-wallpaper");
    return;
  }

  document.documentElement.style.setProperty("--wallpaper-image", "none");
  els.stage.classList.remove("has-wallpaper");
}

function loadWallpaper() {
  applyWallpaper(localStorage.getItem("time-rewind-wallpaper"));
}

function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Cannot read image"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Cannot load image"));
      image.onload = () => {
        const maxSize = 1800;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function drawGrid() {
  const settings = readSettings();
  const values = settings.skipZero ? [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 10, ""] : [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, ""];
  els.tapGrid.innerHTML = values.map((value) => `<div class="tap-cell">${value}</div>`).join("");
  els.tapGrid.classList.toggle("visible", settings.showGrid && els.settingsPanel.classList.contains("open"));
}

function startLiveClock() {
  clearInterval(state.liveTimer);
  state.mode = "idle";
  els.stage.classList.add("idle");
  els.stage.classList.remove("armed", "rewinding");
  els.directionText.textContent = "LIVE";
  state.displayDate = new Date();
  renderTime();
  state.liveTimer = setInterval(() => {
    if (state.mode !== "idle") return;
    state.displayDate = new Date();
    renderTime();
  }, 250);
}

function armPerformance() {
  clearTimeout(state.triggerTimer);
  state.mode = "armed";
  els.stage.classList.remove("idle", "rewinding");
  els.stage.classList.add("armed");
  els.directionText.textContent = "ARMED";
  pulse();
  els.settingsPanel.classList.remove("open");
  drawGrid();
}

function triggerRewind() {
  if (state.mode === "rewinding") return;
  if (state.mode === "idle") armPerformance();
  const settings = readSettings();
  els.directionText.textContent = settings.delaySeconds ? "WAIT" : "BACK";
  clearTimeout(state.triggerTimer);
  state.triggerTimer = setTimeout(() => rewind(), settings.delaySeconds * 1000);
}

function rewind() {
  const settings = readSettings();
  clearInterval(state.liveTimer);
  cancelAnimationFrame(state.rewindRaf);
  pulse();
  state.mode = "rewinding";
  state.rewindStart = performance.now();
  els.stage.classList.remove("idle", "armed");
  els.stage.classList.add("rewinding");
  els.directionText.textContent = "BACK";

  const from = new Date();
  const target = new Date(from.getTime() - settings.targetMinutes * 60 * 1000);
  const duration = Math.max(900, (settings.targetMinutes * 760) / settings.speed);
  const travel = from.getTime() - target.getTime();

  function frame(now) {
    const progress = clamp((now - state.rewindStart) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    state.displayDate = new Date(from.getTime() - travel * eased);
    renderTime();
    if (els.tickStrip) {
      els.tickStrip.style.transform = `translateX(${eased * 240}px)`;
    }
    if (els.railGlow) {
      els.railGlow.style.transform = `translateX(${-60 + eased * 120}%)`;
    }

    if (progress < 1) {
      state.rewindRaf = requestAnimationFrame(frame);
      return;
    }

    state.displayDate = target;
    renderTime();
    els.directionText.textContent = "DONE";
    els.stage.classList.remove("rewinding");
    state.mode = "complete";
  }

  state.rewindRaf = requestAnimationFrame(frame);
}

function resetPerformance() {
  clearTimeout(state.triggerTimer);
  cancelAnimationFrame(state.rewindRaf);
  if (els.tickStrip) {
    els.tickStrip.style.transform = "translateX(0)";
  }
  if (els.railGlow) {
    els.railGlow.style.transform = "translateX(0)";
  }
  startLiveClock();
}

function pulse() {
  const settings = readSettings();
  if (settings.haptics && navigator.vibrate) {
    navigator.vibrate([18, 24, 18]);
  }
}

async function syncWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    if (els.alwaysOn.checked && !state.wakeLock) {
      state.wakeLock = await navigator.wakeLock.request("screen");
      state.wakeLock.addEventListener("release", () => {
        state.wakeLock = null;
      });
    } else if (!els.alwaysOn.checked && state.wakeLock) {
      await state.wakeLock.release();
      state.wakeLock = null;
    }
  } catch {
    state.wakeLock = null;
  }
}

function showPeek() {
  const settings = readSettings();
  const end = new Date(Date.now() - settings.targetMinutes * 60 * 1000);
  const parts = formatTime(end);
  els.peekCard.textContent = `目标 ${parts.hours}:${parts.minutes}`;
  els.peekCard.classList.add("show");
  clearTimeout(state.peekTimer);
  state.peekTimer = setTimeout(() => els.peekCard.classList.remove("show"), 1400);
}

function openSettingsByTripleTap() {
  const now = Date.now();
  state.settingsClicks = state.settingsClicks.filter((time) => now - time < 900);
  state.settingsClicks.push(now);
  if (state.settingsClicks.length >= 3) {
    els.settingsPanel.classList.add("open");
    drawGrid();
    state.settingsClicks = [];
  }
}

function handleGridChoice(event) {
  if (els.settingsPanel.classList.contains("open")) return;
  const rect = els.tapGrid.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, 0, rect.width - 1);
  const y = clamp(event.clientY - rect.top, 0, rect.height - 1);
  const col = Math.floor((x / rect.width) * 3);
  const row = Math.floor((y / rect.height) * 4);
  const index = row * 3 + col;
  const values = readSettings().skipZero ? [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 10, null] : [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, null];
  const value = values[index];
  if (value === null || value === undefined) return;
  els.targetMinutes.value = value === 0 ? 10 : value;
  syncOutputs();
  triggerRewind();
}

function bindEvents() {
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      syncOutputs();
      syncWakeLock();
      renderTime();
    });
    input.addEventListener("change", () => {
      syncOutputs();
      syncWakeLock();
      renderTime();
    });
  });

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = Number(els.targetMinutes.value) + Number(button.dataset.step);
      els.targetMinutes.value = clamp(next, 1, 120);
      syncOutputs();
    });
  });

  els.settingsHit.addEventListener("click", (event) => {
    event.stopPropagation();
    event.currentTarget.blur();
    openSettingsByTripleTap();
  });
  els.peekHit.addEventListener("click", (event) => {
    event.stopPropagation();
    event.currentTarget.blur();
    showPeek();
  });
  els.closeSettings.addEventListener("click", () => {
    els.settingsPanel.classList.remove("open");
    drawGrid();
  });
  els.armButton.addEventListener("click", armPerformance);
  els.resetButton.addEventListener("click", resetPerformance);
  els.wallpaperInput.addEventListener("change", async () => {
    const [file] = els.wallpaperInput.files || [];
    if (!file) return;

    try {
      const dataUrl = await imageToDataUrl(file);
      localStorage.setItem("time-rewind-wallpaper", dataUrl);
      applyWallpaper(dataUrl);
    } catch {
      alert("这张图片太大或无法读取，请换一张试试。");
    } finally {
      els.wallpaperInput.value = "";
    }
  });
  els.clearWallpaper.addEventListener("click", () => {
    localStorage.removeItem("time-rewind-wallpaper");
    applyWallpaper(null);
  });

  els.stage.addEventListener("click", (event) => {
    if (event.target.closest(".settings-panel") || event.target.closest(".corner-hit")) return;
    if (state.mode === "complete") {
      resetPerformance();
      return;
    }
    if (state.mode === "armed" && event.clientY > window.innerHeight * 0.22 && event.clientY < window.innerHeight * 0.82) {
      handleGridChoice(event);
      return;
    }
    triggerRewind();
  });

  let touchStart = null;
  els.stage.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      touchStart = [...event.touches].map((touch) => touch.clientY);
    }
  });
  els.stage.addEventListener("touchend", (event) => {
    if (!touchStart || event.changedTouches.length < 2) return;
    const movedUp = [...event.changedTouches].every((touch, index) => touchStart[index] - touch.clientY > 60);
    if (movedUp) resetPerformance();
    touchStart = null;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncWakeLock();
  });
}

function syncDisplayMode() {
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches;

  els.stage.classList.toggle("standalone-mode", standalone);
  els.stage.classList.toggle("browser-mode", !standalone);
}

function renderBattery(level) {
  const percent = clamp(Math.round(level), 1, 100);
  els.batteryLevel.textContent = String(percent);
  els.batteryFill.style.width = `${percent}%`;
}

async function initBattery() {
  renderBattery(51);
  if (!navigator.getBattery) return;

  try {
    const battery = await navigator.getBattery();
    const update = () => renderBattery(battery.level * 100);
    update();
    battery.addEventListener("levelchange", update);
    battery.addEventListener("chargingchange", update);
  } catch {
    renderBattery(51);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

syncDisplayMode();
window.matchMedia("(display-mode: standalone)").addEventListener("change", syncDisplayMode);
window.matchMedia("(display-mode: fullscreen)").addEventListener("change", syncDisplayMode);
loadSettings();
loadWallpaper();
bindEvents();
syncOutputs();
startLiveClock();
syncWakeLock();
initBattery();
