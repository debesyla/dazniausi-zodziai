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
    entryKind: 'Duomenų vienetas',
    lemma: 'Lema',
    wordform: 'Žodžio forma',
    licence: 'Licencija',
    citation: 'Citata',
    source: 'Šaltinis',
    words: 'Žodžiai',
    filterByType: 'Filtruoti pagal tipą:',
    posScheme: 'Kalbos dalių žymėjimas',
    clearFilters: 'Išvalyti filtrus',
    updatingResults: 'Atnaujinami rezultatai…',
    noMatchingWords: 'Nėra žodžių, atitinkančių aktyvius filtrus.',
    showingResults: 'Rodomi {start}–{end} iš {total}',
    pagination: 'Rezultatų puslapiai',
    previousPage: 'Ankstesnis',
    nextPage: 'Kitas',
    pageOf: '{page} puslapis iš {total}',
    
    // DownloadButton component
    downloadData: 'Atsisiųsti duomenis .csv formatu',
    ascending: 'didėjančia tvarka',
    descending: 'mažėjančia tvarka',
    exported: 'Eksportuota',
    query: 'Paieška',
    all: 'visi',
    sortOrder: 'Rikiavimas',

    // Frequency dashboard
    frequencyDashboard: 'Dažnumo vaizdas',
    analysisForActiveFilters: 'Skaičiavimai atnaujinami pagal pasirinktą rinkinį ir aktyvius filtrus.',
    headlineMetrics: 'Pagrindiniai dažnumo rodikliai',
    entries: 'Įrašai',
    totalFrequency: 'Bendras dažnumas',
    mostFrequent: 'Dažniausias įrašas',
    availableDimensions: 'Turimi matmenys',
    wordAndFrequency: 'Žodis · dažnumas',
    wordFrequencyAndPos: 'Žodis · dažnumas · kalbos dalis',
    topWords: 'Dažniausi žodžiai',
    topWordsDescription: 'Didžiausio dažnumo įrašai tarp šiuo metu rodomų duomenų.',
    showTop: 'Rodyti pirmus',
    tableEquivalent: 'Duomenys lentelėje',
    rank: 'Rangas',
    rankFrequency: 'Rango ir dažnumo kreivė',
    rankFrequencyDescription: 'Abi ašys yra logaritminės, todėl matoma ir dažniausių, ir retų žodžių koncentracija.',
    rankFrequencyText: 'Iš {count} atrinktų įrašų pirmo rango dažnumas yra {first}, o paskutinio — {last}.',
    rankLogScale: 'Rangas (log skalė)',
    frequencyLogScale: 'Dažnumas (log skalė)',
    cumulativeCoverage: 'Sukaupta žetonų aprėptis',
    coverageDescription: 'Rodo, kokią viso dažnumo dalį sukaupia dažniausi žodžiai.',
    coverageText: 'Pirmi dešimt įrašų sudaro {topTen} atrinktų žetonų dažnumo.',
    cumulativeFrequency: 'Sukauptas dažnumas',
    tokenCoverage: 'Žetonų aprėptis',
    posComposition: 'Kalbos dalių sudėtis',
    posCompositionDescription: 'Žetonų dažnumo dalis pagal šaltinio pateiktas kalbos dalių žymas.',
    
    // Main page
    pageTitle: 'Dažniausi lietuviški žodžiai',
    selectDataset: 'Pasirinkite duomenis',
    loadingCatalog: 'Kraunamas duomenų katalogas...',
    errorLoadingCatalog: 'Klaida kraunant duomenų katalogą',
    noDatasets: 'Duomenų kataloge nėra rinkinių.',
    footerText: 'Turi pasiūlymų? Parašyk! ',
    footerEmail: 'labas@dago.lt',
  }
};

export function t(key: string, parameters: Record<string, string | number> = {}): string {
  const keys = key.split('.');
  let value: any = translations.lt;
  
  for (const k of keys) {
    value = value[k];
    if (value === undefined) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }
  
  return Object.entries(parameters).reduce((text, [name, parameter]) => {
    return text.replaceAll(`{${name}}`, String(parameter));
  }, value);
}
