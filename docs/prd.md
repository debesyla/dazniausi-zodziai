# Dažniausi lietuviški žodžiai Product Requirements Document (PRD)

## Goals and Background Context

### Goals
- Launch the website within 2 weeks of development start.  
- Achieve 100 unique visitors in the first month post-launch.  
- Enable at least 50 data downloads in the first quarter.  
- Users can filter and sort data within 30 seconds of landing.  
- 80% of users complete at least one comparison or download.  
- Positive feedback on design and usability in surveys.  
- Page load time under 2 seconds.  
- Bounce rate below 40%.  
- User session duration over 5 minutes.  

### Post-MVP Enhancement Goals
- Generate a second example word data .json file and implement a way to switch data sources in the website.  
- Translate all text lines in the website to Lithuanian, making the UI fully Lithuanian.  

### Background Context### Background Context  
This project addresses the challenge of inaccessible Lithuanian word frequency data from various researchers, which exists in raw tab-separated files. By creating a static Svelte-based website, we provide an interactive, culturally-inspired interface for linguists, researchers, and students to browse, filter, download, and compare datasets. The solution emphasizes a unique Baltic amber terminal design to make data exploration engaging, filling a gap where generic tools fail to cater to Lithuanian linguistic needs. This initiative supports digital preservation of language data and enhances accessibility for academic and educational purposes.  

### Change Log  
| Date       | Version | Description                          | Author |  
|------------|---------|--------------------------------------|--------|  
| 2025-10-26 | v1.0    | Initial PRD creation based on brief. | John   |  
| 2025-10-27 | v1.1    | Added Requirements, UI Goals, Technical Assumptions, Epics. | John   |  

## Requirements

### Functional
FR1: The application must load JSON-formatted datasets containing metadata such as author, year, and word lists with frequencies.  
FR2: Display loaded words in a sortable table view, allowing sorting by word (A-Z) and frequency count.  
FR3: Include a search bar to filter words by text input.  
FR4: Enable users to download the displayed data in a suitable format (e.g., CSV or JSON).  
FR5: Implement data source switching functionality, allowing users to select between multiple JSON datasets.  
FR6: Translate all UI text to Lithuanian and ensure full localization of the interface.  

### Non Functional
NFR1: Page load time must be under 2 seconds for datasets up to 10 files.  
NFR2: The interface must be responsive and functional on modern browsers across desktop and mobile devices.  
NFR3: Incorporate a distinctive Baltic amber terminal design with dark background, amber text, and pixelated symbols for a culturally-inspired aesthetic.  
NFR4: Ensure the application remains static with no server-side processing, relying solely on client-side loading.  

## User Interface Design Goals

### Overall UX Vision
A minimalist, terminal-inspired interface that transforms exploring Lithuanian word frequency data into an engaging, culturally immersive experience, resembling an ancient Baltic artifact while ensuring intuitive navigation and quick access to insights for linguists and students.

### Key Interaction Paradigms
- Table sorting via column header clicks (A-Z, frequency ascending/descending).  
- Real-time search filtering as users type in the search bar.  
- One-click download of filtered or full datasets.  
- Dataset selection via dropdown or list for switching between loaded JSON files.

### Core Screens and Views
- Dataset Selection Screen: Initial view to choose and load a dataset with metadata display.  
- Main Data Table View: Central screen showing sortable, searchable table of words and frequencies.  
- Download Confirmation View: Simple modal or overlay for export options.

### Accessibility: WCAG AA
Basic accessibility compliance to ensure usability for users with disabilities, including keyboard navigation, screen reader support, and color contrast in the amber theme.

### Branding
Incorporate a distinctive Baltic amber terminal aesthetic: dark background, amber-colored text and accents, pixelated symbols (e.g., amber drops or ancient motifs) for buttons and icons, evoking a retro terminal feel while honoring Lithuanian cultural heritage.

### Target Device and Platforms: Web Responsive
Optimized for modern web browsers on desktop and mobile devices, ensuring the table and interactions adapt seamlessly to different screen sizes.

## Technical Assumptions

### Repository Structure: Monorepo
A single repository containing all source code, data files, and documentation for simplicity in a solo-developer setup.

### Service Architecture
Client-side only architecture with no backend or database; data loaded statically from embedded JSON files, ensuring a fully static site deployable to free hosting like GitHub Pages or Netlify.

### Testing Requirements
Unit testing for components and functions, plus integration testing for data loading and UI interactions to validate end-to-end functionality without a full pyramid (given static nature and no server-side logic).

### Additional Technical Assumptions and Requests
- Frontend framework: Svelte for building the static single-page application.  
- Hosting: GitHub Pages or Netlify for free, static deployment.  
- Data format: Pre-converted tab-separated files to JSON with metadata.  
- Performance: Optimize for fast loads by keeping datasets small and using Svelte's efficiency.  
- Browser support: Modern browsers only, as specified.  
- No APIs or external integrations required.  

## Epic List

Epic 1: Foundation & Core Infrastructure  
Goal: Set up the Svelte project, establish basic app structure, integrate initial JSON data loading, and deploy a minimal viable page to verify setup.

Epic 2: Data Exploration Features  
Goal: Implement the sortable table view with search and filtering to enable users to browse and interact with word frequency data effectively.

Epic 3: Cultural Design & Enhancements  
Goal: Apply the Baltic amber terminal theme, ensure responsive design across devices, and add download functionality for a polished, culturally immersive experience.

Epic 4: Validation & Launch  
Goal: Conduct testing, optimize performance, and deploy to static hosting to meet launch timelines and user success metrics.

## Epic 1 Foundation & Core Infrastructure
Establish the technical foundation for the project by setting up the Svelte environment, configuring the repository, and implementing basic data loading. This epic ensures the app can run locally and load datasets, providing a stable base for subsequent features. It delivers initial value by enabling a working prototype that demonstrates data access and meets the launch timeline goal.

### Story 1.1 Setup Svelte Project Foundation
As a developer,  
I want to initialize a Svelte project with basic build configuration and a simple landing page,  
so that I have a runnable app foundation for further development.  

#### Acceptance Criteria
1.1: Svelte project is created using the official template.  
1.2: Build and dev scripts are configured and functional.  
1.3: A basic page renders with project title and placeholder content.  
1.4: Repository is initialized with Git and basic structure (src/, data/).  

### Story 1.2 Implement JSON Data Loading
As a developer,  
I want to create a component that loads and parses embedded JSON datasets with metadata,  
so that the app can access and display word frequency data.  

#### Acceptance Criteria
2.1: JSON files are placed in the data/ directory.  
2.2: A data loading function parses JSON and extracts words, frequencies, and metadata.  
2.3: Component renders loaded data in a simple list format.  
2.4: Error handling for invalid JSON or missing files.  

## Epic 2 Data Exploration Features
Build core user-facing functionality by implementing the sortable table and search capabilities. This epic enables users to interact with data effectively, supporting the primary goal of quick filtering and sorting within 30 seconds. It delivers tangible value by allowing linguists and students to explore datasets, directly contributing to user success metrics like completion rates.

### Story 2.1 Create Sortable Table Component
As a user (linguist or student),  
I want to view words in a table that I can sort by word or frequency,  
so that I can organize data for analysis.  

#### Acceptance Criteria
1.1: Table component displays words and frequencies from loaded data.  
1.2: Column headers allow ascending/descending sort on click.  
1.3: Sorting is performant for datasets up to 10,000 words.  
1.4: Table updates dynamically without page reload.  

### Story 2.2 Add Search and Filter Functionality
As a user (linguist or student),  
I want to filter the table by typing in a search bar,  
so that I can quickly find specific words or patterns.  

#### Acceptance Criteria
2.1: Search bar is present above the table.  
2.2: Typing filters rows in real-time (case-insensitive).  
2.3: Filter works on word text only.  
2.4: Clear search option resets the view.  

## Epic 3 Cultural Design & Enhancements
Apply the unique Baltic aesthetic and add finishing touches like downloads and responsiveness. This epic enhances user engagement through cultural relevance and usability, aiming for positive feedback on design. It delivers a polished experience that meets branding goals and ensures the app feels modern yet immersive, supporting long-term visitor retention.

### Story 3.1 Implement Baltic Amber Theme
As a user (Lithuanian linguist or enthusiast),  
I want the interface to feature a dark background with amber text and pixelated symbols,  
so that the app feels culturally inspired and engaging.  

#### Acceptance Criteria
1.1: CSS applies dark BG and amber (#FFBF00) text colors.  
1.2: Pixelated symbols (e.g., amber icons) are added to buttons/elements.  
1.3: Theme is consistent across all components.  
1.4: Design evokes a terminal feel without hindering readability.  

### Story 3.2 Ensure Responsive Design and Downloads
As a user (on mobile or desktop),  
I want the table and interactions to work seamlessly on my device, plus a download option,  
so that I can access and export data anytime.  

#### Acceptance Criteria
2.1: Table and search are responsive (mobile-friendly layout).  
2.2: Download button exports current view as CSV.  
2.3: Export includes metadata and filtered data.  
2.4: No layout breaks on screens <768px wide.  

## Epic 4 Validation & Launch
Finalize the app with testing, performance checks, and deployment. This epic ensures reliability and meets KPIs like load times and bounce rates. It delivers launch-ready value by making the site live, enabling visitor acquisition and feedback collection for iterative improvements.

### Story 4.1 Add Testing and Performance Optimization
As a developer,  
I want unit and integration tests plus optimized loads,  
so that the app is reliable and meets performance goals.  

#### Acceptance Criteria
1.1: Unit tests cover data loading and sorting functions.  
1.2: Integration test validates search and table interactions.  
1.3: Page load <2 seconds for sample data.  
1.4: Bundle size optimized for static hosting.  

### Story 4.2 Deploy and Validate Launch
As a product owner,  
I want the site deployed to free hosting with final checks,  
so that users can access it and metrics can be tracked.  

#### Acceptance Criteria
2.1: App deployed to GitHub Pages or Netlify.  
2.2: Live URL functional with all features.  
2.3: Basic analytics (e.g., visitor count) set up.  
2.4: Post-launch checklist confirms no errors.  

## Checklist Results Report

### Executive Summary
- **Overall PRD Completeness:** 95% (most sections fully addressed based on brief and template).  
- **MVP Scope Appropriateness:** Just Right (focused on core features, clear boundaries).  
- **Readiness for Architecture Phase:** Ready (technical assumptions and epics provide solid foundation).  
- **Most Critical Gaps:** Minor refinements in data requirements and integration (no blockers).

### Category Statuses

| Category                         | Status  | Critical Issues |
| -------------------------------- | ------- | --------------- |
| 1. Problem Definition & Context  | PASS    | None            |
| 2. MVP Scope Definition          | PASS    | None            |
| 3. User Experience Requirements  | PASS    | None            |
| 4. Functional Requirements       | PASS    | None            |
| 5. Non-Functional Requirements   | PASS    | None            |
| 6. Epic & Story Structure        | PASS    | None            |
| 7. Technical Guidance            | PASS    | None            |
| 8. Cross-Functional Requirements | PARTIAL | Data migration and schema changes not detailed (not applicable for static site). |
| 9. Clarity & Communication       | PASS    | None            |

### Critical Deficiencies
- No major deficiencies; PRD is well-structured and aligned with brief.  
- Partial in cross-functional due to static nature (no data storage/migration needed).

### Recommendations
- No blockers; proceed to architecture.  
- For future iterations, add data schema details if dynamic features expand.  
- Ensure stakeholder review of epics before development.

### Final Decision
- **READY FOR ARCHITECT**: The PRD and epics are comprehensive, properly structured, and ready for architectural design.

## Next Steps

### UX Expert Prompt
Using the attached PRD document, create the architecture document focusing on the technical implementation details for the Svelte-based static site, including component structure, data handling, and deployment setup.