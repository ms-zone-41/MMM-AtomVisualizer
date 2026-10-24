/* global Module, ELEMENTS_DATA */

const DETAIL_KEYS = ["showAtomicNumber", "showShells", "showAtomicMass", "showCategory", "showCas", "showPhase", "showElectronegativity", "showDiscoveredBy"];
const SHOW_KEYS = ["showLabel", ...DETAIL_KEYS];

Module.register("MMM-AtomVisualizer", {
  defaults: {
    element: "C",
    elements: [],
    cycleElements: true,
    shuffleElements: true,
    cycleEvery: 60,
    size: 240,
    shellScaling: 0,
    nucleusScale: 0.22,
    electronSize: 7,
    electronSpeed: 10,
    mixedOrbitDirections: true,
    autoRotate: true,
    rotationDuration: 42,
    showLabel: true,
    showAtomicNumber: true,
    showShells: true,
    showAtomicMass: true,
    showCategory: true,
    showCas: true,
    showPhase: true,
    showElectronegativity: true,
    showDiscoveredBy: true
  },

  start () {
    this.symbolLookup = this.buildSymbolLookup();
    this.detailFields = this.buildDetailFieldDefinitions();

    this.sanitizeConfig();

    if (this.config.shuffleElements && this.config.cycleElements) {
      this.shuffleArray(this.config.elements);
    }

    if (this.config.cycleElements && this.config.elements.length > 0) {
      this.currentElementIndex = 0;
      this.activeSymbol = this.resolveSymbol(this.config.elements[0]);
      this.scheduleElementCycle();
    } else {
      this.currentElementIndex = 0;
      this.activeSymbol = this.resolveSymbol(this.config.element);
    }

    const shownSymbols = this.config.cycleElements
      ? this.config.elements
      : [this.activeSymbol];
    this.maxShellCount = Math.max(...shownSymbols.map((symbol) => ELEMENTS_DATA[symbol].shells.length));
  },

  getStyles () {
    return ["MMM-AtomVisualizer.css"];
  },

  getScripts () {
    return [this.file("data/elements.js")];
  },

  getTranslations () {
    return {
      en: "translations/en.json",
      de: "translations/de.json",
      nl: "translations/nl.json"
    };
  },

  getElementName (element, symbol) {
    const key = `ELEMENT_${symbol}`;
    const translated = this.translate(key);

    // If translate() returns the key itself, it has no translation — fall back to English name
    return translated === key
      ? element.name
      : translated;
  },

  sanitizeConfig () {
    this.config.size = Number.isFinite(this.config.size)
      ? Math.max(140, this.config.size)
      : 240;
    this.config.shellScaling = Number.isFinite(this.config.shellScaling)
      ? Math.min(1, Math.max(0, this.config.shellScaling))
      : 0;
    this.config.nucleusScale = Number.isFinite(this.config.nucleusScale)
      ? Math.min(0.4, Math.max(0.12, this.config.nucleusScale))
      : 0.22;
    this.config.electronSize = Number.isFinite(this.config.electronSize)
      ? Math.max(4, this.config.electronSize)
      : 7;
    this.config.electronSpeed = Number.isFinite(this.config.electronSpeed)
      ? Math.max(2, this.config.electronSpeed)
      : 8;
    this.config.rotationDuration = Number.isFinite(this.config.rotationDuration)
      ? Math.max(8, this.config.rotationDuration)
      : 32;
    this.config.cycleEvery = Number.isFinite(this.config.cycleEvery)
      ? Math.max(10, this.config.cycleEvery)
      : 60;

    if (!Array.isArray(this.config.elements)) {
      this.config.elements = [this.config.element];
    }

    if (this.config.elements.length === 0) {
      this.config.elements = Object.keys(ELEMENTS_DATA);
    }

    this.config.elements = this.config.elements
      .map((symbol) => this.resolveSymbol(symbol))
      .filter((symbol, index, arr) => arr.indexOf(symbol) === index);

    if (this.config.elements.length === 0) {
      this.config.elements = ["C"];
    }
  },

  scheduleElementCycle () {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }

    this.cycleTimer = setInterval(() => {
      if (!this.config.cycleElements || this.config.elements.length < 2) {
        return;
      }

      this.currentElementIndex = (this.currentElementIndex + 1) % this.config.elements.length;
      this.activeSymbol = this.config.elements[this.currentElementIndex];
      this.updateDom(300);
    }, this.config.cycleEvery * 1000);
  },

  // Maps a lowercased symbol (e.g. "na") to its canonical, correctly-cased form (e.g. "Na")
  buildSymbolLookup () {
    const lookup = new Map();
    for (const symbol of Object.keys(ELEMENTS_DATA)) {
      lookup.set(symbol.toLowerCase(), symbol);
    }
    return lookup;
  },

  resolveSymbol (symbol) {
    if (typeof symbol !== "string") {
      return "C";
    }

    const normalized = symbol.trim().toLowerCase();
    return this.symbolLookup.get(normalized) || "C";
  },

  shuffleArray (array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  },

  // Size and motion of each shell: ring diameter (border box), ring rotation in degrees and the revolution of its
  // electrons (duration and start offset in seconds, direction)
  shellGeometry (shells) {
    const shellCount = shells.length;
    const maxRadius = this.config.size / 2 - this.config.electronSize * 1.2;
    const outerRadius = maxRadius * this.shellScale(shellCount);
    const nucleusRadius = this.config.size * this.config.nucleusScale / 2;
    const orbitSpace = Math.max(14, (outerRadius - nucleusRadius) / Math.max(1, shellCount));

    return shells.map((electronCount, index) => ({
      electronCount,
      diameter: Math.min(this.config.size - this.config.electronSize, (nucleusRadius + orbitSpace * (index + 1)) * 2),
      rotation: index * 24,
      duration: this.config.electronSpeed + index * 1.2,
      delay: index * -1.5,
      reverse: this.config.mixedOrbitDirections && index % 2 === 1
    }));
  },

  createShellElements (shells) {
    const rotationLayer = document.createElement("div");
    rotationLayer.className = "atom-rotation-layer";

    for (const shell of this.shellGeometry(shells)) {
      rotationLayer.appendChild(this.createShellRing(shell));
    }

    return rotationLayer;
  },

  // Atoms with fewer shells than the largest atom that can be shown get a smaller orbit radius:
  // shellScaling 0 keeps every atom at full size, 1 makes the radius proportional to the shell count
  shellScale (shellCount) {
    if (!this.config.shellScaling || !this.maxShellCount) {
      return 1;
    }
    return 1 - this.config.shellScaling * (1 - shellCount / this.maxShellCount);
  },

  createShellRing (shell) {
    const ring = document.createElement("div");
    ring.className = "atom-shell";
    ring.style.width = `${shell.diameter}px`;
    ring.style.height = `${shell.diameter}px`;
    ring.style.setProperty("--shell-z-rotation", `${shell.rotation}deg`);

    // All electrons of a shell circle at the same speed, so one animated runner carries them all:
    // one composited layer per shell instead of one per electron
    const runner = this.createElectronRunner(shell);
    for (let index = 0; index < shell.electronCount; index += 1) {
      runner.appendChild(this.createElectronTrack(360 / shell.electronCount * index));
    }
    ring.appendChild(runner);

    return ring;
  },

  createElectronRunner (shell) {
    const runner = document.createElement("div");
    runner.className = "atom-electron-runner";

    const spin = this.runnerSpin(shell);
    if (!spin.duration) {
      runner.style.animationName = "none";
      runner.style.transform = `rotate(${spin.angle}deg)`;
      return runner;
    }

    runner.style.animationDuration = `${spin.duration}s`;
    runner.style.animationDelay = `${spin.delay}s`;
    if (spin.reverse) {
      runner.style.animationDirection = "reverse";
    }

    return runner;
  },

  // The animation of a shell's runner: the revolution of its electrons plus, with autoRotate, the rotation of the shell
  // system. The rings are circles, so only the electrons visibly turn with the system, and one animation per runner at
  // the summed speed shows the rotation without animating a layer as large as the stage. Returns the duration and
  // start offset in seconds and the direction, or no duration and the fixed angle in degrees when the two rotations
  // cancel out
  runnerSpin (shell) {
    if (!this.config.autoRotate) {
      return {duration: shell.duration, delay: shell.delay, reverse: shell.reverse};
    }

    // In turns: the speed per second and the angle at the start (the system rotation starts at 0)
    const direction = shell.reverse
      ? -1
      : 1;
    const speed = direction / shell.duration + 1 / this.config.rotationDuration;
    const startAngle = -direction * shell.delay / shell.duration;
    if (Math.abs(speed) < 1e-9) {
      return {duration: 0, angle: (startAngle % 1 + 1) % 1 * 360};
    }

    // A reverse animation turns from 360deg back to 0deg, so it starts at the progress of the negative angle
    const duration = 1 / Math.abs(speed);
    const startProgress = (Math.sign(speed) * startAngle % 1 + 1) % 1;
    return {duration, delay: -startProgress * duration, reverse: speed < 0};
  },

  createElectronTrack (angle) {
    const track = document.createElement("div");
    track.className = "atom-electron-track";
    track.style.transform = `rotate(${angle}deg)`;

    const electron = document.createElement("div");
    electron.className = "atom-electron";
    track.appendChild(electron);

    return track;
  },

  createAtomStage (symbol, shells) {
    const atom = document.createElement("div");
    atom.className = "atom-stage";
    atom.style.setProperty("--atom-size", `${this.config.size}px`);
    atom.style.setProperty("--nucleus-size", `${Math.round(this.config.size * this.config.nucleusScale)}px`);
    atom.style.setProperty("--electron-size", `${this.config.electronSize}px`);

    const rotationLayer = this.createShellElements(shells);
    atom.appendChild(rotationLayer);

    const nucleus = document.createElement("div");
    nucleus.className = "atom-nucleus";
    nucleus.innerText = symbol;
    atom.appendChild(nucleus);

    return atom;
  },

  createDetailsSection (element, symbol) {
    const details = document.createElement("div");
    details.className = "atom-details";

    if (this.config.showLabel) {
      const label = document.createElement("div");
      label.className = "atom-label";
      label.innerText = `${this.getElementName(element, symbol)} (${symbol})`;
      details.appendChild(label);
    }

    const extraItems = this.buildDetailsItems(element);
    if (extraItems.length > 0) {
      const grid = document.createElement("div");
      grid.className = "atom-detail-grid";
      for (const {label, value} of extraItems) {
        const keySpan = document.createElement("span");
        keySpan.className = "atom-detail-key";
        keySpan.innerText = label;
        const valSpan = document.createElement("span");
        valSpan.className = "atom-detail-val";
        valSpan.innerText = value;
        grid.appendChild(keySpan);
        grid.appendChild(valSpan);
      }
      details.appendChild(grid);
    }

    return details;
  },

  // Built once in start() so format() callbacks can close over the module's `this`
  buildDetailFieldDefinitions () {
    return [
      {key: "showAtomicNumber", dataKey: "number", translateKey: "ATOMIC_NUMBER", format: (v) => String(v)},
      {key: "showShells", dataKey: "shells", translateKey: "SHELLS", format: (v) => v.join("-")},
      {key: "showAtomicMass", dataKey: "atomicMass", translateKey: "DETAIL_ATOMIC_MASS", format: (v) => `${v} u`},
      {key: "showCategory", dataKey: "category", translateKey: "DETAIL_CATEGORY", format: (v) => this.translate(this.categoryKey(v))},
      {key: "showCas", dataKey: "cas", translateKey: "DETAIL_CAS", format: (v) => v},
      {key: "showPhase", dataKey: "phase", translateKey: "DETAIL_PHASE", format: (v) => this.translate(`PHASE_${v.toUpperCase()}`)},
      {key: "showElectronegativity", dataKey: "electronegativity", translateKey: "DETAIL_ELECTRONEGATIVITY", format: (v) => v},
      {key: "showDiscoveredBy", dataKey: "discoveredBy", translateKey: "DETAIL_DISCOVERED_BY", format: (v) => v}
    ];
  },

  buildDetailsItems (element) {
    return this.detailFields
      .filter(({key, dataKey}) => this.config[key] && element[dataKey] !== null && typeof element[dataKey] !== "undefined")
      .map(({dataKey, translateKey, format}) => ({label: this.translate(translateKey), value: format(element[dataKey])}));
  },

  categoryKey (category) {
    return `CATEGORY_${category
      .replace(/, (?:predicted to be|probably) /u, "_")
      .replace(/[\s,.-]+/gu, "_")
      .toUpperCase()}`;
  },

  getDom () {
    const wrapper = document.createElement("div");
    wrapper.className = "mmm-atom-visualizer";

    const symbol = this.resolveSymbol(this.activeSymbol || this.config.element);
    const element = ELEMENTS_DATA[symbol];

    if (!element) {
      wrapper.innerText = this.translate("ATOM_UNKNOWN");
      return wrapper;
    }

    const shells = element.shells;
    const atom = this.createAtomStage(symbol, shells);
    wrapper.appendChild(atom);

    if (SHOW_KEYS.some((key) => this.config[key])) {
      const details = this.createDetailsSection(element, symbol);
      wrapper.appendChild(details);
    }

    return wrapper;
  },

  stop () {
    this.suspend();
  },

  suspend () {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
  },

  resume () {
    if (this.config.cycleElements && this.config.elements.length > 1) {
      this.scheduleElementCycle();
    }
  }
});
