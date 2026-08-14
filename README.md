# Dažniausi lietuviški žodžiai

SvelteKit svetainė lietuvių kalbos žodžių dažniams ir rinkiniams tyrinėti.

## Ką galima daryti

- naršyti skirtingus lietuvių kalbos duomenų rinkinius;
- ieškoti, filtruoti ir rikiuoti žodžius bei žodžių formas;
- matyti dažnį, kalbos dalį ir kitą rinkinio informaciją;
- atsisiųsti atrinktus duomenis CSV formatu;
- peržiūrėti morfologijos, sintaksės ir žodynų duomenis.

## Paleidimas

Reikia Node.js 20 arba naujesnės versijos.

```bash
npm ci
npm run dev
```

## Patikra

```bash
npm run check
npm test
npm run build
npm run products:verify
npm run public:verify
```

Pagrindinis prižiūrimas rinkinio failas yra
`data/datasets/utka-2018-lemmatized-totals.json`. Duomenų tikrinimas:
`npm run data:verify`.

## Duomenys

Rinkinių šaltiniai, citatos, prieigos sąlygos ir licencijos nurodytos
programoje bei `static/data-products/` metaduomenyse. Duomenų paruošimo
taisyklės aprašytos [docs/data-preparation.md](docs/data-preparation.md).

## Licencija

Programos kodas (Copyright (C) 2026 Debesyla) platinamas pagal
[GNU GPL v3 arba vėlesnę versiją](LICENSE).
Duomenų rinkiniai nėra automatiškai GPL: kiekvienam rinkiniui galioja jo
metaduomenyse nurodyta licencija ir atskiri šaltinio reikalavimai.

Projektas nenaudoja analitikos ar sekimo.
