#### Story Title

Reposition Search and Clear Filters UI - Brownfield Enhancement

#### User Story

As a user,  
I want the search field and "išvalyti filtrus" button in the same div, with type filter below, and clear button visible only when filters are active,  
So that the UI is more organized and the clear button appears contextually.

#### Story Context

**Existing System Integration:**

- Integrates with: SearchBar.svelte, DataTable.svelte, layout components
- Technology: Svelte, CSS
- Follows pattern: UI layout adjustments
- Touch points: src/components/, app.css

#### Acceptance Criteria

**Functional Requirements:**

1. Search field and "išvalyti filtrus" button are in the same container div
2. Type filter is positioned below the search container
3. Clear filters button is hidden by default and appears only when filters or search are active
4. Button visibility updates dynamically as filters change

**Integration Requirements:**  
5. Layout remains responsive on different screen sizes  
6. Existing filter functionality is preserved  

**Quality Requirements:**  
7. UI changes enhance usability without clutter  
8. Accessibility is maintained  
9. No regression in filter operations

#### Tasks

- [x] Identify current layout in components
- [x] Modify HTML structure to group search and clear button
- [x] Adjust CSS for new positioning
- [x] Implement conditional visibility for clear button
- [x] Test layout and functionality

#### Technical Notes

- **Integration Approach:** Update Svelte components and styles
- **Existing Pattern Reference:** Current filter UI
- **Key Constraints:** Maintain responsive design and performance

#### File List

- Modified: src/components/DataLoader.svelte
- Modified: tests/unit/components/DataLoader.test.js

#### Dev Agent Record

##### Debug Log

- None

##### Completion Notes

- Successfully repositioned search and clear filters UI as per requirements.
- All acceptance criteria met, tests pass, no regressions.

##### Agent Model Used

dev

##### Change Log

- Initial implementation completed.

#### Status

Ready for Review

#### Definition of Done