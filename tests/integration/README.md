Run browser integration tests with:

npm install
npm run test:integration

Notes:
- Tests are BDD-style Gherkin scenarios.
- Feature files live under `tests/bdd/features/`.
- Step definitions live under `tests/bdd/steps/` and `tests/bdd/support/`.
- Tests open `dist/converter-popup.html` in a normal browser tab (web-app style).
- No extension loading is required for this test mode.
