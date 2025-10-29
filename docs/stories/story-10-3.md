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

- [x] Review current column order in DataTable
- [x] Modify column rendering order
- [x] Update headers accordingly
- [x] Test table functionality with new order

#### Dev Agent Record

**Debug Log**

- Reviewed DataTable.svelte, current order: word, type, frequency
- Modified to: word, frequency, type
- Added sorting for type column
- Updated tests accordingly

**Completion Notes**

- All changes implemented successfully
- Tests pass
- No linting errors

**Change Log**

- Modified src/components/DataTable.svelte: reordered columns, added type sorting
- Modified tests/unit/components/DataTable.test.js: updated expectations, added type sorting test

**File List**

- src/components/DataTable.svelte
- tests/unit/components/DataTable.test.js

**Agent Model Used**

- James (Dev)

#### Status

Ready for Review

#### Technical Notes

- **Integration Approach:** Adjust Svelte template for table headers and rows
- **Existing Pattern Reference:** Current table structure
- **Key Constraints:** Preserve data integrity and performance

#### Definition of Done