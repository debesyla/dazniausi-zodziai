#### Story Title

Update Selector to Use Dynamic Datasets - Brownfield Addition

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

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable