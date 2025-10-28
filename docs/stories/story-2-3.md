#### Story Title

Update Selector to Use Dynamic Datasets - Brownfield Addition

#### Status

Ready for Review

#### User Story

As a developer,  
I want to update the selector component to use the dynamic list of datasets,  
So that options are populated automatically from available JSON files.

#### Story Context

**Existing System Integration:**

- Integrates with: +page.svelte
- Technology: Svelte
- Follows pattern: Component update
- Touch points: src/routes/+page.svelte

#### Acceptance Criteria

**Functional Requirements:**

1. Selector uses dynamic options from file list
2. Options display filenames appropriately
3. Selection and binding still works

**Integration Requirements:**  
4. Existing functionality continues to work unchanged  
5. New functionality follows existing pattern (UI update)  
6. Integration with DataLoader maintains current behavior

**Quality Requirements:**  
7. Change is covered by appropriate tests  
8. Documentation is updated if needed  
9. No regression in existing functionality verified

#### Technical Notes

- **Integration Approach:** Replace hardcoded options with dynamic list
- **Existing Pattern Reference:** Svelte reactive updates
- **Key Constraints:** Maintain translations if needed

#### Definition of Done

- [x] Functional requirements met
- [x] Integration requirements verified
- [x] Existing functionality regression tested
- [x] Code follows existing patterns and standards
- [x] Tests pass (existing and new)
- [x] Documentation updated if applicable

#### Dev Agent Record

**Current Implementation Details:**

The selector component in `src/routes/+page.svelte` was updated in story 2-2 to use dynamic options generated from the `getAvailableDatasets()` function. The selector now populates options automatically from the list of available JSON files in the data directory.

**Integration Approach:**

- Replaced hardcoded `<option>` elements with a dynamic `{#each}` loop over the `options` array.
- Maintained selection binding and current behavior through `selectedFilename` state.
- Preserved translated labels using `getDatasetLabel()` function for known datasets.

**Testing:**

- Existing tests verify the dynamic options rendering.
- All tests pass, confirming no regressions.

**Agent Model Used:** GitHub Copilot

**Debug Log References:** None

**Completion Notes List:**

- Selector update was implemented as part of story 2-2.
- No additional changes required for this story.
- Functionality verified through existing test suite.

**File List:** No new files modified or added (changes made in story 2-2).

**Change Log:** No changes made in this story.