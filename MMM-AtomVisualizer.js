/* global Module, ELEMENTS_DATA, ABUNDANCE_DATA */

const DETAIL_KEYS = ["showAtomicNumber", "showShells", "showAtomicMass", "showCategory", "showCas", "showPhase", "showElectronegativity", "showDiscoveredBy", "showAbundance"];
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
    stepRate: 0,
    showLabel: true,
    showAtomicNumber: true,
    showShells: true,
    showAtomicMass: true,
    showCategory: true,
    showCas: true,
    showPhase: true,
    showElectronegativity: true,
    showDiscoveredBy: true,
    showPeriodicTable: false,
    showAbundance: false
  },

  start () {
    this.symbolLookup = this.buildSymbolLookup();
    this.detailFields = this.buildDetailFieldDefinitions();
    if (this.config.showAbundance) {
      this.abundanceFormats = this.buildAbundanceFormats(globalThis.config.locale || globalThis.config.language);
    }

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
    return [this.file("data/elements.js"), this.file("data/abundance.js")];
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
    // Fewer than 10 steps a second make shells with many electrons look stuck or turning backwards
    this.config.stepRate = Number.isFinite(this.config.stepRate) && this.config.stepRate > 0
      ? Math.min(60, Math.max(10, this.config.stepRate))
      : 0;
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

    const timing = this.config.stepRate > 0
      ? this.stepSpin(spin)
      : spin;
    runner.style.animationDuration = `${timing.duration}s`;
    runner.style.animationDelay = `${timing.delay}s`;
    if (timing.reverse) {
      runner.style.animationDirection = "reverse";
    }
    if (timing.steps) {
      runner.style.animationTimingFunction = `steps(${timing.steps})`;
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

  // With stepRate, the runners jump instead of turning smoothly: stepRate times a second and all at the same moments,
  // so the compositor redraws the atom stepRate times a second instead of at the display rate. For that, every runner's
  // duration is rounded to whole steps of 1 / stepRate seconds and its start offset to the same grid, so a revolution
  // takes up to half a step longer or shorter
  stepSpin (spin) {
    const steps = Math.max(1, Math.round(spin.duration * this.config.stepRate));
    const startStep = Math.round(-spin.delay / spin.duration * steps) % steps;
    return {...spin, steps, duration: steps / this.config.stepRate, delay: -startStep / this.config.stepRate};
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

  // A small periodic table with the element on display highlighted
  createPeriodicTable (activeSymbol) {
    const table = document.createElement("div");
    table.className = "atom-periodic-table";

    for (const [symbol, element] of Object.entries(ELEMENTS_DATA)) {
      const {row, column} = this.tablePosition(element);
      const cell = document.createElement("div");
      cell.className = symbol === activeSymbol
        ? "atom-table-cell atom-table-cell--active"
        : "atom-table-cell";
      cell.title = symbol;
      cell.style.gridRow = String(row);
      cell.style.gridColumn = String(column);
      table.appendChild(cell);
    }

    return table;
  },

  // Row and column of an element in the table: periods 1 to 7, then a spacer row and the lanthanides (Z 57 to 71) and
  // actinides (Z 89 to 103) in rows 9 and 10 under groups 3 to 17
  tablePosition (element) {
    if (element.number >= 57 && element.number <= 71) {
      return {row: 9, column: element.number - 54};
    }
    if (element.number >= 89 && element.number <= 103) {
      return {row: 10, column: element.number - 86};
    }
    return {row: element.period, column: element.group};
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

    // The abundance comes from its own data file
    const data = this.config.showAbundance
      ? {...element, abundance: ABUNDANCE_DATA[symbol]}
      : element;
    const extraItems = this.buildDetailsItems(data);
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
      {key: "showDiscoveredBy", dataKey: "discoveredBy", translateKey: "DETAIL_DISCOVERED_BY", format: (v) => v},
      {key: "showAbundance", dataKey: "abundance", translateKey: "DETAIL_ABUNDANCE", format: (v) => this.formatAbundance(v)}
    ];
  },

  // Built once in start(): number formats of the MagicMirror locale
  buildAbundanceFormats (locale) {
    return {
      percent: new Intl.NumberFormat(locale, {style: "percent", maximumSignificantDigits: 2}),
      ppm: new Intl.NumberFormat(locale, {maximumSignificantDigits: 2})
    };
  },

  // Abundance in ppm by mass with 2 significant digits: in percent from 1000 ppm, as traces below 0.001 ppm. Rounded
  // first, so that 999.9 ppm shows as 0.1 % and not as 1,000 ppm
  formatAbundance (ppm) {
    const rounded = Number(ppm.toPrecision(2));
    if (rounded >= 1000) {
      return this.abundanceFormats.percent.format(rounded / 1e6);
    }
    if (rounded >= 0.001) {
      return `${this.abundanceFormats.ppm.format(rounded)} ppm`;
    }
    return this.translate("ABUNDANCE_TRACES");
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

    if (this.config.showPeriodicTable) {
      wrapper.appendChild(this.createPeriodicTable(symbol));
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
