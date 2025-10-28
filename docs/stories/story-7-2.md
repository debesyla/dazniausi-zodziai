#### Story Title

Implement Clear Filters Logic - Brownfield Addition

#### User Story

As a user,  
I want clicking the "Išvalyti filtrus" button to reset all filters,  
So that I can quickly return to the unfiltered view.

#### Story Context

**Existing System Integration:**

- Integrates with: Filter state management, data loading
- Technology: Svelte, JavaScript
- Follows pattern: Event handling and state reset
- Touch points: src/lib/, components with filters

#### Acceptance Criteria

**Functional Requirements:**

1. Clicking the button clears all active filters
2. Data view updates to show unfiltered results
3. Filter inputs reset to default values

**Integration Requirements:**  
4. Logic integrates with existing filter system without conflicts  
5. State management updates correctly  

**Quality Requirements:**  
6. Action is performant and doesn't cause delays  
7. Documentation is updated if needed  
8. No regression in filter functionality

#### Tasks

- [ ] Identify all filter states to reset
- [ ] Implement click handler for the button
- [ ] Reset filter states and trigger data reload

#### Technical Notes

- **Integration Approach:** Add event listener and state reset
- **Existing Pattern Reference:** Other reset or clear functions
- **Key Constraints:** Ensure data consistency

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
