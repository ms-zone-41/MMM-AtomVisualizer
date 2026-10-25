/* eslint-disable no-underscore-dangle */

import {beforeEach, describe, it, mock} from "node:test";
import {dirname, join} from "node:path";
import {readFileSync, readdirSync} from "node:fs";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mock MagicMirror globals
let moduleDefinition = null;

global.Module = {
  register (name, definition) {
    moduleDefinition = definition;
    return definition;
  }
};

global.Log = {
  info: mock.fn(),
  log: mock.fn(),
  debug: mock.fn(),
  warn: mock.fn(),
  error: mock.fn()
};

// Load the module by executing it in the global context
const modulePath = join(__dirname, "../../MMM-AtomVisualizer.js");
const moduleCode = readFileSync(modulePath, "utf8");
const script = new vm.Script(moduleCode, {filename: "MMM-AtomVisualizer.js"});
const context = vm.createContext({
  Module: global.Module,
  Log: global.Log,
  document: {},
  window: {},
  console: global.console,
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  setInterval: global.setInterval,
  clearInterval: global.clearInterval,
  config: {language: "en"},
  ELEMENTS_DATA: JSON.parse(readFileSync(join(__dirname, "../../data/elements.json"), "utf8")),
  // Fixed values instead of data/abundance.json, which the "data files" tests check
  ABUNDANCE_DATA: {O: 461000, Si: 282000, Au: 0.004, Rn: 4e-13, U: 2.7, Pu: null}
});
script.runInContext(context);

// Minimal DOM element: enough for the module's DOM building
const fakeElement = () => {
  const element = {
    appendChild (child) {
      element.children.push(child);
      return child;
    },
    children: [],
    className: "",
    classList: {add: (name) => {
      element.className = `${element.className} ${name}`.trim();
    }},
    style: {setProperty: mock.fn()}
  };
  return element;
};

// Everything the module set on a tree of fake DOM elements, as a string to compare two trees
const serializeDom = (element) => JSON.stringify(element, (key, value) => {
  if (key === "setProperty") {
    return value.mock.calls.map((call) => call.arguments);
  }
  return key === "classList"
    ? undefined
    : value;
});

const hasClass = (element, name) => element.className.split(" ").includes(name);

const assertClose = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

// Angle in degrees of a linear CSS animation from rotate(0deg) to rotate(360deg) at `time` seconds after its start
const cssTurn = ({duration, delay, reverse}, time) => {
  const progress = ((time - delay) / duration % 1 + 1) % 1;
  return reverse
    ? 360 - progress * 360
    : progress * 360;
};

const assertSameAngle = (actual, expected) => {
  const difference = ((actual - expected) % 360 + 540) % 360 - 180;
  assert.ok(Math.abs(difference) < 1e-6, `${actual}deg is not ${expected}deg`);
};

describe("MMM-AtomVisualizer Core Functions", () => {
  let instance;

  beforeEach(() => {
    // Create a fresh instance for each test
    instance = Object.create(moduleDefinition);
    instance.config = {
      element: "C",
      elements: ["H", "He", "Li", "C", "N", "O"],
      cycleElements: false,
      shuffleElements: false,
      cycleEvery: 60,
      size: 240,
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
    };
    instance.symbolLookup = instance.buildSymbolLookup();
    instance.detailFields = instance.buildDetailFieldDefinitions();
    instance.shownFacts = new Map();
    instance.translate = (key) => key;
  });

  describe("resolveSymbol", () => {
    it("should return valid symbol for correct input", () => {
      assert.equal(instance.resolveSymbol("H"), "H");
      assert.equal(instance.resolveSymbol("C"), "C");
      assert.equal(instance.resolveSymbol("Fe"), "Fe");
      assert.equal(instance.resolveSymbol("Au"), "Au");
    });

    it("should handle case-insensitive input", () => {
      assert.equal(instance.resolveSymbol("h"), "H");
      assert.equal(instance.resolveSymbol("fe"), "Fe");
      assert.equal(instance.resolveSymbol("AU"), "Au");
    });

    it("should handle whitespace", () => {
      assert.equal(instance.resolveSymbol("  H  "), "H");
      assert.equal(instance.resolveSymbol(" Fe "), "Fe");
    });

    it("should return C for invalid symbols", () => {
      assert.equal(instance.resolveSymbol("XX"), "C");
      assert.equal(instance.resolveSymbol(""), "C");
      assert.equal(instance.resolveSymbol("InvalidElement"), "C");
    });

    it("should return C for non-string input", () => {
      assert.equal(instance.resolveSymbol(123), "C");
      assert.equal(instance.resolveSymbol(null), "C");
      assert.equal(instance.resolveSymbol(undefined), "C");
      assert.equal(instance.resolveSymbol({}), "C");
    });
  });

  describe("sanitizeConfig", () => {
    it("should enforce minimum size of 140", () => {
      instance.config.size = 100;
      instance.sanitizeConfig();
      assert.equal(instance.config.size, 140);
    });

    it("should allow valid size values", () => {
      instance.config.size = 300;
      instance.sanitizeConfig();
      assert.equal(instance.config.size, 300);
    });

    it("should enforce nucleusScale range (0.12 - 0.4)", () => {
      instance.config.nucleusScale = 0.05;
      instance.sanitizeConfig();
      assert.equal(instance.config.nucleusScale, 0.12);

      instance.config.nucleusScale = 0.5;
      instance.sanitizeConfig();
      assert.equal(instance.config.nucleusScale, 0.4);
    });

    it("should enforce minimum electronSize of 4", () => {
      instance.config.electronSize = 2;
      instance.sanitizeConfig();
      assert.equal(instance.config.electronSize, 4);
    });

    it("should enforce minimum electronSpeed of 2", () => {
      instance.config.electronSpeed = 1;
      instance.sanitizeConfig();
      assert.equal(instance.config.electronSpeed, 2);
    });

    it("should enforce minimum rotationDuration of 8", () => {
      instance.config.rotationDuration = 5;
      instance.sanitizeConfig();
      assert.equal(instance.config.rotationDuration, 8);
    });

    it("should enforce minimum cycleEvery of 10", () => {
      instance.config.cycleEvery = 5;
      instance.sanitizeConfig();
      assert.equal(instance.config.cycleEvery, 10);
    });

    it("should clamp shellScaling to the range 0 to 1", () => {
      for (const [value, expected] of [[0.5, 0.5], [1.5, 1], [-0.2, 0], ["big", 0]]) {
        instance.config.shellScaling = value;
        instance.sanitizeConfig();
        assert.equal(instance.config.shellScaling, expected);
      }
    });

    it("should clamp stepRate to 0 or the range 10 to 60", () => {
      for (const [value, expected] of [[10, 10], [12.5, 12.5], [2.5, 10], [0.01, 10], [75, 60], [0, 0], [-1, 0], ["fast", 0], [undefined, 0]]) {
        instance.config.stepRate = value;
        instance.sanitizeConfig();
        assert.equal(instance.config.stepRate, expected);
      }
    });

    it("should convert invalid size to default 240", () => {
      instance.config.size = "invalid";
      instance.sanitizeConfig();
      assert.equal(instance.config.size, 240);
    });

    it("should remove duplicate elements from array", () => {
      instance.config.elements = ["H", "C", "H", "O", "C"];
      instance.sanitizeConfig();
      assert.deepEqual(instance.config.elements, ["H", "C", "O"]);
    });

    it("should resolve invalid element symbols to C and remove duplicates", () => {
      instance.config.elements = ["H", "XX", "InvalidElement"];
      instance.sanitizeConfig();
      assert.deepEqual(instance.config.elements, ["H", "C"]);
    });

    it("should use all elements if elements array is empty", () => {
      instance.config.elements = [];
      instance.sanitizeConfig();
      assert.strictEqual(instance.config.elements[0], "H");
      assert.strictEqual(instance.config.elements.at(-1), "Og");
      assert.ok(instance.config.elements.length > 100);
    });

    it("should use config.element if elements is not an array", () => {
      instance.config.elements = "not an array";
      instance.config.element = "O";
      instance.sanitizeConfig();
      assert.strictEqual(JSON.stringify(instance.config.elements), JSON.stringify(["O"]));
    });
  });

  describe("categoryKey", () => {
    it("should convert simple categories", () => {
      assert.equal(instance.categoryKey("actinide"), "CATEGORY_ACTINIDE");
      assert.equal(instance.categoryKey("noble gas"), "CATEGORY_NOBLE_GAS");
      assert.equal(instance.categoryKey("transition metal"), "CATEGORY_TRANSITION_METAL");
      assert.equal(instance.categoryKey("post-transition metal"), "CATEGORY_POST_TRANSITION_METAL");
    });

    it("should handle unknown variants", () => {
      assert.equal(instance.categoryKey("unknown, predicted to be noble gas"), "CATEGORY_UNKNOWN_NOBLE_GAS");
      assert.equal(instance.categoryKey("unknown, probably metalloid"), "CATEGORY_UNKNOWN_METALLOID");
      assert.equal(instance.categoryKey("unknown, probably post-transition metal"), "CATEGORY_UNKNOWN_POST_TRANSITION_METAL");
    });
  });

  describe("buildDetailsItems", () => {
    it("should return empty array when all data fields are disabled", () => {
      instance.config.showAtomicMass = false;
      instance.config.showCategory = false;
      instance.config.showCas = false;
      instance.config.showPhase = false;
      instance.config.showElectronegativity = false;
      instance.config.showDiscoveredBy = false;
      const result = instance.buildDetailsItems({atomicMass: 12.011, cas: "7440-44-0"});
      assert.strictEqual(JSON.stringify(result), JSON.stringify([]));
    });

    it("should return single-item array for one enabled field", () => {
      instance.config.showAtomicMass = true;
      instance.config.showCategory = false;
      instance.config.showCas = false;
      instance.config.showPhase = false;
      instance.config.showElectronegativity = false;
      instance.config.showDiscoveredBy = false;
      const result = instance.buildDetailsItems({atomicMass: 12.011});
      assert.strictEqual(JSON.stringify(result), JSON.stringify([{label: "DETAIL_ATOMIC_MASS", value: "12.011 u"}]));
    });

    it("should return array with one entry per enabled field", () => {
      instance.config.showAtomicMass = true;
      instance.config.showCategory = false;
      instance.config.showCas = true;
      instance.config.showPhase = false;
      instance.config.showElectronegativity = false;
      instance.config.showDiscoveredBy = false;
      const result = instance.buildDetailsItems({atomicMass: 1.008, cas: "12385-13-6"});
      assert.strictEqual(JSON.stringify(result), JSON.stringify([{label: "DETAIL_ATOMIC_MASS", value: "1.008 u"}, {label: "DETAIL_CAS", value: "12385-13-6"}]));
    });

    it("should skip enabled fields with null values", () => {
      instance.config.showAtomicMass = true;
      instance.config.showCategory = false;
      instance.config.showCas = false;
      instance.config.showPhase = false;
      instance.config.showElectronegativity = true;
      instance.config.showDiscoveredBy = false;
      const result = instance.buildDetailsItems({atomicMass: 226, electronegativity: null});
      assert.strictEqual(JSON.stringify(result), JSON.stringify([{label: "DETAIL_ATOMIC_MASS", value: "226 u"}]));
    });
  });

  describe("shuffleArray", () => {
    it("should not change array length", () => {
      const arr = [1, 2, 3, 4, 5];
      const originalLength = arr.length;
      instance.shuffleArray(arr);
      assert.equal(arr.length, originalLength);
    });

    it("should contain same elements after shuffle", () => {
      const arr = [1, 2, 3, 4, 5];
      const originalSet = new Set(arr);
      instance.shuffleArray(arr);
      const shuffledSet = new Set(arr);
      assert.deepEqual(shuffledSet, originalSet);
    });

    it("should handle empty array", () => {
      const arr = [];
      instance.shuffleArray(arr);
      assert.deepEqual(arr, []);
    });

    it("should handle single element array", () => {
      const arr = [1];
      instance.shuffleArray(arr);
      assert.deepEqual(arr, [1]);
    });

    it("should handle two element array", () => {
      const arr = [1, 2];
      instance.shuffleArray(arr);
      assert.equal(arr.length, 2);
      assert.ok(arr.includes(1));
      assert.ok(arr.includes(2));
    });
  });

  describe("start", () => {
    it("should take the largest shell count from the elements that can be shown", () => {
      instance.scheduleElementCycle = mock.fn();
      instance.config.cycleElements = true;
      instance.config.elements = ["H", "Na", "C"];
      instance.start();
      assert.equal(instance.maxShellCount, 3);

      instance.config.cycleElements = false;
      instance.config.element = "Fe";
      instance.start();
      assert.equal(instance.maxShellCount, 4);
    });
  });

  describe("createShellElements", () => {
    beforeEach(() => {
      context.document.createElement = fakeElement;
    });

    it("should create one animated runner per shell that carries all its electrons", () => {
      const rotationLayer = instance.createShellElements([2, 8, 4]);
      assert.equal(rotationLayer.children.length, 3);
      for (const [shellIndex, electronCount] of [2, 8, 4].entries()) {
        const ring = rotationLayer.children[shellIndex];
        assert.equal(ring.children.length, 1);
        const [runner] = ring.children;
        assert.equal(runner.className, "atom-electron-runner");
        assert.equal(runner.children.length, electronCount);
        for (const [index, track] of runner.children.entries()) {
          assert.equal(track.className, "atom-electron-track");
          assert.equal(track.style.transform, `rotate(${360 / electronCount * index}deg)`);
          assert.equal(track.children[0].className, "atom-electron");
        }
      }
    });

    it("should shrink the orbits of atoms with fewer shells by shellScaling", () => {
      const outerDiameter = (shells) => Number.parseFloat(instance.createShellElements(shells).children.at(-1).style.width);
      instance.maxShellCount = 4;
      instance.config.shellScaling = 0;
      assert.equal(outerDiameter([1]), 223.2);
      instance.config.shellScaling = 0.5;
      assert.equal(outerDiameter([1]), 139.5);
      assert.ok(Math.abs(outerDiameter([2, 4]) - 167.4) < 1e-9);
      assert.equal(outerDiameter([2, 8, 14, 2]), 223.2);
    });

    it("should give each shell its own speed, start offset and direction", () => {
      instance.config.autoRotate = false;
      const runners = instance.createShellElements([2, 8, 4]).children.map((ring) => ring.children[0]);
      assert.deepEqual(runners.map((runner) => runner.style.animationDuration), ["10s", "11.2s", "12.4s"]);
      assert.deepEqual(runners.map((runner) => runner.style.animationDelay), ["0s", "-1.5s", "-3s"]);
      assert.deepEqual(runners.map((runner) => runner.style.animationDirection), [undefined, "reverse", undefined]);
    });

    it("should leave the rotation layer still and let the runners carry autoRotate", () => {
      const rotationLayer = instance.createShellElements([2, 8, 4]);
      assert.equal(rotationLayer.className, "atom-rotation-layer");
      const runners = rotationLayer.children.map((ring) => ring.children[0]);
      for (const [index, shell] of instance.shellGeometry([2, 8, 4]).entries()) {
        const spin = instance.runnerSpin(shell);
        assert.equal(runners[index].style.animationDuration, `${spin.duration}s`);
        assert.equal(runners[index].style.animationDelay, `${spin.delay}s`);
        assert.equal(runners[index].style.animationDirection, spin.reverse
          ? "reverse"
          : undefined);
      }
    });

    it("should not animate a runner whose electrons stand still", () => {
      instance.config.rotationDuration = 11.2;
      const runners = instance.createShellElements([2, 8, 4]).children.map((ring) => ring.children[0]);
      assert.equal(runners[1].style.animationName, "none");
      assert.equal(runners[1].style.transform, `rotate(${instance.runnerSpin(instance.shellGeometry([2, 8, 4])[1]).angle}deg)`);
      assert.equal(runners[1].style.animationDuration, undefined);
      assert.equal(runners[0].style.animationName, undefined);
    });

    it("should turn the runners smoothly without stepRate", () => {
      const runners = instance.createShellElements([2, 8, 4]).children.map((ring) => ring.children[0]);
      assert.deepEqual(runners.map((runner) => runner.style.animationTimingFunction), [undefined, undefined, undefined]);
    });

    it("should let every runner jump stepRate times a second", () => {
      const runners = () => instance.createShellElements([2, 8, 4]).children.map((ring) => ring.children[0]);
      instance.config.stepRate = 10;
      instance.config.autoRotate = false;
      // 10 s, 11.2 s and 12.4 s are whole steps already, and so are the start offsets
      assert.deepEqual(runners().map((runner) => [runner.style.animationTimingFunction, runner.style.animationDuration, runner.style.animationDelay]), [
        ["steps(100)", "10s", "0s"],
        ["steps(112)", "11.2s", "-1.5s"],
        ["steps(124)", "12.4s", "-3s"]
      ]);
      // With autoRotate 8.08 s, 15.27 s and 9.57 s per revolution, rounded to whole steps
      instance.config.autoRotate = true;
      assert.deepEqual(runners().map((runner) => [runner.style.animationTimingFunction, runner.style.animationDuration, runner.style.animationDelay, runner.style.animationDirection]), [
        ["steps(81)", "8.1s", "0s", undefined],
        ["steps(153)", "15.3s", "-2s", "reverse"],
        ["steps(96)", "9.6s", "-2.3s", undefined]
      ]);
    });

    it("should not step a runner whose electrons stand still", () => {
      instance.config.rotationDuration = 11.2;
      instance.config.stepRate = 10;
      const [, runner] = instance.createShellElements([2, 8, 4]).children.map((ring) => ring.children[0]);
      assert.equal(runner.style.animationName, "none");
      assert.equal(runner.style.animationTimingFunction, undefined);
    });
  });

  describe("runnerSpin", () => {
    it("should keep the revolution of each shell without autoRotate", () => {
      instance.config.autoRotate = false;
      for (const shell of instance.shellGeometry([2, 8, 4])) {
        assert.deepEqual({...instance.runnerSpin(shell)}, {duration: shell.duration, delay: shell.delay, reverse: shell.reverse});
      }
    });

    it("should add the system rotation to the speed of every shell", () => {
      const spins = instance.shellGeometry([2, 8, 4]).map((shell) => instance.runnerSpin(shell));
      // 1 / (1 / 10 + 1 / 42), 1 / (1 / 11.2 - 1 / 42) turning back, 1 / (1 / 12.4 + 1 / 42)
      for (const [index, expected] of [420 / 52, 470.4 / 30.8, 520.8 / 54.4].entries()) {
        assertClose(spins[index].duration, expected);
        assert.ok(spins[index].delay <= 0 && spins[index].delay > -expected);
      }
      assert.deepEqual(spins.map((spin) => spin.reverse), [false, true, false]);
    });

    it("should turn a reverse shell back only when it revolves faster than the system rotates", () => {
      instance.config.rotationDuration = 8;
      instance.config.electronSpeed = 20;
      // 1 / 20 + 1 / 8 forward, 1 / 8 - 1 / 21.2 forward: the reverse shell is slower than the system rotation
      assert.deepEqual(instance.shellGeometry([2, 8]).map((shell) => instance.runnerSpin(shell).reverse), [false, false]);
      instance.config.electronSpeed = 4;
      assert.deepEqual(instance.shellGeometry([2, 8]).map((shell) => instance.runnerSpin(shell).reverse), [false, true]);
    });

    it("should put every electron where the rotating stage put it", () => {
      const defaults = {...instance.config};
      for (const config of [{}, {mixedOrbitDirections: false}, {rotationDuration: 8, electronSpeed: 4}, {rotationDuration: 120, electronSpeed: 2}]) {
        instance.config = {...defaults, ...config};
        const stage = {duration: instance.config.rotationDuration, delay: 0, reverse: false};
        for (const shell of instance.shellGeometry([2, 8, 18, 32, 32, 18, 8])) {
          const spin = instance.runnerSpin(shell);
          for (const time of [0, 0.4, 2.5, 7.3, 18, 41, 3600.25]) {
            assertSameAngle(cssTurn(spin, time), cssTurn(stage, time) + cssTurn(shell, time));
          }
        }
      }
    });

    it("should hold the electrons at a fixed angle when the rotations cancel out", () => {
      instance.config.rotationDuration = 11.2;
      const [, shell] = instance.shellGeometry([2, 8]);
      const spin = instance.runnerSpin(shell);
      assert.equal(spin.duration, 0);
      // -1.5 s of 11.2 s turning back: 1.5 / 11.2 of a turn before 0deg
      assertClose(spin.angle, 360 - 1.5 / 11.2 * 360);
      for (const time of [0, 3, 11.2, 100]) {
        assertSameAngle(spin.angle, cssTurn({duration: 11.2, delay: 0, reverse: false}, time) + cssTurn(shell, time));
      }
    });
  });

  describe("stepSpin", () => {
    // Every runner as the CSS renderer animates it, for the 7 shells of the largest atoms
    const steppedSpins = (config) => {
      Object.assign(instance.config, config);
      return instance.shellGeometry([2, 8, 18, 32, 32, 18, 8])
        .map((shell) => instance.runnerSpin(shell))
        .map((spin) => ({spin, stepped: instance.stepSpin(spin)}));
    };
    const configs = [{}, {autoRotate: false}, {mixedOrbitDirections: false}, {rotationDuration: 8, electronSpeed: 4}, {rotationDuration: 120, electronSpeed: 2}];

    it("should put the jumps of all runners on one grid of 1 / stepRate seconds", () => {
      const defaults = {...instance.config};
      for (const stepRate of [1, 2.5, 7, 10, 24, 60]) {
        for (const config of configs) {
          instance.config = {...defaults};
          for (const {stepped} of steppedSpins({...config, stepRate})) {
            assertClose(stepped.duration / stepped.steps, 1 / stepRate);
            assertClose(stepped.delay * stepRate, Math.round(stepped.delay * stepRate));
            assert.ok(Number.isInteger(stepped.steps) && stepped.steps >= 1);
          }
        }
      }
    });

    it("should keep the speed, direction and start angle within half a step", () => {
      const defaults = {...instance.config};
      for (const stepRate of [1, 2.5, 7, 10, 24, 60]) {
        for (const config of configs) {
          instance.config = {...defaults};
          for (const {spin, stepped} of steppedSpins({...config, stepRate})) {
            const halfStep = 0.5 / stepRate;
            assert.ok(Math.abs(stepped.duration - spin.duration) <= halfStep + 1e-9);
            assert.equal(stepped.reverse, spin.reverse);
            const startError = Math.abs(stepped.delay / stepped.duration - spin.delay / spin.duration) % 1;
            assert.ok(Math.min(startError, 1 - startError) <= 0.5 / stepped.steps + 1e-9);
          }
        }
      }
    });

    it("should take at least one step per revolution", () => {
      context.document.createElement = fakeElement;
      instance.config.autoRotate = false;
      instance.config.stepRate = 0.01;
      const stepped = instance.stepSpin(instance.runnerSpin(instance.shellGeometry([2])[0]));
      assert.equal(stepped.steps, 1);
      assertClose(stepped.duration, 100);
      const [runner] = instance.createShellElements([2]).children[0].children;
      assert.equal(runner.style.animationTimingFunction, "steps(1)");
    });
  });

  describe("shellGeometry", () => {
    it("should describe the size and motion of every shell", () => {
      const geometry = instance.shellGeometry([2, 8, 4]);
      assert.deepEqual(geometry.map(({electronCount, rotation, reverse}) => [electronCount, rotation, reverse]), [[2, 0, false], [8, 24, true], [4, 48, false]]);
      for (const [index, shell] of geometry.entries()) {
        assertClose(shell.diameter, [109.6, 166.4, 223.2][index]);
        assertClose(shell.duration, 10 + index * 1.2);
        assertClose(shell.delay, index * -1.5);
      }
    });

    it("should keep 14 px between the shells and the rings inside the stage", () => {
      instance.config.size = 140;
      const diameters = instance.shellGeometry([2, 8, 18, 32, 32, 18, 8]).map((shell) => shell.diameter);
      for (const [index, expected] of [58.8, 86.8, 114.8, 133, 133, 133, 133].entries()) {
        assertClose(diameters[index], expected);
      }
    });

    it("should not reverse any shell without mixedOrbitDirections", () => {
      instance.config.mixedOrbitDirections = false;
      assert.deepEqual(instance.shellGeometry([2, 8, 4]).map((shell) => shell.reverse), [false, false, false]);
    });

    it("should be the geometry of the CSS rings and runners", () => {
      context.document.createElement = fakeElement;
      instance.config.autoRotate = false;
      const geometry = instance.shellGeometry([2, 8, 4]);
      const rings = instance.createShellElements([2, 8, 4]).children;
      assert.deepEqual(rings.map((ring) => ring.style.width), geometry.map((shell) => `${shell.diameter}px`));
      assert.deepEqual(rings.map((ring) => [...ring.style.setProperty.mock.calls[0].arguments]), geometry.map((shell) => ["--shell-z-rotation", `${shell.rotation}deg`]));
      assert.deepEqual(rings.map((ring) => ring.children[0].style.animationDuration), geometry.map((shell) => `${shell.duration}s`));
    });
  });

  describe("createPeriodicTable", () => {
    const cellOf = (table, symbol) => table.children.find((cell) => cell.title === symbol);
    const positionOf = (cell) => [Number(cell.style.gridRow), Number(cell.style.gridColumn)];

    beforeEach(() => {
      context.document.createElement = fakeElement;
    });

    it("should place the elements by period and group and the lanthanides and actinides in rows 9 and 10", () => {
      const table = instance.createPeriodicTable("C");
      assert.equal(table.className, "atom-periodic-table");
      for (const [symbol, row, column] of [["H", 1, 1], ["He", 1, 18], ["La", 9, 3], ["Lu", 9, 17], ["U", 10, 6], ["Au", 6, 11]]) {
        assert.deepEqual(positionOf(cellOf(table, symbol)), [row, column], symbol);
      }
    });

    it("should give every element its own cell in 18 columns and 10 rows, with row 8 as the spacer", () => {
      const table = instance.createPeriodicTable("C");
      assert.equal(table.children.length, 118);
      const positions = table.children.map((cell) => positionOf(cell));
      assert.equal(new Set(positions.map(String)).size, 118);
      assert.ok(positions.every(([row, column]) => row >= 1 && row <= 10 && row !== 8 && column >= 1 && column <= 18));
    });

    it("should mark the element on display and only that one", () => {
      const table = instance.createPeriodicTable("U");
      assert.ok(table.children.every((cell) => hasClass(cell, "atom-table-cell")));
      assert.deepEqual(table.children.filter((cell) => hasClass(cell, "atom-table-cell--active")).map((cell) => cell.title), ["U"]);
    });
  });

  describe("getDom", () => {
    beforeEach(() => {
      context.document.createElement = fakeElement;
    });

    it("should put the periodic table first, so that it is left of the atom in a row", () => {
      instance.config.showPeriodicTable = true;
      instance.config.element = "Au";
      const [table, ...rest] = instance.getDom().children;
      assert.equal(table.className, "atom-periodic-table");
      assert.equal(table.children.find((cell) => hasClass(cell, "atom-table-cell--active")).title, "Au");
      assert.deepEqual(rest.map((child) => child.className), ["atom-stage", "atom-details"]);
    });

    it("should leave the DOM as it was while the new options are off", () => {
      instance.config.element = "O";
      const withoutOptions = serializeDom(instance.getDom());
      Object.assign(instance.config, {showPeriodicTable: false, showAbundance: false, showFact: false});
      instance.facts = {O: ["A fact"]};
      for (const name of ["createPeriodicTable", "formatAbundance", "currentFact"]) {
        instance[name] = () => assert.fail(`${name} ran`);
      }
      assert.equal(serializeDom(instance.getDom()), withoutOptions);
      assert.deepEqual(instance.getDom().children.map((child) => child.className), ["atom-stage", "atom-details"]);
    });
  });

  describe("formatAbundance", () => {
    // Intl puts a no-break space between number and percent sign in German
    const format = (locale, ppm) => {
      instance.abundanceFormats = instance.buildAbundanceFormats(locale);
      return instance.formatAbundance(ppm).replace(/\s/gu, " ");
    };

    it("should show percent from 1000 ppm, with 2 significant digits", () => {
      for (const [ppm, de, en] of [[461000, "46 %", "46%"], [82300, "8,2 %", "8.2%"], [1400, "0,14 %", "0.14%"], [1000, "0,1 %", "0.1%"], [999.9, "0,1 %", "0.1%"]]) {
        assert.equal(format("de", ppm), de);
        assert.equal(format("en", ppm), en);
      }
    });

    it("should show ppm from 0.001 ppm to below 1000 ppm, with 2 significant digits", () => {
      for (const [ppm, de, en] of [[950, "950 ppm", "950 ppm"], [994, "990 ppm", "990 ppm"], [2.7, "2,7 ppm", "2.7 ppm"], [0.004, "0,004 ppm", "0.004 ppm"], [0.0315, "0,032 ppm", "0.032 ppm"], [0.001, "0,001 ppm", "0.001 ppm"]]) {
        assert.equal(format("de", ppm), de);
        assert.equal(format("en", ppm), en);
      }
    });

    it("should show traces below 0.001 ppm", () => {
      const traces = {de: "Spuren", en: "traces"};
      for (const locale of ["de", "en"]) {
        instance.translate = mock.fn(() => traces[locale]);
        for (const ppm of [0.00094, 4e-13, 0]) {
          assert.equal(format(locale, ppm), traces[locale]);
        }
        assert.ok(instance.translate.mock.calls.every((call) => call.arguments[0] === "ABUNDANCE_TRACES"));
      }
    });

    it("should format for config.locale, else for config.language", () => {
      instance.config.showAbundance = true;
      for (const [globalConfig, expected] of [[{language: "de"}, "0,14 %"], [{language: "de", locale: "en-GB"}, "0.14%"]]) {
        context.config = globalConfig;
        instance.start();
        assert.equal(instance.formatAbundance(1400).replace(/\s/gu, " "), expected);
      }
      context.config = {language: "en"};
    });
  });

  describe("abundance row", () => {
    const detailRows = (symbol) => {
      instance.config.element = symbol;
      const grid = instance.getDom().children[1].children.find((child) => child.className === "atom-detail-grid");
      const spans = grid
        ? grid.children
        : [];
      return spans.map((span) => span.innerText);
    };

    beforeEach(() => {
      context.document.createElement = fakeElement;
      instance.config.showAbundance = true;
      instance.abundanceFormats = instance.buildAbundanceFormats("en");
    });

    it("should add the abundance as the last row of the detail grid", () => {
      assert.deepEqual(detailRows("O").slice(-2), ["DETAIL_ABUNDANCE", "46%"]);
      assert.deepEqual(detailRows("Au").slice(-2), ["DETAIL_ABUNDANCE", "0.004 ppm"]);
      assert.deepEqual(detailRows("Rn").slice(-2), ["DETAIL_ABUNDANCE", "ABUNDANCE_TRACES"]);
    });

    it("should add no row for an element without a value", () => {
      assert.ok(!detailRows("Pu").includes("DETAIL_ABUNDANCE"));
      assert.ok(!detailRows("H").includes("DETAIL_ABUNDANCE"));
    });

    it("should show the row also when it is the only detail", () => {
      for (const key of ["showLabel", "showAtomicNumber", "showShells", "showAtomicMass", "showCategory", "showCas", "showPhase", "showElectronegativity", "showDiscoveredBy"]) {
        instance.config[key] = false;
      }
      assert.deepEqual(detailRows("U"), ["DETAIL_ABUNDANCE", "2.7 ppm"]);
    });
  });

  describe("currentFact", () => {
    beforeEach(() => {
      instance.facts = {Au: ["Au 1", "Au 2", "Au 3"], U: ["U 1", "U 2"], H: ["H 1"], He: []};
    });

    it("should never show the fact that the element showed the time before", () => {
      const shown = {Au: [], U: []};
      for (let round = 0; round < 200; round += 1) {
        for (const symbol of ["Au", "U", "C"]) {
          const fact = instance.currentFact(symbol);
          if (symbol !== "C") {
            assert.notEqual(fact, shown[symbol].at(-1), `${symbol} in round ${round}`);
            shown[symbol].push(fact);
          }
        }
      }
      assert.deepEqual(new Set(shown.Au), new Set(instance.facts.Au));
      assert.deepEqual(shown.U.slice(2, 6), shown.U.slice(0, 4));
    });

    it("should keep the fact while the element stays on display", () => {
      for (let display = 0; display < 20; display += 1) {
        const fact = instance.currentFact("Au");
        for (let render = 0; render < 5; render += 1) {
          assert.equal(instance.currentFact("Au"), fact);
        }
        instance.currentFact("U");
      }
    });

    it("should show the only fact of an element every time", () => {
      for (let display = 0; display < 5; display += 1) {
        assert.equal(instance.currentFact("H"), "H 1");
        instance.currentFact("Au");
      }
    });

    it("should show no fact for an element without facts or before the facts arrive", () => {
      assert.equal(instance.currentFact("He"), null);
      assert.equal(instance.currentFact("C"), null);
      instance.facts = undefined;
      assert.equal(instance.currentFact("Au"), null);
    });

    it("should pick a fact when the facts arrive while the element is on display", () => {
      instance.facts = undefined;
      assert.equal(instance.currentFact("Au"), null);
      instance.facts = {Au: ["Au 1", "Au 2"]};
      const fact = instance.currentFact("Au");
      assert.ok(instance.facts.Au.includes(fact));
      assert.equal(instance.currentFact("Au"), fact);
    });
  });

  describe("fact line", () => {
    const details = () => instance.getDom().children[1];
    const factLine = () => details().children.find((child) => child.className === "atom-fact");

    beforeEach(() => {
      context.document.createElement = fakeElement;
      instance.config.showFact = true;
      instance.facts = {Au: ["Au 1", "Au 2", "Au 3"]};
    });

    it("should show a fact below the detail grid and the same one while the element stays", () => {
      instance.activeSymbol = "Au";
      assert.deepEqual(details().children.map((child) => child.className), ["atom-label", "atom-detail-grid", "atom-fact"]);
      const fact = factLine().innerText;
      assert.ok(instance.facts.Au.includes(fact));
      for (let render = 0; render < 5; render += 1) {
        assert.equal(factLine().innerText, fact);
      }
      instance.activeSymbol = "C";
      assert.equal(factLine(), undefined);
      instance.activeSymbol = "Au";
      assert.notEqual(factLine().innerText, fact);
    });

    it("should show the details also when the fact is all they show", () => {
      for (const key of ["showLabel", "showAtomicNumber", "showShells", "showAtomicMass", "showCategory", "showCas", "showPhase", "showElectronegativity", "showDiscoveredBy"]) {
        instance.config[key] = false;
      }
      instance.activeSymbol = "Au";
      assert.deepEqual(details().children.map((child) => child.className), ["atom-fact"]);
    });
  });

  describe("loadFacts", () => {
    beforeEach(() => {
      context.config = {language: "de"};
      instance.file = (name) => `modules/MMM-AtomVisualizer/${name}`;
      instance.updateDom = mock.fn();
    });

    it("should fetch the facts of the MagicMirror language and show them", async () => {
      context.fetch = mock.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({Au: ["Au 1"]})}));
      await instance.loadFacts();
      assert.deepEqual(context.fetch.mock.calls.map((call) => call.arguments[0]), ["modules/MMM-AtomVisualizer/data/facts.de.json"]);
      assert.equal(instance.facts.Au[0], "Au 1");
      assert.equal(instance.updateDom.mock.callCount(), 1);
    });

    it("should leave the module without facts when there is no file", async () => {
      const warnings = global.Log.warn.mock.callCount();
      context.fetch = mock.fn(() => Promise.resolve({ok: false, status: 404}));
      await instance.loadFacts();
      context.fetch = mock.fn(() => Promise.reject(new TypeError("Failed to fetch")));
      await instance.loadFacts();
      assert.equal(instance.facts, undefined);
      assert.equal(instance.updateDom.mock.callCount(), 0);
      assert.equal(global.Log.warn.mock.callCount() - warnings, 2);
    });

    it("should load the facts in start() only with showFact", () => {
      instance.loadFacts = mock.fn();
      instance.start();
      assert.equal(instance.loadFacts.mock.callCount(), 0);
      instance.config.showFact = true;
      instance.start();
      assert.equal(instance.loadFacts.mock.callCount(), 1);
    });
  });
});

describe("data files", () => {
  const readData = (name) => readFileSync(join(__dirname, "../../data", name), "utf8");

  it("should hold the data of each JSON file in its script for the browser", () => {
    for (const [scriptName, jsonName, globalName] of [["elements.js", "elements.json", "ELEMENTS_DATA"], ["abundance.js", "abundance.json", "ABUNDANCE_DATA"]]) {
      const scriptContext = vm.createContext({});
      new vm.Script(readData(scriptName), {filename: scriptName}).runInContext(scriptContext);
      assert.equal(JSON.stringify(scriptContext[globalName]), JSON.stringify(JSON.parse(readData(jsonName))), `${scriptName} differs from ${jsonName}`);
    }
  });

  it("should give the abundance of known elements as a number of ppm or null", () => {
    for (const [symbol, ppm] of Object.entries(JSON.parse(readData("abundance.json")))) {
      assert.ok(Object.hasOwn(context.ELEMENTS_DATA, symbol), `unknown element ${symbol}`);
      if (ppm !== null) {
        assert.ok(Number.isFinite(ppm) && ppm >= 0, `${symbol}: ${ppm}`);
      }
    }
  });

  it("should give known elements lists of facts in every facts file", () => {
    const factFiles = readdirSync(join(__dirname, "../../data")).filter((name) => (/^facts\.[a-z-]+\.json$/u).test(name));
    assert.ok(factFiles.length > 0);
    for (const name of factFiles) {
      for (const [symbol, facts] of Object.entries(JSON.parse(readData(name)))) {
        assert.ok(Object.hasOwn(context.ELEMENTS_DATA, symbol), `${name}: unknown element ${symbol}`);
        assert.ok(Array.isArray(facts) && facts.length > 0 && facts.every((fact) => typeof fact === "string" && fact.trim() !== ""), `${name}: ${symbol}`);
      }
    }
  });
});
