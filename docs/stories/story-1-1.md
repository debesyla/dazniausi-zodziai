#### Story Title

Remove Playwright Tests and Config - Brownfield Addition

#### User Story

As a developer,  
I want to remove all existing Playwright tests and configuration,  
So that I can start fresh with a Svelte-compatible testing framework.

#### Story Context

**Existing System Integration:**

- Integrates with: Testing setup
- Technology: Playwright, package.json
- Follows pattern: Removal of old tech
- Touch points: tests/e2e/, playwright.config.js, package.json

#### Acceptance Criteria

**Functional Requirements:**

1. All Playwright-related files are removed
2. package.json updated to remove Playwright dependencies
3. No references to Playwright remain

**Integration Requirements:**  
4. Existing functionality continues to work unchanged  
5. New functionality follows existing pattern (none)  
6. Integration with build system maintains current behavior

**Quality Requirements:**  
7. Change is covered by appropriate tests (none needed)  
8. Documentation is updated if needed  
9. No regression in existing functionality verified

#### Technical Notes

- **Integration Approach:** Remove files and dependencies
- **Existing Pattern Reference:** Standard cleanup
- **Key Constraints:** Ensure no breaking changes

#### Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable