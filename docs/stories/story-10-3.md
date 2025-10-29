#### Story Title

Reorder Table Columns - Brownfield Enhancement

#### User Story

As a user,  
I want the "dažnumas" (frequency) column as the 2nd column and "type" as the 3rd,  
So that the table presents information in a more logical order.

#### Story Context

**Existing System Integration:**

- Integrates with: DataTable.svelte, data rendering
- Technology: Svelte, JavaScript
- Follows pattern: Table column adjustments
- Touch points: src/components/DataTable.svelte

#### Acceptance Criteria

**Functional Requirements:**

1. Table columns are reordered: word, frequency, type, (others)
2. Data displays correctly in new column order
3. Column headers match the new order

**Integration Requirements:**  
4. Table sorting and filtering still work with new order  
5. Responsive design accommodates column changes  

**Quality Requirements:**  
6. UI is clean and columns align properly  
7. No data display errors  
8. Documentation updated if needed

#### Tasks

- [ ] Review current column order in DataTable
- [ ] Modify column rendering order
- [ ] Update headers accordingly
- [ ] Test table functionality with new order

#### Technical Notes

- **Integration Approach:** Adjust Svelte template for table headers and rows
- **Existing Pattern Reference:** Current table structure
- **Key Constraints:** Preserve data integrity and performance

#### Definition of Done