# MMM-AtomVisualizer

`MMM-AtomVisualizer` is a MagicMirror² module that renders an animated atom in a Bohr-style model. By default, it cycles through the list of all chemical elements.

## Screenshot

![screenshot](screenshot.png)

## Installation

```bash
cd ~/MagicMirror/modules/
git clone https://github.com/KristjanESPERANTO/MMM-AtomVisualizer
```

## Update

```bash
cd ~/MagicMirror/modules/MMM-AtomVisualizer
git pull
```

## Configuration

Add the following block to your `config.js` file and adjust the options as needed:

```js
{
  module: "MMM-AtomVisualizer",
  position: "top_right",
  config: {
    cycleElements: true,
    cycleEvery: 45,
  }
},
```

## Options

| Option                  | Type       | Default | Description                                                                                             |
| ----------------------- | ---------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `element`               | `string`   | `"C"`   | Element symbol to display                                                                               |
| `elements`              | `string[]` | `[]`    | Element list used when `cycleElements` is enabled. An empty array cycles through all available elements |
| `cycleElements`         | `boolean`  | `true`  | Automatically cycle through `elements`                                                                  |
| `shuffleElements`       | `boolean`  | `true`  | Randomize element order when cycling starts (Fisher-Yates shuffle)                                      |
| `cycleEvery`            | `number`   | `60`    | Cycle interval in seconds                                                                               |
| `size`                  | `number`   | `240`   | Atom size in pixels                                                                                     |
| `shellScaling`          | `number`   | `0`     | Draw atoms with fewer shells smaller (0 = all at `size`, 1 = radius proportional to the shell count)    |
| `nucleusScale`          | `number`   | `0.22`  | Nucleus-to-atom size ratio                                                                              |
| `electronSize`          | `number`   | `7`     | Electron size in pixels                                                                                 |
| `electronSpeed`         | `number`   | `10`    | Base electron revolution duration (seconds)                                                             |
| `mixedOrbitDirections`  | `boolean`  | `true`  | Alternate electron direction per shell for visual depth                                                 |
| `autoRotate`            | `boolean`  | `true`  | Slowly rotate shell system                                                                              |
| `rotationDuration`      | `number`   | `42`    | Duration of one shell system rotation in seconds                                                        |
| `stepRate`              | `number`   | `0`     | Electron steps per second instead of smooth motion, for weak devices (0 = smooth, otherwise 10 to 60)   |
| `showLabel`             | `boolean`  | `true`  | Show element name and symbol                                                                            |
| `showAtomicNumber`      | `boolean`  | `true`  | Show atomic number                                                                                      |
| `showShells`            | `boolean`  | `true`  | Show shell distribution (e.g. 2-8-6)                                                                    |
| `showAtomicMass`        | `boolean`  | `true`  | Show atomic mass                                                                                        |
| `showCategory`          | `boolean`  | `true`  | Show element category                                                                                   |
| `showCas`               | `boolean`  | `true`  | Show CAS registry number                                                                                |
| `showPhase`             | `boolean`  | `true`  | Show phase (solid / liquid / gas)                                                                       |
| `showElectronegativity` | `boolean`  | `true`  | Show electronegativity (Pauling scale)                                                                  |
| `showDiscoveredBy`      | `boolean`  | `true`  | Show discoverer                                                                                         |
| `showPeriodicTable`     | `boolean`  | `false` | Show a small periodic table that marks the element (cell size: CSS variable `--atom-table-cell-size`)   |
| `showAbundance`         | `boolean`  | `false` | Show the abundance in the Earth's crust by mass (in % from 1000 ppm, below 0.001 ppm as traces)         |
| `abundanceInPercent`    | `boolean`  | `false` | Show the abundance in percent at every size (`false`: in ppm below 0.1 %)                               |
| `showFact`              | `boolean`  | `false` | Show a short fact from `data/facts.<language>.json` (so far only `de`), a new one each time it comes up |

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Data Sources

Element data is bundled statically in `data/elements.json`, the abundances in the Earth's crust in `data/abundance.json` and the facts in `data/facts.<language>.json`. See [data/README.md](data/README.md) for field descriptions and license information.

## License

This module is licensed under the MIT License. See [LICENSE.md](LICENSE.md) for details.
