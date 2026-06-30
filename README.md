# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
| `npm test`                | Run the Vitest unit + integration suite once     |
| `npm run test:watch`      | Run Vitest in watch mode                         |

## 🧪 Testing

Tests run on [Vitest](https://vitest.dev) entirely in-process — no database, network, or AI calls. The Supabase client is mocked at its factory boundary (`test/support/fake-supabase.ts`), and API route handlers are invoked directly with a fake context (`test/support/fake-context.ts`).

Current coverage (test-plan §3 Phase 1):

- **Plan/usage gating & metering** — FREE/PRO limits enforced, usage increments only on success (never on failure or double), Check's full success/failure contract.
- **Authorization / IDOR** — every practice-set `[id]` API route denies a non-owner (404) without serving or mutating their data, and rejects unauthenticated callers (401).

Unit tests live beside their module under `src/lib/**`; route/integration tests live under `test/integration/**` (they must stay out of `src/pages/**`, which Astro routes as endpoints). See `context/foundation/test-plan.md` §6 for how to add new tests.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
