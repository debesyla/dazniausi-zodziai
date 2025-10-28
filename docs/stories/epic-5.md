# Epic 5 Multi-Dataset Support
Expand the application's data capabilities by generating a second example word data .json file and implementing a user-friendly data source switcher. This epic enhances user engagement by allowing comparison and exploration of multiple datasets, supporting the post-MVP goal of improved data interaction.

## Story 5.1 Generate Second Example Word Data JSON
As a developer,  
I want to create a second example .json file with sample Lithuanian word frequency data,  
so that users have multiple datasets to explore and compare.  

### Acceptance Criteria
5.1.1: Second JSON file (e.g., sample-dataset-2.json) is created in the data/ directory with realistic metadata and word lists.  
5.1.2: Data includes author, year, and varied word frequencies to demonstrate diversity.  
5.1.3: File is validated for correct JSON structure and compatibility with existing loading logic.  

## Story 5.2 Implement Data Source Switcher
As a user,  
I want to switch between available datasets via a UI control,  
so that I can easily compare and explore different word frequency data.  

### Acceptance Criteria
5.2.1: Dropdown or selector UI element added to the interface for dataset selection.  
5.2.2: Switching updates the displayed table, search, and download functionality dynamically.  
5.2.3: Maintains performance and responsiveness with dataset changes.  
5.2.4: Default to original dataset on load.  
