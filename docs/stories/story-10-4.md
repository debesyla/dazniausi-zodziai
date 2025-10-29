#### Story Title

Add Footer with Contact Information - Brownfield Addition

#### User Story

As a user,  
I want a footer with a paragraph inviting suggestions and providing an email contact,  
So that I can provide feedback or suggestions easily.

#### Story Context

**Existing System Integration:**

- Integrates with: Main layout, +layout.svelte
- Technology: Svelte, CSS
- Follows pattern: Footer additions
- Touch points: src/routes/+layout.svelte, app.css

#### Acceptance Criteria

**Functional Requirements:**

1. Footer is added at the bottom of the page
2. Footer contains the specified paragraph: "Turi pasiūlymų? Parašyk! pavyzdys@email.com"
3. Footer styling matches the site's design

**Integration Requirements:**  
4. Footer does not interfere with existing content  
5. Responsive on different screen sizes  

**Quality Requirements:**  
6. Footer is accessible and readable  
7. Email is clickable if possible  
8. No impact on page load performance

#### Tasks

- [x] Design footer layout and content
- [x] Add footer element to layout
- [x] Style the footer appropriately
- [x] Test footer display and responsiveness

#### Dev Agent Record

##### Agent Model Used
GitHub Copilot

##### Debug Log References

##### Completion Notes List
- Footer added to +layout.svelte with specified text and mailto link.
- Styled with center alignment and top margin.
- Tests pass, dev server runs without errors.

##### File List
- Modified: src/routes/+layout.svelte
- Modified: src/app.css

##### Change Log
- Added footer element with contact information to the main layout.
- Styled footer to match site design with center text and spacing.

#### Status
Ready for Review

- **Integration Approach:** Update +layout.svelte
- **Existing Pattern Reference:** Site's overall styling
- **Key Constraints:** Maintain clean design and performance

#### Definition of Done