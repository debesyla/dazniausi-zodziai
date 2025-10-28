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
    gap: 0.5rem;
    align-items: center;
  }
  input {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    padding: 0.5rem;
  }
  button {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    padding: 0.5rem;
    cursor: pointer;
  }
  button:hover {
    background-color: #111;
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