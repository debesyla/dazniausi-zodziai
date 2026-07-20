<script>
  import { t } from '$lib/translations';
  let { value = $bindable(''), inputId = 'word-search' } = $props();
</script>

<div class="search-bar">
  <label class="sr-only" for={inputId}>{t('searchWords')}</label>
  <input id={inputId} bind:value type="text" placeholder={t('searchPlaceholder')} />
  {#if value}
  <button type="button" onclick={() => value = ''} aria-label={t('clearSearch')}>✕</button>
  {/if}
</div>

<style>
  .search-bar {
    display: flex;
    gap: var(--sm);
    align-items: center;
  }
  input {
    background: #222;
    color: #FFBF00;
    border: 1px solid #FFBF00;
    padding: var(--xs) var(--sm);
  }
  button {
    background: transparent;
    border: 1px solid #FFBF00;
    color: #FFBF00;
    padding: var(--xs) var(--sm);
    cursor: pointer;
    user-select: none;
  }
  button:hover {
    background: #FFBF00;
    color: #222;
  }

  .sr-only {
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    width: 1px;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  @media (max-width: 767px) {
    .search-bar {
      flex-direction: column;
      align-items: stretch;
    }
    input {
      width: 100%;
    }
    button {
      align-self: flex-end;
    }
  }
</style>
