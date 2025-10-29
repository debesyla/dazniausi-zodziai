#### Story Title

Implement Load All Button for Datasets - Brownfield Addition

#### User Story

As a user,  
I want a "Rodyti visus" (Load all) button for long datasets that shows all items after clicking,  
So that I can view the full dataset when it exceeds the top 10 words.

#### Story Context

**Existing System Integration:**

- Integrates with: DataTable.svelte, data loading logic
- Technology: Svelte, JavaScript
- Follows pattern: Pagination or load more features
- Touch points: src/components/DataTable.svelte, lib/data.ts

#### Acceptance Criteria

**Functional Requirements:**

1. "Rodyti visus" button appears when dataset has more than 10 words
2. Clicking the button displays all dataset items in the table
3. Button is hidden or disabled after loading all

**Integration Requirements:**  
4. Table updates dynamically without page reload  
5. Existing filtering and sorting work with full dataset  

**Quality Requirements:**  
6. Performance is acceptable for large datasets  
7. UI indicates loading state if needed  
8. No data loss or errors

#### Tasks

- [ ] Implement logic to detect dataset size
- [ ] Add button to UI conditionally
- [ ] Handle click to load and display all data
- [ ] Update table rendering for full data
- [ ] Test with sample-dataset-2.json (60 items)

#### Technical Notes

- **Integration Approach:** Modify data display logic in components
- **Existing Pattern Reference:** Current data loading
- **Key Constraints:** Handle large data efficiently

#### Definition of Done