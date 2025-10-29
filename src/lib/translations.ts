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
    datasetInformation: 'Duomenų informacija:',
    words: 'Žodžiai',
    filterByType: 'Filtruoti pagal tipą:',
    clearFilters: 'Išvalyti filtrus',
    loadAll: 'Rodyti visus',
    
    // DownloadButton component
    downloadData: 'Atsisiųsti duomenis .csv formatu',
    
    // Main page
    pageTitle: 'Dažniausi lietuviški žodžiai',
    selectDataset: 'Pasirinkite duomenis',
    footerText: 'Turi pasiūlymų? Parašyk! ',
    footerEmail: 'labas@dago.lt',
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
