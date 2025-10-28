#### Story Title

Implement Dynamic JSON File Retrieval - Brownfield Addition

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

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable