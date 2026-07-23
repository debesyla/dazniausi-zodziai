/** Load the small, manifest-led public-data catalog without loading data rows. */

import { base } from '$app/paths';

export type DataProductType =
  | 'generic-frequency-dataset'
  | 'chunked-wordform-list'
  | 'chunked-frequency-list'
  | 'chunked-derived-frequency-list'
  | 'chunked-lexical-collection'
  | 'chunked-comparison'
  | 'metadata-only';

interface DataProductCatalogEntry {
  id: string;
  title: string;
  productType: DataProductType;
  publicationStatus: 'published' | 'metadata-only';
  manifest: string;
  licence: string;
  viewCount: number;
  recordCount: number | null;
}

interface DataProductCatalog {
  schemaVersion: number;
  title: string;
  products: DataProductCatalogEntry[];
}

interface Publication {
  status: 'published' | 'metadata-only';
  scope: string;
  access: string;
  reason?: string;
}

interface Provenance {
  sourceUrl: string;
  licence: string;
  citation: string;
}

interface ProductContent {
  entryKind?: 'lemma' | 'wordform';
}

interface ProductView {
  id: string;
  title: string;
}

export interface PublicDataProduct {
  id: string;
  title: string;
  productType: DataProductType;
  publication: Publication;
  provenance: Provenance;
  content?: ProductContent;
  views: ProductView[];
  viewCount: number;
  manifestUrl: string;
}

const dataProductsRoot = `${base}/data-products/`;
const PRODUCT_TYPES = new Set<DataProductType>([
  'generic-frequency-dataset',
  'chunked-wordform-list',
  'chunked-frequency-list',
  'chunked-derived-frequency-list',
  'chunked-lexical-collection',
  'chunked-comparison',
  'metadata-only'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isSafeRelativePath(value: unknown): value is string {
  if (!isNonEmptyString(value) || value.startsWith('/') || value.includes('://') || value.includes('\\') || value.includes('?') || value.includes('#')) {
    return false;
  }
  try {
    const decoded = decodeURIComponent(value);
    return !decoded.startsWith('/') && !decoded.includes('\\') && !decoded.split('/').includes('..');
  } catch {
    return false;
  }
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isPublicationStatus(value: unknown): value is Publication['status'] {
  return value === 'published' || value === 'metadata-only';
}

function isProductType(value: unknown): value is DataProductType {
  return typeof value === 'string' && PRODUCT_TYPES.has(value as DataProductType);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNullableNonNegativeSafeInteger(value: unknown): value is number | null {
  return value === null || isNonNegativeSafeInteger(value);
}

function fail(message: string): never {
  throw new Error(`Invalid public data catalog: ${message}`);
}

function validateCatalogEntry(value: unknown): DataProductCatalogEntry {
  if (!isRecord(value) || !isSafeId(value.id) || !isNonEmptyString(value.title) || !isProductType(value.productType)
    || !isPublicationStatus(value.publicationStatus) || !isSafeRelativePath(value.manifest)
    || !isNonEmptyString(value.licence) || !isNonNegativeSafeInteger(value.viewCount)
    || !isNullableNonNegativeSafeInteger(value.recordCount)) {
    fail('an entry is malformed');
  }
  return {
    id: value.id,
    title: value.title,
    productType: value.productType,
    publicationStatus: value.publicationStatus,
    manifest: value.manifest,
    licence: value.licence,
    viewCount: value.viewCount,
    recordCount: value.recordCount
  };
}

function validateCatalog(value: unknown): DataProductCatalog {
  if (!isRecord(value) || !isNonNegativeSafeInteger(value.schemaVersion) || value.schemaVersion < 1
    || !isNonEmptyString(value.title) || !Array.isArray(value.products)) {
    fail('the product catalog is malformed');
  }
  const products = value.products.map(validateCatalogEntry);
  if (new Set(products.map((product) => product.id)).size !== products.length) fail('product IDs must be unique');
  return { schemaVersion: value.schemaVersion, title: value.title, products };
}

function validateManifest(value: unknown, catalogEntry: DataProductCatalogEntry, manifestUrl: string): PublicDataProduct {
  if (!isRecord(value) || !isNonNegativeSafeInteger(value.schemaVersion) || value.schemaVersion < 1
    || value.id !== catalogEntry.id || !isNonEmptyString(value.title) || value.productType !== catalogEntry.productType
    || !isRecord(value.publication) || !isPublicationStatus(value.publication.status)
    || !isNonEmptyString(value.publication.scope) || !isNonEmptyString(value.publication.access)
    || !isRecord(value.provenance) || !isHttpUrl(value.provenance.sourceUrl)
    || !isNonEmptyString(value.provenance.licence) || !isNonEmptyString(value.provenance.citation)) {
    fail(`the manifest for ${catalogEntry.id} is malformed`);
  }
  if (value.publication.status !== catalogEntry.publicationStatus) fail(`the manifest status for ${catalogEntry.id} does not match the catalog`);

  const publicationRecord = value.publication;
  const provenanceRecord = value.provenance;
  const publication: Publication = {
    status: publicationRecord.status as Publication['status'],
    scope: publicationRecord.scope as string,
    access: publicationRecord.access as string
  };
  const provenance: Provenance = {
    sourceUrl: provenanceRecord.sourceUrl as string,
    licence: provenanceRecord.licence as string,
    citation: provenanceRecord.citation as string
  };

  let content: ProductContent | undefined;
  if (value.content !== undefined) {
    if (!isRecord(value.content) || (value.content.entryKind !== undefined && value.content.entryKind !== 'lemma' && value.content.entryKind !== 'wordform')) {
      fail(`the content metadata for ${catalogEntry.id} is malformed`);
    }
    content = value.content.entryKind === undefined ? {} : { entryKind: value.content.entryKind };
  }
  if (catalogEntry.productType === 'generic-frequency-dataset' && content?.entryKind === undefined) {
    fail(`the generic dataset metadata for ${catalogEntry.id} is malformed`);
  }

  let views: ProductView[] = [];
  if (value.views !== undefined) {
    if (!Array.isArray(value.views) || value.views.some((view) => !isRecord(view) || !isSafeId(view.id) || !isNonEmptyString(view.title))) {
      fail(`the views for ${catalogEntry.id} are malformed`);
    }
    views = value.views.map((view) => ({ id: view.id as string, title: view.title as string }));
  }
  const implicitGenericView = catalogEntry.productType === 'generic-frequency-dataset'
    && value.views === undefined && catalogEntry.viewCount === 1;
  if (!implicitGenericView && views.length !== catalogEntry.viewCount) fail(`the view count for ${catalogEntry.id} does not match the catalog`);

  return {
    id: catalogEntry.id,
    title: value.title,
    productType: catalogEntry.productType,
    publication,
    provenance,
    content,
    views,
    viewCount: catalogEntry.viewCount,
    manifestUrl
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

/**
 * Returns public source facts for every collection from compact manifests only.
 * It deliberately never downloads a word-list or a data chunk.
 */
export async function loadPublicDataProducts(): Promise<PublicDataProduct[]> {
  const catalog = validateCatalog(await fetchJson(`${dataProductsRoot}catalog.json`));
  return Promise.all(catalog.products.map(async (entry) => {
    const manifestUrl = `${dataProductsRoot}${entry.manifest}`;
    return validateManifest(await fetchJson(manifestUrl), entry, manifestUrl);
  }));
}
