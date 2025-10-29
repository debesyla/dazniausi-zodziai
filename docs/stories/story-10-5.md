#### Story Title

Implement Load All Button for Datasets - Brownfield Addition

#### User Story

As a user,  
I want a "Rodyti visus" (Load all) button for long datasets that shows all items after clicking,  
So that I can view the full dataset when it exceeds the top 10 words.

#### Story Context

**Existing System Integration:**

- Integrates with: DataTable.svelte, data loading logic
- Technology: Svelte, JavaScript
- Follows pattern: Pagination or load more features
- Touch points: src/components/DataTable.svelte, lib/data.ts

#### Acceptance Criteria

**Functional Requirements:**

1. "Rodyti visus" button appears when dataset has more than 10 words
2. Clicking the button displays all dataset items in the table
3. Button is hidden or disabled after loading all

**Integration Requirements:**  
4. Table updates dynamically without page reload  
5. Existing filtering and sorting work with full dataset  

**Quality Requirements:**  
6. Performance is acceptable for large datasets  
7. UI indicates loading state if needed  
8. No data loss or errors

#### Tasks

- [x] Implement logic to detect dataset size
- [x] Add button to UI conditionally
- [x] Handle click to load and display all data
- [x] Update table rendering for full data
- [x] Test with sample-dataset-2.json (60 items)

#### Dev Agent Record

##### Agent Model Used

James - Full Stack Developer

##### Debug Log References

- Initial implementation completed without issues.

##### Completion Notes

- Implemented load all button that appears when filtered words > 10, shows top 10 initially, loads all on click.
- Added tests covering the functionality.
- UI indicates count as 10 / 60 when not loaded all.

##### Change Log

- Added loadAll key to translations
- Modified DataLoader to limit display to 10 initially, add button and logic
- Added unit tests for the new feature

#### File List

- src/lib/translations.ts
- src/components/DataLoader.svelte
- tests/unit/components/DataLoader.test.js

#### Status

Ready for Review

#### Technical Notes

- **Integration Approach:** Modify data display logic in components
- **Existing Pattern Reference:** Current data loading
- **Key Constraints:** Handle large data efficiently

#### Definition of Done