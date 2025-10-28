#### Story Title

Implement Dynamic JSON File Retrieval - Brownfield Addition

#### Status

Ready for Review

#### User Story

As a developer,  
I want to implement logic to dynamically retrieve JSON filenames from the data directory,  
So that the selector can populate options automatically.

#### Story Context

**Existing System Integration:**

- Integrates with: File system access via build tools
- Technology: JavaScript, Vite
- Follows pattern: Dynamic loading
- Touch points: data/ folder, selector component

#### Acceptance Criteria

**Functional Requirements:**

1. Function to list JSON files in data/ directory
2. Data available to the component at runtime
3. Options generated from the file list

**Integration Requirements:**  
4. Existing functionality continues to work unchanged  
5. New functionality follows existing pattern (file loading)  
6. Integration with selector maintains current behavior

**Quality Requirements:**  
7. Change is covered by appropriate tests  
8. Documentation is updated if needed  
9. No regression in existing functionality verified

#### Technical Notes

- **Integration Approach:** Use Vite's import.meta.glob or build script
- **Existing Pattern Reference:** Dynamic asset loading
- **Key Constraints:** Work in static site context

#### Definition of Done

- [x] Functional requirements met
- [x] Integration requirements verified
- [x] Existing functionality regression tested
- [x] Code follows existing patterns and standards
- [x] Tests pass (existing and new)
- [x] Documentation updated if applicable

#### Dev Agent Record

**Current Implementation Details:**

- Added `getAvailableDatasets()` function in `src/lib/data.ts` using `import.meta.glob` to dynamically retrieve JSON filenames from `/static/data/*.json` at build time.
- Updated `src/routes/+page.svelte` to use dynamic options generation with `getDatasetLabel()` function to maintain translated labels.
- Options are generated as an array of `{value, label}` objects and rendered via `{#each}` loop.

**Integration Approach:**

- Used Vite's `import.meta.glob` for static asset discovery, ensuring compatibility with static site generation.
- Maintained existing selector behavior by preserving translated labels for known datasets and providing fallback for new ones.

**Testing:**

- Added unit test for `getAvailableDatasets()` with mocked `import.meta.glob`.
- Updated page component test to verify dynamic options rendering.
- All tests pass, including regression tests.

**Agent Model Used:** GitHub Copilot

**Debug Log References:** None

**Completion Notes List:**

- Implemented dynamic JSON file listing using `import.meta.glob`.
- Updated component to generate options dynamically while maintaining current UI behavior.
- Added comprehensive tests for new functionality.
- Verified build and runtime functionality.

**File List:** 
- Modified: `src/lib/data.ts`, `src/routes/+page.svelte`, `tests/unit/data.test.js`, `tests/unit/routes/page.test.js`

**Change Log:** 
- Added `getAvailableDatasets` function for dynamic dataset discovery.
- Refactored dataset selector to use dynamic options array.
- Updated tests to cover new functionality and maintain existing assertions.