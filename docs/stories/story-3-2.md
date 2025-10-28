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

#### Technical Notes

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