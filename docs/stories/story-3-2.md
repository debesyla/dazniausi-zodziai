#### Story Title

Design Type Filter UI - Brownfield Addition

#### User Story

As a developer,  
I want to design and implement the filter UI for word types,  
So that users can select types to filter the displayed words.

#### Story Context

**Existing System Integration:**

- Integrates with: DataTable.svelte or parent component
- Technology: Svelte
- Follows pattern: Filter UI
- Touch points: src/components/

#### Acceptance Criteria

**Functional Requirements:**

1. Filter UI designed (dropdown or checkboxes)
2. UI implemented in component
3. Types extracted from data for options

**Integration Requirements:**  
4. Existing functionality continues to work unchanged  
5. New functionality follows existing pattern (UI addition)  
6. Integration with table maintains current behavior

**Quality Requirements:**  
7. Change is covered by appropriate tests  
8. Documentation is updated if needed  
9. No regression in existing functionality verified

#### Tasks

- [x] Filter UI designed (dropdown or checkboxes)
- [x] UI implemented in component
- [x] Types extracted from data for options

#### Dev Agent Record

**Implementation Details:**

- **Filter UI Design:** Implemented as checkboxes for multiple type selection, allowing users to filter by one or more word types.

- **UI Implementation:** Added type filter section in DataLoader.svelte with checkboxes for each unique type extracted from the dataset. Uses Svelte's bind:group for multiple selection.

- **Types Extraction:** Unique types are derived from dataset.words, filtering out undefined types.

- **Integration:** Extended filterWords function in utils.ts and utils.js to accept optional selectedTypes array. Updated DataLoader to pass selectedTypes to filterWords. Added translation for filter label.

**Debug Log References:**

- None

**Completion Notes List:**

- Implemented type filter UI with checkboxes.
- Updated filterWords function to support type filtering.
- Added tests for new functionality.
- No regressions in existing functionality.

#### File List

- Modified: src/components/DataLoader.svelte
- Modified: src/lib/utils.ts
- Modified: src/lib/utils.js
- Modified: src/lib/translations.ts
- Modified: tests/unit/utils/filter.test.js
- Modified: docs/stories/story-3-2.md

#### Change Log

- Added type filter UI with checkboxes in DataLoader.svelte.
- Extended filterWords function to support type filtering.
- Added translation for filter label.
- Added tests for type filtering functionality.

#### Status

Ready for Review

- **Integration Approach:** Add filter component above table
- **Existing Pattern Reference:** Svelte component patterns
- **Key Constraints:** Follow existing UI styles

#### Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable