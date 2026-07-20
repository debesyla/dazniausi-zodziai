<script lang="ts">
  import { analyseFrequency, sampleByRank } from '$lib/analysis';
  import { t } from '$lib/translations';
  import type { Word } from '$lib/data';

  const chartWidth = 640;
  const chartHeight = 250;
  const chartLeft = 56;
  const chartRight = 18;
  const chartTop = 18;
  const chartBottom = 38;
  const chartInnerWidth = chartWidth - chartLeft - chartRight;
  const chartInnerHeight = chartHeight - chartTop - chartBottom;
  const topNOptions = [10, 20, 50];

  let { words, typeLabels = {} }: { words: Word[]; typeLabels?: Record<string, string> } = $props();
  let topN = $state(10);
  let analysis = $derived(analyseFrequency(words));
  let topWords = $derived(analysis.rankedWords.slice(0, topN));
  let rankFrequencySeries = $derived(sampleByRank(analysis.rankedWords));
  let coverageSeries = $derived(sampleByRank(analysis.coverage));
  let maximumFrequency = $derived(analysis.topWord?.frequency ?? 1);
  let minimumFrequency = $derived(analysis.rankedWords[analysis.rankedWords.length - 1]?.frequency ?? 1);
  let maximumRank = $derived(analysis.rankedWords[analysis.rankedWords.length - 1]?.rank ?? 1);
  let rankFrequencyPath = $derived(linePath(rankFrequencySeries, (point) => logRankX(point.rank), (point) => logFrequencyY(point.frequency)));
  let coveragePath = $derived(linePath(coverageSeries, (point) => logRankX(point.rank), (point) => coverageY(point.coverage)));
  let rankTicks = $derived(logTicks(maximumRank));
  let frequencyTicks = $derived(logTicks(maximumFrequency, minimumFrequency));
  let coverageTicks = [0, 0.25, 0.5, 0.75, 1];

  function formatNumber(value: number) {
    return value.toLocaleString('lt-LT');
  }

  function formatPercent(value: number) {
    return new Intl.NumberFormat('lt-LT', { style: 'percent', maximumFractionDigits: 1 }).format(value);
  }

  function displayType(type: string) {
    return typeLabels[type] ? `${typeLabels[type]} (${type})` : type;
  }

  function logRankX(rank: number) {
    if (maximumRank <= 1) return chartLeft + chartInnerWidth / 2;
    return chartLeft + (Math.log10(rank) / Math.log10(maximumRank)) * chartInnerWidth;
  }

  function logFrequencyY(frequency: number) {
    if (maximumFrequency === minimumFrequency) return chartTop + chartInnerHeight / 2;
    const range = Math.log10(maximumFrequency) - Math.log10(minimumFrequency);
    return chartTop + ((Math.log10(maximumFrequency) - Math.log10(frequency)) / range) * chartInnerHeight;
  }

  function coverageY(coverage: number) {
    return chartTop + (1 - coverage) * chartInnerHeight;
  }

  function linePath<T>(points: T[], x: (point: T) => number, y: (point: T) => number) {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point).toFixed(2)},${y(point).toFixed(2)}`).join(' ');
  }

  function logTicks(maximum: number, minimum = 1) {
    if (maximum <= 1) return [1];
    if (maximum === minimum) return [maximum];
    const start = Math.floor(Math.log10(Math.max(1, minimum)));
    const end = Math.ceil(Math.log10(maximum));
    const ticks = Array.from({ length: end - start + 1 }, (_, index) => 10 ** (start + index)).filter((tick) => tick >= minimum && tick <= maximum);
    return ticks.length > 0 ? ticks : [minimum, maximum];
  }

  function barWidth(frequency: number) {
    return `${(frequency / maximumFrequency) * 100}%`;
  }

  function percentWidth(value: number) {
    return `${value * 100}%`;
  }

  function selectTopN(event: Event) {
    topN = Number((event.currentTarget as HTMLSelectElement).value);
  }
</script>

<section class="dashboard" aria-labelledby="frequency-dashboard-title">
  <div class="dashboard-heading">
    <h3 id="frequency-dashboard-title">{t('frequencyDashboard')}</h3>
    <p>{t('analysisForActiveFilters')}</p>
  </div>

  {#if analysis.entryCount === 0}
    <p class="empty-analysis" role="status">{t('noMatchingWords')}</p>
  {:else}
    <dl class="headline-metrics" aria-label={t('headlineMetrics')}>
      <div>
        <dt>{t('entries')}</dt>
        <dd>{formatNumber(analysis.entryCount)}</dd>
      </div>
      <div>
        <dt>{t('totalFrequency')}</dt>
        <dd>{formatNumber(analysis.totalFrequency)}</dd>
      </div>
      <div>
        <dt>{t('mostFrequent')}</dt>
        <dd>{analysis.topWord?.word} <span>({formatNumber(analysis.topWord?.frequency ?? 0)})</span></dd>
      </div>
      <div>
        <dt>{t('availableDimensions')}</dt>
        <dd>{analysis.partOfSpeech.length > 0 ? t('wordFrequencyAndPos') : t('wordAndFrequency')}</dd>
      </div>
    </dl>

    <section class="chart-section" aria-labelledby="top-words-title">
      <div class="chart-heading">
        <div>
          <h4 id="top-words-title">{t('topWords')}</h4>
          <p>{t('topWordsDescription')}</p>
        </div>
        <label>
          {t('showTop')}
          <select value={topN} onchange={selectTopN} aria-label={t('showTop')}>
            {#each topNOptions as count}
              <option value={count}>{count}</option>
            {/each}
          </select>
        </label>
      </div>
      <div class="bar-chart" role="img" aria-label={`${t('topWords')}: ${topWords.map((word) => `${word.word} ${formatNumber(word.frequency)}`).join(', ')}`}>
        {#each topWords as word}
          <div class="bar-row">
            <span class="bar-label">{word.word}</span>
            <div class="bar-track" aria-hidden="true"><div class="bar-fill" style={`width: ${barWidth(word.frequency)}`}></div></div>
            <span class="bar-value">{formatNumber(word.frequency)}</span>
          </div>
        {/each}
      </div>
      <details>
        <summary>{t('tableEquivalent')}</summary>
        <table>
          <thead><tr><th>{t('rank')}</th><th>{t('word')}</th><th>{t('frequency')}</th></tr></thead>
          <tbody>
            {#each topWords as word}
              <tr><td>{word.rank}</td><td>{word.word}</td><td>{formatNumber(word.frequency)}</td></tr>
            {/each}
          </tbody>
        </table>
      </details>
    </section>

    <section class="chart-section" aria-labelledby="rank-frequency-title">
      <h4 id="rank-frequency-title">{t('rankFrequency')}</h4>
      <p>{t('rankFrequencyDescription')}</p>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-labelledby="rank-frequency-title rank-frequency-description" class="line-chart">
        <desc id="rank-frequency-description">{t('rankFrequencyText', { first: formatNumber(analysis.topWord?.frequency ?? 0), last: formatNumber(minimumFrequency), count: formatNumber(analysis.entryCount) })}</desc>
        {#each frequencyTicks as tick}
          <line class="grid-line" x1={chartLeft} x2={chartWidth - chartRight} y1={logFrequencyY(tick)} y2={logFrequencyY(tick)} />
          <text class="axis-label" x={chartLeft - 8} y={logFrequencyY(tick) + 4} text-anchor="end">{formatNumber(tick)}</text>
        {/each}
        {#each rankTicks as tick}
          <line class="grid-line" x1={logRankX(tick)} x2={logRankX(tick)} y1={chartTop} y2={chartHeight - chartBottom} />
          <text class="axis-label" x={logRankX(tick)} y={chartHeight - 14} text-anchor="middle">{formatNumber(tick)}</text>
        {/each}
        <line class="axis-line" x1={chartLeft} x2={chartWidth - chartRight} y1={chartHeight - chartBottom} y2={chartHeight - chartBottom} />
        <line class="axis-line" x1={chartLeft} x2={chartLeft} y1={chartTop} y2={chartHeight - chartBottom} />
        <path class="series-line" d={rankFrequencyPath} />
        <text class="axis-title" x={chartWidth / 2} y={chartHeight - 1} text-anchor="middle">{t('rankLogScale')}</text>
        <text class="axis-title" transform={`translate(13 ${chartHeight / 2}) rotate(-90)`} text-anchor="middle">{t('frequencyLogScale')}</text>
      </svg>
      <details>
        <summary>{t('tableEquivalent')}</summary>
        <table>
          <thead><tr><th>{t('rank')}</th><th>{t('word')}</th><th>{t('frequency')}</th></tr></thead>
          <tbody>
            {#each rankFrequencySeries as word}
              <tr><td>{formatNumber(word.rank)}</td><td>{word.word}</td><td>{formatNumber(word.frequency)}</td></tr>
            {/each}
          </tbody>
        </table>
      </details>
    </section>

    <section class="chart-section" aria-labelledby="coverage-title">
      <h4 id="coverage-title">{t('cumulativeCoverage')}</h4>
      <p>{t('coverageDescription')}</p>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-labelledby="coverage-title coverage-description" class="line-chart">
        <desc id="coverage-description">{t('coverageText', { topTen: formatPercent(analysis.coverage[Math.min(9, analysis.coverage.length - 1)]?.coverage ?? 0) })}</desc>
        {#each coverageTicks as tick}
          <line class="grid-line" x1={chartLeft} x2={chartWidth - chartRight} y1={coverageY(tick)} y2={coverageY(tick)} />
          <text class="axis-label" x={chartLeft - 8} y={coverageY(tick) + 4} text-anchor="end">{formatPercent(tick)}</text>
        {/each}
        {#each rankTicks as tick}
          <line class="grid-line" x1={logRankX(tick)} x2={logRankX(tick)} y1={chartTop} y2={chartHeight - chartBottom} />
          <text class="axis-label" x={logRankX(tick)} y={chartHeight - 14} text-anchor="middle">{formatNumber(tick)}</text>
        {/each}
        <line class="axis-line" x1={chartLeft} x2={chartWidth - chartRight} y1={chartHeight - chartBottom} y2={chartHeight - chartBottom} />
        <line class="axis-line" x1={chartLeft} x2={chartLeft} y1={chartTop} y2={chartHeight - chartBottom} />
        <path class="series-line" d={coveragePath} />
        <text class="axis-title" x={chartWidth / 2} y={chartHeight - 1} text-anchor="middle">{t('rankLogScale')}</text>
        <text class="axis-title" transform={`translate(13 ${chartHeight / 2}) rotate(-90)`} text-anchor="middle">{t('tokenCoverage')}</text>
      </svg>
      <details>
        <summary>{t('tableEquivalent')}</summary>
        <table>
          <thead><tr><th>{t('rank')}</th><th>{t('cumulativeFrequency')}</th><th>{t('tokenCoverage')}</th></tr></thead>
          <tbody>
            {#each coverageSeries as point}
              <tr><td>{formatNumber(point.rank)}</td><td>{formatNumber(point.cumulativeFrequency)}</td><td>{formatPercent(point.coverage)}</td></tr>
            {/each}
          </tbody>
        </table>
      </details>
    </section>

    {#if analysis.partOfSpeech.length > 0}
      <section class="chart-section" aria-labelledby="pos-title">
        <h4 id="pos-title">{t('posComposition')}</h4>
        <p>{t('posCompositionDescription')}</p>
        <div class="bar-chart" role="img" aria-label={`${t('posComposition')}: ${analysis.partOfSpeech.map((part) => `${displayType(part.type)} ${formatPercent(part.share)}`).join(', ')}`}>
          {#each analysis.partOfSpeech as part}
            <div class="bar-row">
              <span class="bar-label">{displayType(part.type)}</span>
              <div class="bar-track" aria-hidden="true"><div class="bar-fill" style={`width: ${percentWidth(part.share)}`}></div></div>
              <span class="bar-value">{formatPercent(part.share)}</span>
            </div>
          {/each}
        </div>
        <details>
          <summary>{t('tableEquivalent')}</summary>
          <table>
            <thead><tr><th>{t('type')}</th><th>{t('frequency')}</th><th>{t('entries')}</th><th>{t('tokenCoverage')}</th></tr></thead>
            <tbody>
              {#each analysis.partOfSpeech as part}
                <tr><td>{displayType(part.type)}</td><td>{formatNumber(part.frequency)}</td><td>{formatNumber(part.entries)}</td><td>{formatPercent(part.share)}</td></tr>
              {/each}
            </tbody>
          </table>
        </details>
      </section>
    {/if}
  {/if}
</section>

<style>
  .dashboard {
    border-top: 1px solid var(--border-color);
    margin-top: var(--xl);
    padding-top: var(--lg);
  }

  .dashboard-heading,
  .chart-heading {
    display: flex;
    align-items: baseline;
    gap: var(--sm);
    justify-content: space-between;
  }

  .dashboard-heading h3,
  .chart-section h4 {
    color: var(--text-color);
  }

  .dashboard-heading p,
  .chart-section > p {
    color: color-mix(in srgb, var(--text-color) 72%, transparent);
  }

  .headline-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sm);
    margin: var(--md) 0 var(--xl);
  }

  .headline-metrics > div {
    border: 1px solid var(--border-color);
    padding: var(--sm);
  }

  dt {
    color: color-mix(in srgb, var(--text-color) 72%, transparent);
  }

  dd {
    font-size: 1.1em;
    margin: var(--xs) 0 0;
  }

  dd span {
    font-size: .85em;
  }

  .chart-section + .chart-section {
    border-top: 1px solid var(--border-color);
    margin-top: var(--xl);
    padding-top: var(--xl);
  }

  .chart-section h4 {
    margin-bottom: var(--xs);
  }

  .chart-heading label {
    display: flex;
    align-items: center;
    gap: var(--xs);
    white-space: nowrap;
  }

  select {
    background: var(--bg-color);
    border: 1px solid var(--text-color);
    color: var(--text-color);
    padding: var(--xs);
  }

  .bar-chart {
    display: grid;
    gap: var(--xs);
    margin: var(--md) 0;
  }

  .bar-row {
    align-items: center;
    display: grid;
    gap: var(--sm);
    grid-template-columns: minmax(6em, 1.25fr) minmax(4em, 3fr) auto;
  }

  .bar-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar-track {
    background: color-mix(in srgb, var(--text-color) 12%, transparent);
    height: .9em;
  }

  .bar-fill {
    background: var(--text-color);
    height: 100%;
  }

  .bar-value {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .line-chart {
    height: auto;
    margin-top: var(--md);
    overflow: visible;
    width: 100%;
  }

  .grid-line {
    stroke: color-mix(in srgb, var(--text-color) 18%, transparent);
    stroke-width: 1;
  }

  .axis-line {
    stroke: var(--text-color);
    stroke-width: 1;
  }

  .series-line {
    fill: none;
    stroke: var(--text-color);
    stroke-width: 2;
  }

  .axis-label,
  .axis-title {
    fill: var(--text-color);
    font-family: inherit;
    font-size: 11px;
  }

  .axis-title {
    font-size: 12px;
  }

  details {
    overflow-x: auto;
  }

  details table {
    border-collapse: collapse;
    margin-top: var(--sm);
    width: 100%;
  }

  th,
  td {
    border: 1px solid var(--border-color);
    padding: var(--xs) var(--sm);
    text-align: left;
  }

  @media (max-width: 639px) {
    .dashboard-heading,
    .chart-heading {
      align-items: flex-start;
      flex-direction: column;
    }

    .headline-metrics {
      grid-template-columns: 1fr;
    }

    .bar-row {
      grid-template-columns: minmax(5em, 1fr) minmax(3em, 2fr) auto;
    }
  }
</style>
