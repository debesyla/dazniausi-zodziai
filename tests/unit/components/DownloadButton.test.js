import { render } from '@testing-library/svelte/svelte5';
import { vi } from 'vitest';
import DownloadButton from '../../../src/components/DownloadButton.svelte';

// Mock papaparse
// vi.mock('papaparse', () => ({
//   default: {
//     unparse: vi.fn(() => 'mock,csv,data')
//   }
// }));

// Mock translations
vi.mock('../../../src/lib/translations', () => ({
  t: vi.fn((key) => key) // Return key as is for simplicity
}));

// Mock URL and document for download
const mockCreateObjectURL = vi.fn(() => 'mock-url');
const mockRevokeObjectURL = vi.fn();
const mockClick = vi.fn();

global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// document.createElement = vi.fn(() => ({
//   href: '',
//   download: '',
//   click: mockClick
// }));

describe('DownloadButton', () => {
  const mockWords = [
    { word: 'test', type: 'noun', frequency: 10 }
  ];
  const mockMetadata = { author: 'Test Author', year: 2023 };

  it('renders download button', () => {
    const { getByRole } = render(DownloadButton, { 
      words: mockWords, 
      metadata: mockMetadata 
    });

    const button = getByRole('button');
    expect(button).toHaveTextContent('downloadData');
  });

  // it('triggers download on click', async () => {
  //   const { getByRole, userEvent } = render(DownloadButton, { 
  //     words: mockWords, 
  //     metadata: mockMetadata 
  //   });

  //   const button = getByRole('button');
  //   await userEvent.click(button);

  //   expect(mockCreateObjectURL).toHaveBeenCalled();
  //   expect(mockClick).toHaveBeenCalled();
  //   expect(mockRevokeObjectURL).toHaveBeenCalled();
  // });
});