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
  const { getByText, getAllByText, getAllByRole } = render(FrequencyDashboard, {
    words,
    typeLabels: { dkt: 'Daiktavardis', jng: 'Jungtukas' }
  });

  expect(getByText('Dažnumo vaizdas')).toBeInTheDocument();
  expect(getByText('Ką atskleidžia šis sąrašas')).toBeInTheDocument();
  expect(getByText('Faktai apskaičiuoti tik iš pasirinkto šaltinio ir aktyvius filtrus atitinkančių įrašų.')).toBeInTheDocument();
  expect(getByText((_, element) => element?.tagName === 'DD' && element.textContent === 'žodis-1 (100)')).toBeInTheDocument();
  expect(getByText('Žodis · dažnumas · kalbos dalis')).toBeInTheDocument();
  expect(getByText('Kalbos dalių sudėtis')).toBeInTheDocument();
  const posBar = getAllByText('Jungtukas (jng)')[0].closest('.bar-row')?.querySelector('.bar-fill');
  expect(posBar).toHaveStyle({ width: '48%' });
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

it('updates facts from the supplied active result set and omits POS composition when no POS values exist', async () => {
  const { container, getByText, queryByText, rerender } = render(FrequencyDashboard, { words });

  expect(getByText('Žodis · dažnumas · kalbos dalis')).toBeInTheDocument();
  expect(container.querySelector('.fact-grid')).toHaveTextContent('žodis-1');
  await rerender({ words: [{ word: 'vienas', frequency: 7 }] });

  expect(getByText((_, element) => element?.tagName === 'DD' && element.textContent === 'vienas (7)')).toBeInTheDocument();
  expect(container.querySelector('.fact-grid')).toHaveTextContent('„vienas“ sukaupia 100 %');
  expect(container.querySelector('.fact-grid')).toHaveTextContent('Dažniausių įrašų skaičius, reikalingas 90 % žetonų aprėpčiai: 1');
  expect(container.querySelector('.fact-grid')).toHaveTextContent('Tokių įrašų skaičius: 0');
  expect(getByText('Žodis · dažnumas')).toBeInTheDocument();
  expect(queryByText('Kalbos dalių sudėtis')).not.toBeInTheDocument();
});
