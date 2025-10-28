# Tech Stack

This is the definitive technology selection for the entire project. All development must use these exact versions.

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | JavaScript | ES2022 | Core scripting | Standard for web, supported in Svelte |
| Frontend Framework | Svelte | 4.x | UI framework | Lightweight, performant for static sites per PRD |
| UI Component Library | None | - | Styling | Built-in Svelte components suffice for simplicity |
| State Management | Svelte Stores | Built-in | Reactive state | Simple, no external libs needed for static data |
| Routing | None | - | Navigation | Single-page app, no routing required |
| API Style | N/A | - | Data access | Client-side JSON loading only |
| Database | N/A | - | Data storage | Static JSON files |
| Cache | Browser Cache | - | Performance | Standard HTTP caching for static assets |
| File Storage | GitHub Repo | - | Asset hosting | Static files in repo |
| Authentication | N/A | - | User auth | No user accounts needed |
| Frontend Testing | Vitest | 1.x | Unit testing | Fast, integrates with SvelteKit if expanded |
| Backend Testing | N/A | - | Testing | No backend |
| E2E Testing | TBD | - | End-to-end | For UI interactions |
| Build Tool | Vite | 5.x | Bundling | Svelte's default, fast builds |
| Bundler | Vite | 5.x | Asset bundling | Included in build tool |
| IaC Tool | N/A | - | Infrastructure | Static hosting, no IaC needed |
| CI/CD | GitHub Actions | - | Automation | Free for repos, simple deploys |
| Monitoring | None | - | Observability | Basic, add if needed |
| Logging | Console | - | Error logging | Browser console for static app |
| CSS Framework | None | - | Styling | Custom CSS for amber theme |
| Hosting Platform | GitHub Pages | - | Deployment | Free, fast static hosting per PRD |
