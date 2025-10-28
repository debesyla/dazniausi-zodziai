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

- [ ] Design button placement in the UI
- [ ] Add button element to relevant component
- [ ] Style the button to match site theme

#### Technical Notes

- **Integration Approach:** Add button to filter area
- **Existing Pattern Reference:** Other buttons in the app
- **Key Constraints:** Maintain responsive design

#### Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable

#### Dev Agent Record

##### Agent Model Used

##### Debug Log References

##### Completion Notes List

##### File List

##### Change Log

##### Status
