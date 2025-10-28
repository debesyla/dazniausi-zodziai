#### Story Title

Implement Type Filtering Logic - Brownfield Addition

#### User Story

As a developer,  
I want to add filtering logic to update the displayed words based on selected types,  
So that the table shows only words matching the selected types.

#### Story Context

**Existing System Integration:**

- Integrates with: Data filtering, table display
- Technology: JavaScript, Svelte
- Follows pattern: Data filtering
- Touch points: Component with filter and table

#### Acceptance Criteria

**Functional Requirements:**

1. Filtering logic implemented
2. Table updates reactively based on selection
3. Multiple types can be selected

**Integration Requirements:**  
4. Existing functionality continues to work unchanged  
5. New functionality follows existing pattern (filtering)  
6. Integration with data loading maintains current behavior

**Quality Requirements:**  
7. Change is covered by appropriate tests  
8. Documentation is updated if needed  
9. No regression in existing functionality verified

#### Technical Notes

- **Integration Approach:** Reactive filtering in component
- **Existing Pattern Reference:** Svelte state management
- **Key Constraints:** Efficient filtering for performance

#### Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable