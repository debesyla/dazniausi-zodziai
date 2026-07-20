import { render } from '@testing-library/svelte/svelte5';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import FrequencyDashboard from '../../../src/components/FrequencyDashboard.svelte';

const words = Array.from({ length: 25 }, (_, index) => ({
  word: `žodis-${index + 1}`,
  type: index % 2 === 0 ? 'dkt' : 'jng',
  frequency: 100 - index
}));

it('renders frequency concentration metrics and source-labelled POS composition', () => {
  const { getByText, getAllByRole } = render(FrequencyDashboard, {
    words,
    typeLabels: { dkt: 'Daiktavardis', jng: 'Jungtukas' }
  });

  expect(getByText('Dažnumo vaizdas')).toBeInTheDocument();
  expect(getByText((_, element) => element?.tagName === 'DD' && element.textContent === 'žodis-1 (100)')).toBeInTheDocument();
  expect(getByText('Žodis · dažnumas · kalbos dalis')).toBeInTheDocument();
  expect(getByText('Kalbos dalių sudėtis')).toBeInTheDocument();
  expect(getAllByRole('img')).toHaveLength(4);
});

it('changes the top-word chart deterministically when its control changes', async () => {
  const user = userEvent.setup();
  const { getByLabelText, getByRole } = render(FrequencyDashboard, { words });
  const topChart = getByRole('img', { name: /Dažniausi žodžiai/ });

  expect(topChart).not.toHaveAccessibleName(/žodis-11/);
  await user.selectOptions(getByLabelText('Rodyti pirmus'), '20');

  expect(topChart).toHaveAccessibleName(/žodis-20/);
  expect(topChart).not.toHaveAccessibleName(/žodis-21/);
});

it('updates from the supplied active result set and omits POS composition when no POS values exist', async () => {
  const { getByText, queryByText, rerender } = render(FrequencyDashboard, { words });

  expect(getByText('Žodis · dažnumas · kalbos dalis')).toBeInTheDocument();
  await rerender({ words: [{ word: 'vienas', frequency: 7 }] });

  expect(getByText((_, element) => element?.tagName === 'DD' && element.textContent === 'vienas (7)')).toBeInTheDocument();
  expect(getByText('Žodis · dažnumas')).toBeInTheDocument();
  expect(queryByText('Kalbos dalių sudėtis')).not.toBeInTheDocument();
});
