#### Story Title

Integrate Base CSS into Application - Brownfield Addition

#### User Story

As a developer,  
I want to integrate the base CSS, adapting it for the app,  
So that the site uses consistent colors, fonts, and spacing.

#### Story Context

**Existing System Integration:**

- Integrates with: app.css, component styles
- Technology: CSS
- Follows pattern: Style integration
- Touch points: src/app.css, components

#### Acceptance Criteria

**Functional Requirements:**

1. Base CSS is added to app.css
2. Colors, fonts, spacing adapted for app needs
3. Styles apply globally

**Integration Requirements:**  
4. Existing styles are updated to align  
5. No breaking changes to layout  

**Quality Requirements:**  
6. Styles are consistent across components  
7. Documentation is updated if needed  
8. No visual regressions

#### Tasks

- [x] Add base CSS to app.css
- [x] Adapt colors, fonts, spacing
- [x] Update component styles to use base

#### Technical Notes

- **Integration Approach:** Merge and override
- **Existing Pattern Reference:** CSS imports
- **Key Constraints:** Maintain responsiveness

#### Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable

#### Dev Agent Record

##### Agent Model Used

dev

##### Debug Log References

None

##### Completion Notes List

- Added base CSS to app.css: Included spacing vars (--xs to --3xl), updated :root bg-color to #222, merged base styles (resets, body with padding/margin/max-width, fonts monospace family, button/details styles).
- Adapted colors: Background #222, text #FFBF00, borders #FFBF00 for consistency.
- Adapted fonts: Changed to monospace,"Courier New",Courier,sans-serif.
- Adapted spacing: Added CSS vars for consistent spacing.
- Updated component styles: DownloadButton and SearchBar buttons to base style (transparent bg, amber border/color, hover invert colors). SearchBar input/button padding adjusted. +page select styled to match (dark bg, amber border/color).
- No breaking changes: Layout includes padding, maintains responsiveness. Styles consistent across components.

##### File List

Modified: src/app.css, src/components/DownloadButton.svelte, src/components/SearchBar.svelte, src/routes/+page.svelte

##### Change Log

- 2025-10-29: Integrated base CSS into app.css, adapted colors/fonts/spacing, updated component styles for consistency. Build/tests/check pass.

##### Status

Ready for Review
