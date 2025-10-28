# Testing Strategy

Define comprehensive testing approach for the frontend application.

## Testing Pyramid

```
E2E Tests
  |
Integration Tests
  |
Unit Tests
```

## Test Organization

### Frontend Tests

```
tests/
  unit/
    components/
      DataTable.test.js
    utils/
      filter.test.js
  integration/
    data-loading.test.js
```

### Backend Tests

N/A

### E2E Tests

```
tests/
  e2e/
    search.spec.js
    download.spec.js
```

## Test Examples

### Frontend Component Test

```typescript
import { render } from '@testing-library/svelte';
import DataTable from '../components/DataTable.svelte';

test('renders words', () => {
  const words = [{ word: 'labas', frequency: 10 }];
  const { getByText } = render(DataTable, { props: { words } });
  expect(getByText('labas')).toBeInTheDocument();
});
```

### Backend API Test

N/A

### E2E Test

TBD - Testing framework to be selected.
