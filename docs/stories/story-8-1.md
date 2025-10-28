#### Story Title

Modify Default Sort for Frequency Column - Brownfield Addition

#### User Story

As a user,  
I want the frequency column to sort descending by default on load,  
So that I see the most frequent words first without manual sorting.

#### Story Context

**Existing System Integration:**

- Integrates with: DataTable sorting logic
- Technology: Svelte, JavaScript
- Follows pattern: Default state configuration
- Touch points: src/components/DataTable.svelte, src/lib/

#### Acceptance Criteria

**Functional Requirements:**

1. On page load, data is sorted by frequency descending
2. Frequency column shows highest values first
3. Default sort is applied automatically

**Integration Requirements:**  
4. Change integrates with existing sorting mechanism  
5. Manual sorting still overrides default  

**Quality Requirements:**  
6. Sort is efficient and doesn't impact load time  
7. Documentation is updated if needed  
8. No regression in sorting for other columns

#### Tasks

- [ ] Locate the default sort configuration
- [ ] Set frequency column to descending by default
- [ ] Verify sort applies on load

#### Technical Notes

- **Integration Approach:** Modify initial sort state
- **Existing Pattern Reference:** Other default settings
- **Key Constraints:** Preserve user sort preferences if set

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
