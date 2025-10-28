# Story 5.1 Generate Second Example Word Data JSON

As a developer,  
I want to create a second example .json file with sample Lithuanian word frequency data,  
so that users have multiple datasets to explore and compare.  

### Acceptance Criteria
5.1.1: Second JSON file (e.g., sample-dataset-2.json) is created in the data/ directory with realistic metadata and word lists.  
5.1.2: Data includes author, year, and varied word frequencies to demonstrate diversity.  
5.1.3: File is validated for correct JSON structure and compatibility with existing loading logic.  

### Status
Ready for Review

### Dev Notes
**Previous Story Insights:** Build on existing data loading from Epic 1. Ensure new JSON matches the schema of sample-dataset.json.

**Data Models:** Reuse the word object structure: {word: string, type: string, frequency: number}.
