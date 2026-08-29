# E2E Testing Rules

- Use `getByRole`, `getByLabel`, `getByText` as primary locators.
  Fall back to `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared mutable state between tests.
- Never use `page.waitForTimeout()`. Wait for specific conditions:
  `toBeVisible()`, `waitForURL()`, `waitForResponse()`.
- Assert the business outcome, not implementation details.
- Use unique identifiers (timestamp suffix) for test data to avoid collisions in parallel runs.
  Clean up seeded rows in a `finally` block.
- Use `storageState` for authentication — never log in through the Google OAuth UI
  in individual tests (`e2e/auth.setup.ts` owns sign-in).
