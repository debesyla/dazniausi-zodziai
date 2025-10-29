# UI and Functionality Enhancements - Brownfield Enhancement

## Epic Goal

Enhance the user interface and functionality of the application by improving test handling, UI layout, table columns, adding a footer, and implementing a load all feature for long datasets.

## Epic Description

**Existing System Context:**

- Current relevant functionality: The application displays word data in a table with filters and search, using JSON datasets.
- Technology stack: Svelte, CSS, JavaScript
- Integration points: Data loading, table rendering, filtering components.

**Enhancement Details:**

- What's being added/changed: Multiple UI and functional improvements including test dataset flexibility, filter button positioning, column reordering, footer addition, and load all button for datasets.
- How it integrates: Changes will be made to components like DataTable, SearchBar, and layout files.
- Success criteria: All features work as specified, UI is improved, and functionality is enhanced without breaking existing features.

## Stories

1. **Story 10-1:** Rewrite tests to work with any .json datasets or implement private testing JSONs that are excluded from public builds.
2. **Story 10-2:** Reposition search field and "išvalyti filtrus" button in the same div, place type filter below, and make clear filters button visible only when filters/search are active.
3. **Story 10-3:** Reorder table columns to place "dažnumas" (frequency) as the 2nd column and "type" as the 3rd.
4. **Story 10-4:** Add a footer with a paragraph inviting suggestions and providing an email contact.
5. **Story 10-5:** Implement "Rodyti visus" (Load all) button to display all dataset items when datasets exceed top 10 words.

## Compatibility Requirements

- [ ] Existing functionality remains intact
- [ ] UI changes do not disrupt layout on different screen sizes
- [ ] Performance is maintained for large datasets
- [ ] Tests pass with new dataset handling

## Risk Mitigation

- **Primary Risk:** Changes to UI layout may affect responsiveness.
- **Mitigation:** Test on multiple devices and screen sizes.
- **Rollback Plan:** Revert commits if issues arise.

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] UI enhancements are visually appealing and functional
- [ ] New features work correctly
- [ ] Documentation updated if needed
- [ ] No regression in existing functionality