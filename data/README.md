# Element Data

## elements.json

Static dataset with properties of all 118 chemical elements, keyed by symbol.

### Fields per element

| Field                   | Type     | Example (Iron)     |
| ----------------------- | -------- | ------------------ |
| `number`                | number   | 26                 |
| `name`                  | string   | "Iron"             |
| `atomicMass`            | number   | 55.845             |
| `category`              | string   | "transition metal" |
| `block`                 | string   | "d"                |
| `group`                 | number   | 8                  |
| `period`                | number   | 4                  |
| `phase`                 | string   | "Solid"            |
| `density`               | number   | 7.874              |
| `melt`                  | number   | 1811 (K)           |
| `boil`                  | number   | 3134 (K)           |
| `shells`                | number[] | `[2, 8, 14, 2]`    |
| `electronConfiguration` | string   | `"[Ar] 3d6 4s2"`   |
| `electronegativity`     | number   | 1.83               |
| `electronAffinity`      | number   | 14.785 (kJ/mol)    |
| `discoveredBy`          | string   | "5000 BC"          |
| `cas`                   | string   | "7439-89-6"        |

### Sources

- **Physical properties**: [Bowserinator/Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON) — CC BY-SA 3.0
- **CAS registry numbers**: [Wikidata](https://www.wikidata.org) — CC0

### Regenerating

To regenerate `elements.json` from the original sources, see the instructions in `build_elements.mjs`.

## abundance.json

Abundance of the elements in the Earth's crust in ppm (mg/kg) by mass, keyed by symbol: a number, or `null` where there is no value. A missing element counts as `null`, and the module shows no abundance for it.

### Sources

- **Values**: CRC Handbook of Chemistry and Physics, table "Abundance of Elements in the Earth's Crust and in the Sea" (97th edition, 2016–2017, p. 14-17): the median of reported values for the continental crust. Read from the column "Crust: CRC Handbook" of the Wikipedia [data page on the abundances of the elements](<https://en.wikipedia.org/wiki/Abundances_of_the_elements_(data_page)>) and checked against the Wikipedia article [Abundance of elements in Earth's crust](https://en.wikipedia.org/wiki/Abundance_of_elements_in_Earth%27s_crust), which cites the 97th edition, and against the crust column of the table "Elemental Abundances" in the Table of Isotopes of the Lawrence Berkeley National Laboratory.
- **`null`**: Tc, Pm, At, Fr, Np, Pu and all elements from Am on, for which the table has no value (in nature only fleeting traces or none at all).

Other estimates differ, for many trace elements by a factor of 2 to 3 (for example Au, Pt, Hg and Cu), so the values are orders of magnitude rather than exact figures.

## `facts.<language>.json`

Short facts about the elements for the `showFact` option, one file per language (`facts.de.json` for `language: "de"`), keyed by symbol: an array of strings. The module loads the file with `fetch()`, so it needs no script. Elements without facts, and languages without a file, show no fact.

`facts.de.json` has 10 facts each about 39 elements from hydrogen to plutonium, written for children and teenagers (about 10 to 16 years old) and checked against Wikipedia and other public references. Keep a fact to about 100 characters, so that it stays a short note next to the atom.

## Scripts for the browser

MagicMirror loads module data with `getScripts()`, which takes scripts, not JSON files. So `elements.js` holds the data of `elements.json` as the global `ELEMENTS_DATA`, and `abundance.js` holds `abundance.json` as `ABUNDANCE_DATA`. The JSON files are the sources: after changing one, make its script again in the module folder, for example (the unit tests check that both match):

```bash
{ printf '/* eslint-disable */\nvar ABUNDANCE_DATA = '; cat data/abundance.json; printf ';\n'; } > data/abundance.js
```
