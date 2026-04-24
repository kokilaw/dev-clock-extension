Run browser integration tests with:

npm install
npm run test:integration

Notes:
- Tests open `popup.html` directly in a normal browser tab (web-app style).
- No extension loading is required for this test mode.
- Scenarios cover ISO, naive timezone interpretation, unix epoch, natural-language input, and invalid input handling.
