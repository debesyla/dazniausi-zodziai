#### Story Title

Improve Test Dataset Handling - Brownfield Enhancement

#### User Story

As a developer,  
I want tests that work with any .json datasets or have private testing JSONs excluded from public builds,  
So that testing is flexible and test data is not exposed in production.

#### Story Context

**Existing System Integration:**

- Integrates with: Test files in tests/unit/, data loading in lib/data.ts
- Technology: JavaScript, JSON
- Follows pattern: Unit testing with sample datasets
- Touch points: tests/, src/data/, build process

#### Acceptance Criteria

**Functional Requirements:**

1. Tests can load and validate data from any valid .json dataset structure
2. Private test JSONs are created if needed and excluded from public builds
3. Test coverage includes edge cases for different dataset sizes and structures

**Integration Requirements:**  
4. Changes do not break existing test functionality  
5. Build process excludes private test data from published artifacts  

**Quality Requirements:**  
6. Tests pass reliably with various datasets  
7. Documentation updated for test data handling  
8. No impact on production data loading

#### Tasks

- [ ] Analyze current test structure and dataset dependencies
- [ ] Decide on approach: flexible tests or private JSONs
- [ ] Implement chosen solution
- [ ] Update build configuration to exclude private data
- [ ] Run tests to ensure they work with multiple datasets

#### Technical Notes

- **Integration Approach:** Modify test setup and data loading
- **Existing Pattern Reference:** Current sample-dataset.json usage
- **Key Constraints:** Maintain test integrity and build security

#### Definition of Done