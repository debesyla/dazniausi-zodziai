/** Loader for the bounded ALKSNIS syntax-context data product. */

import { base } from '$app/paths';

const PRODUCT_ID = 'rimkute-2019-alksnis-syntactic-context';
const productRoot = `${base}/data-products/${PRODUCT_ID}/`;

type JsonObject = Record<string, unknown>;
type Row = Record<string, string | number>;

interface Field {
  id: string;
  type: string;
}

interface ChunkDescriptor {
  file: string;
  records: number;
  selectionPrefixes?: string[];
}

interface ViewIndex {
  fields: Field[];
  chunks: ChunkDescriptor[];
  selection?: {
    type: 'lemma-prefix';
    field: string;
    codePoints: number;
  };
}

interface ViewDescriptor {
  id: string;
  index: string;
}

export interface SyntaxContextManifest {
  id: typeof PRODUCT_ID;
  title: string;
  provenance: {
    sourceUrl: string;
    licence: string;
    citation: string;
  };
  syntaxContext: {
    overview: {
      repositorySentenceClaim: number;
      deliveredSentenceIds: number;
      documents: number;
      integerTokenRows: number;
      nonPunctuationRows: number;
      allRelationLabels: number;
      nonPunctuationRelationLabels: number;
      rootRows: number;
      nonPunctuationRootRows: number;
      nonRootDependencyRows: number;
    };
    exclusions: string[];
    exampleSelection: {
      maxExamplesPerLemma: number;
      order: string;
      omittedRows: number;
    };
    lookup: {
      lemmaIndexView: string;
      lemmaIndexPrefixCodePoints: number;
      contextView: string;
      contextPrefixCodePoints: number;
      directions: Array<'dependent' | 'head' | 'root'>;
    };
  };
  views: ViewDescriptor[];
}

export interface SyntaxRelation {
  relation: string;
  count: number;
}

export interface SyntaxGenre {
  genreId: string;
  genre: string;
  documents: number;
  sentences: number;
  integerTokenRows: number;
  nonPunctuationRows: number;
  relationshipRows: number;
}

export interface SyntaxLemma {
  lemma: string;
  tokenCount: number;
  headEdgeCount: number;
  dependentEdgeCount: number;
  rootEdgeCount: number;
}

export interface SyntaxContextExample {
  lemma: string;
  direction: 'dependent' | 'head' | 'root';
  relation: string;
  dependentLemma: string;
  dependentForm: string;
  headLemma: string;
  headForm: string;
  genreId: string;
  genre: string;
  document: string;
  sourceSentenceId: string;
  sentenceText: string;
}

export interface SyntaxOverviewData {
  manifest: SyntaxContextManifest;
  relations: SyntaxRelation[];
  genres: SyntaxGenre[];
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function httpUrl(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function safeRelativePath(value: unknown): value is string {
  if (!nonEmptyString(value) || value.startsWith('/') || value.includes('://') || value.includes('\\') || value.includes('?') || value.includes('#')) {
    return false;
  }
  try {
    const decoded = decodeURIComponent(value);
    return !decoded.startsWith('/') && !decoded.includes('\\') && !decoded.split('/').includes('..');
  } catch {
    return false;
  }
}

function prefixFor(value: string, codePoints: number): string {
  return Array.from(value.toLocaleLowerCase('lt')).slice(0, codePoints).join('') || '_';
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nepavyko įkelti duomenų (${response.status}).`);
  return response.json();
}

function productUrl(relativePath: string): string {
  if (!safeRelativePath(relativePath)) throw new Error('Nesaugus duomenų produkto kelias.');
  return `${productRoot}${relativePath}`;
}

function viewUrl(indexPath: string, chunkPath: string): string {
  if (!safeRelativePath(indexPath) || !safeRelativePath(chunkPath)) throw new Error('Nesaugus duomenų vaizdo kelias.');
  const indexDirectory = indexPath.slice(0, indexPath.lastIndexOf('/') + 1);
  return productUrl(`${indexDirectory}${chunkPath}`);
}

function requireOverview(value: unknown): SyntaxContextManifest['syntaxContext']['overview'] {
  if (!isObject(value)) throw new Error('Netinkama sintaksės produkto santrauka.');
  const fields = [
    'repositorySentenceClaim', 'deliveredSentenceIds', 'documents', 'integerTokenRows',
    'nonPunctuationRows', 'allRelationLabels', 'nonPunctuationRelationLabels', 'rootRows',
    'nonPunctuationRootRows', 'nonRootDependencyRows'
  ] as const;
  if (fields.some((field) => !nonNegativeInteger(value[field]))) throw new Error('Netinkama sintaksės produkto santrauka.');
  return value as SyntaxContextManifest['syntaxContext']['overview'];
}

function validateManifest(value: unknown): SyntaxContextManifest {
  if (!isObject(value) || value.id !== PRODUCT_ID || !nonEmptyString(value.title) || value.productType !== 'chunked-syntactic-context'
    || !isObject(value.provenance) || !httpUrl(value.provenance.sourceUrl) || !nonEmptyString(value.provenance.licence)
    || !nonEmptyString(value.provenance.citation) || !isObject(value.syntaxContext) || !Array.isArray(value.views)) {
    throw new Error('Netinkamas ALKSNIS sintaksės produkto manifestas.');
  }
  const syntaxContext = value.syntaxContext;
  if (!Array.isArray(syntaxContext.exclusions) || syntaxContext.exclusions.some((item) => !nonEmptyString(item))
    || !isObject(syntaxContext.exampleSelection) || !isObject(syntaxContext.lookup)) {
    throw new Error('Netinkama ALKSNIS sintaksės produkto konfigūracija.');
  }
  const selection = syntaxContext.exampleSelection;
  const lookup = syntaxContext.lookup;
  if (!nonNegativeInteger(selection.maxExamplesPerLemma) || selection.maxExamplesPerLemma < 1
    || !nonEmptyString(selection.order) || !nonNegativeInteger(selection.omittedRows)
    || !nonEmptyString(lookup.lemmaIndexView) || !nonEmptyString(lookup.contextView)
    || !nonNegativeInteger(lookup.lemmaIndexPrefixCodePoints) || lookup.lemmaIndexPrefixCodePoints < 1 || lookup.lemmaIndexPrefixCodePoints > 3
    || !nonNegativeInteger(lookup.contextPrefixCodePoints) || lookup.contextPrefixCodePoints < lookup.lemmaIndexPrefixCodePoints || lookup.contextPrefixCodePoints > 3
    || !Array.isArray(lookup.directions) || lookup.directions.some((direction) => !['dependent', 'head', 'root'].includes(direction as string))) {
    throw new Error('Netinkama ALKSNIS paieškos konfigūracija.');
  }
  const views = value.views.map((view) => {
    if (!isObject(view) || !nonEmptyString(view.id) || !safeRelativePath(view.index)) {
      throw new Error('Netinkamas ALKSNIS duomenų vaizdas.');
    }
    return { id: view.id, index: view.index };
  });
  if (!views.some((view) => view.id === lookup.lemmaIndexView) || !views.some((view) => view.id === lookup.contextView)) {
    throw new Error('ALKSNIS paieškos vaizdai nerasti.');
  }
  return {
    id: PRODUCT_ID,
    title: value.title,
    provenance: value.provenance as SyntaxContextManifest['provenance'],
    syntaxContext: {
      overview: requireOverview(syntaxContext.overview),
      exclusions: syntaxContext.exclusions as string[],
      exampleSelection: selection as SyntaxContextManifest['syntaxContext']['exampleSelection'],
      lookup: lookup as SyntaxContextManifest['syntaxContext']['lookup']
    },
    views
  };
}

function validateIndex(value: unknown): ViewIndex {
  if (!isObject(value) || value.recordEncoding !== 'array' || !Array.isArray(value.fields) || !Array.isArray(value.chunks)) {
    throw new Error('Netinkamas ALKSNIS duomenų vaizdo indeksas.');
  }
  const fields = value.fields.map((field) => {
    if (!isObject(field) || !nonEmptyString(field.id) || !nonEmptyString(field.type)) {
      throw new Error('Netinkami ALKSNIS duomenų vaizdo laukai.');
    }
    return { id: field.id, type: field.type };
  });
  const selection = value.selection;
  if (selection !== undefined && (!isObject(selection) || selection.type !== 'lemma-prefix'
    || !nonEmptyString(selection.field) || !nonNegativeInteger(selection.codePoints) || selection.codePoints < 1
    || !fields.some((field) => field.id === selection.field && field.type === 'string'))) {
    throw new Error('Netinkama ALKSNIS vaizdo prefikso paieška.');
  }
  const chunks = value.chunks.map((chunk) => {
    if (!isObject(chunk) || !safeRelativePath(chunk.file) || !nonNegativeInteger(chunk.records) || chunk.records < 1
      || (selection !== undefined && (!Array.isArray(chunk.selectionPrefixes) || chunk.selectionPrefixes.length === 0
        || chunk.selectionPrefixes.some((prefix) => !nonEmptyString(prefix))
        || new Set(chunk.selectionPrefixes).size !== chunk.selectionPrefixes.length))) {
      throw new Error('Netinkamas ALKSNIS duomenų gabalas.');
    }
    return {
      file: chunk.file,
      records: chunk.records,
      ...(selection === undefined ? {} : { selectionPrefixes: chunk.selectionPrefixes as string[] })
    };
  });
  return {
    fields,
    chunks,
    ...(selection === undefined ? {} : { selection: selection as ViewIndex['selection'] })
  };
}

function rowsFromChunk(value: unknown, index: ViewIndex): Row[] {
  if (!isObject(value) || !Array.isArray(value.records)) throw new Error('Netinkamas ALKSNIS duomenų gabalo turinys.');
  return value.records.map((record) => {
    if (!Array.isArray(record) || record.length !== index.fields.length) throw new Error('Netinkamas ALKSNIS duomenų įrašas.');
    const row: Row = {};
    for (const [position, field] of index.fields.entries()) {
      const entry = record[position];
      if ((field.type === 'string' && !nonEmptyString(entry)) || (field.type !== 'string' && !nonNegativeInteger(entry))) {
        throw new Error('Netinkama ALKSNIS duomenų įrašo reikšmė.');
      }
      row[field.id] = entry as string | number;
    }
    return row;
  });
}

async function loadViewIndex(manifest: SyntaxContextManifest, viewId: string): Promise<{ descriptor: ViewDescriptor; index: ViewIndex }> {
  const descriptor = manifest.views.find((view) => view.id === viewId);
  if (!descriptor) throw new Error('ALKSNIS duomenų vaizdas nerastas.');
  return { descriptor, index: validateIndex(await fetchJson(productUrl(descriptor.index))) };
}

async function loadRows(manifest: SyntaxContextManifest, viewId: string, selectionPrefix?: string): Promise<Row[]> {
  const { descriptor, index } = await loadViewIndex(manifest, viewId);
  if (selectionPrefix !== undefined && index.selection === undefined) throw new Error('Šis ALKSNIS vaizdas nepalaiko prefikso paieškos.');
  const chunks = selectionPrefix === undefined ? index.chunks : index.chunks.filter((chunk) => chunk.selectionPrefixes?.includes(selectionPrefix));
  const loaded = await Promise.all(chunks.map(async (chunk) => rowsFromChunk(await fetchJson(viewUrl(descriptor.index, chunk.file)), index)));
  return loaded.flat();
}

function asString(row: Row, field: string): string {
  const value = row[field];
  if (!nonEmptyString(value)) throw new Error(`ALKSNIS laukas ${field} netinkamas.`);
  return value;
}

function asCount(row: Row, field: string): number {
  const value = row[field];
  if (!nonNegativeInteger(value)) throw new Error(`ALKSNIS skaitinis laukas ${field} netinkamas.`);
  return value;
}

function asDirection(row: Row): SyntaxContextExample['direction'] {
  const value = asString(row, 'direction');
  if (!['dependent', 'head', 'root'].includes(value)) throw new Error('ALKSNIS vaidmens laukas netinkamas.');
  return value as SyntaxContextExample['direction'];
}

export async function loadSyntaxOverview(): Promise<SyntaxOverviewData> {
  const manifest = validateManifest(await fetchJson(productUrl('manifest.json')));
  const [relationRows, genreRows] = await Promise.all([
    loadRows(manifest, 'relations-by-frequency'),
    loadRows(manifest, 'genres-by-source-order')
  ]);
  return {
    manifest,
    relations: relationRows.map((row) => ({ relation: asString(row, 'relation'), count: asCount(row, 'count') })),
    genres: genreRows.map((row) => ({
      genreId: asString(row, 'genreId'), genre: asString(row, 'genre'),
      documents: asCount(row, 'documents'), sentences: asCount(row, 'sentences'),
      integerTokenRows: asCount(row, 'integerTokenRows'), nonPunctuationRows: asCount(row, 'nonPunctuationRows'),
      relationshipRows: asCount(row, 'relationshipRows')
    }))
  };
}

export async function searchSyntaxLemmas(manifest: SyntaxContextManifest, query: string, limit = 50): Promise<{ matches: SyntaxLemma[]; total: number }> {
  const normalizedQuery = query.trim().toLocaleLowerCase('lt');
  if (!normalizedQuery) return { matches: [], total: 0 };
  const prefix = prefixFor(normalizedQuery, manifest.syntaxContext.lookup.lemmaIndexPrefixCodePoints);
  const rows = await loadRows(manifest, manifest.syntaxContext.lookup.lemmaIndexView, prefix);
  const matches = rows
    .map((row) => ({
      lemma: asString(row, 'lemma'), tokenCount: asCount(row, 'tokenCount'),
      headEdgeCount: asCount(row, 'headEdgeCount'), dependentEdgeCount: asCount(row, 'dependentEdgeCount'),
      rootEdgeCount: asCount(row, 'rootEdgeCount')
    }))
    .filter((lemma) => lemma.lemma.toLocaleLowerCase('lt').startsWith(normalizedQuery));
  return { matches: matches.slice(0, limit), total: matches.length };
}

export async function loadSyntaxContexts(manifest: SyntaxContextManifest, lemma: string): Promise<SyntaxContextExample[]> {
  const prefix = prefixFor(lemma, manifest.syntaxContext.lookup.contextPrefixCodePoints);
  const rows = await loadRows(manifest, manifest.syntaxContext.lookup.contextView, prefix);
  return rows
    .map((row) => ({
      lemma: asString(row, 'lemma'), direction: asDirection(row),
      relation: asString(row, 'relation'), dependentLemma: asString(row, 'dependentLemma'),
      dependentForm: asString(row, 'dependentForm'), headLemma: asString(row, 'headLemma'),
      headForm: asString(row, 'headForm'), genreId: asString(row, 'genreId'), genre: asString(row, 'genre'),
      document: asString(row, 'document'), sourceSentenceId: asString(row, 'sourceSentenceId'),
      sentenceText: asString(row, 'sentenceText')
    }))
    .filter((context) => context.lemma === lemma);
}
