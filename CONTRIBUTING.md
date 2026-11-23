# Contributing

Thanks for helping improve Devistic Text Compare. The app is a client-side Vite + React + TypeScript project. Comparisons never leave the browser.

## Setup

```bash
npm install
npm run dev
```

## Checks

Run these before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` covers the diff engine, ignore options, patch export, HTML escaping, and local storage import/export. Please add a unit test when you change that logic.

## Pull requests

- Open a pull request against `main`.
- Describe the behavior you changed and how you checked it.
- Keep the privacy boundary: no network calls for user text, no analytics, no trackers.
- UI changes should stay keyboard accessible, keep visible focus, and work in light and dark themes.

## Reporting issues

Use the bug and feature templates. Do not include private text from a real document in a screenshot or sample. A short synthetic example is enough.

## Contact

[github.com/devistic-asim](https://github.com/devistic-asim)
