<script>
  import { t } from '$lib/translations';
  let { value = $bindable('') } = $props();
</script>

<div class="search-bar">
  <input bind:value type="text" placeholder={t('searchPlaceholder')} />
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