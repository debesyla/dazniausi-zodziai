#### Story Title

Design and Place Clear Filters Button in UI - Brownfield Addition

#### User Story

As a user,  
I want a "Išvalyti filtrus" button in the interface,  
So that I can easily clear all applied filters with one click.

#### Story Context

**Existing System Integration:**

- Integrates with: Filter controls, likely in SearchBar or DataTable components
- Technology: Svelte, CSS
- Follows pattern: UI button additions
- Touch points: src/components/, app.css

#### Acceptance Criteria

**Functional Requirements:**

1. Button labeled "Išvalyti filtrus" is visible in the UI
2. Button is positioned appropriately near filter controls
3. Button styling matches the site's design

**Integration Requirements:**  
4. Button integrates with existing layout without breaking responsiveness  
5. New functionality follows existing UI patterns  

**Quality Requirements:**  
6. Button is accessible (e.g., proper ARIA labels)  
7. Documentation is updated if needed  
8. No regression in existing UI

#### Tasks

- [x] Design button placement in the UI
- [x] Add button element to relevant component
- [x] Style the button to match site theme

#### Technical Notes

- **Integration Approach:** Add button to filter area
- **Existing Pattern Reference:** Other buttons in the app
- **Key Constraints:** Maintain responsive design

#### Definition of Done

- [x] Functional requirements met
- [x] Integration requirements verified
- [x] Existing functionality regression tested
- [x] Code follows existing patterns and standards
- [x] Tests pass (existing and new)
- [x] Documentation updated if applicable

#### Dev Agent Record

##### Agent Model Used

James

##### Debug Log References

##### Completion Notes List

- Implemented clear filters button in DataLoader component that clears both search query and selected types
- Added Lithuanian translation for "Išvalyti filtrus"
- Styled button to match existing site theme (dark mode compatible)
- Added unit test for button presence
- All validations pass (tests and svelte-check)

##### File List

src/lib/translations.ts
src/components/DataLoader.svelte
tests/unit/components/DataLoader.test.js

##### Change Log

- Added clearFilters translation key
- Modified DataLoader.svelte to include clear filters button and function
- Updated DataLoader.test.js to include test for clear filters button

##### Status
Ready for Review
