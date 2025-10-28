// Lithuanian translations for the application
export const translations = {
  lt: {
    // SearchBar component
    searchPlaceholder: 'Ieškoti žodžių...',
    clearSearch: 'Išvalyti paiešką',
    
    // DataTable component
    word: 'Žodis',
    type: 'Tipas',
    frequency: 'Dažnumas',
    
    // DataLoader component
    loading: 'Kraunamas duomenų rinkinys...',
    errorLoadingData: 'Klaida Kraunant Duomenis',
    author: 'Autorius',
    year: 'Metai',
    datasetInformation: 'Duomenų Rinkinio Informacija',
    words: 'Žodžiai',
    
    // DownloadButton component
    downloadData: 'Atsisiųsti duomenis .csv formatu',
    
    // Main page
    pageTitle: 'Dažniausi lietuviški žodžiai',
    description: 'Tyrinėkite lietuviškų žodžių dažnumo duomenis naudodami interaktyvią, kultūriškai įkvėptą sąsają.',
    selectDataset: 'Pasirinkite Duomenų Rinkinį',
    dataset1: 'Lietuvos Kalbos Institutas (2023)',
    dataset2: 'Vilniaus Universiteto Lingvistikos Departamentas (2024)',
  }
};

export function t(key: string): string {
  const keys = key.split('.');
  let value: any = translations.lt;
  
  for (const k of keys) {
    value = value[k];
    if (value === undefined) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }
  
  return value;
}
