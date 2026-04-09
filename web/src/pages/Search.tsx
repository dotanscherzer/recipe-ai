import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Search as SearchIcon, ChefHat, Link as LinkIcon, Image, FileText } from 'lucide-react';
import { useSearchRecipes } from '../hooks/useRecipes';
import { useAiGenerate, useAiImportText, useAiImportUrl } from '../hooks/useAiChef';
import RecipeCard from '../components/common/RecipeCard';
import SkeletonCard from '../components/common/SkeletonCard';
import EmptyState from '../components/common/EmptyState';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { aiApi, recipesApi } from '../config/api';
import { normalizeAiRecipeForCreate } from '../lib/normalizeAiRecipeForCreate';
import { normalizeImportUrl } from '../lib/normalizeImportUrl';

type Tab = 'keyword' | 'ingredients' | 'import';

export default function Search() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const locale = useAppStore((s) => s.locale);
  const [activeTab, setActiveTab] = useState<Tab>('keyword');
  /** Committed query sent to API (avoid a request per keystroke → fewer 504s/timeouts). */
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [importText, setImportText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importSavedRecipe, setImportSavedRecipe] = useState<{
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: string;
    cuisine?: string;
    isAiGenerated?: boolean;
  } | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const [importUrlBusy, setImportUrlBusy] = useState(false);
  const [importTextBusy, setImportTextBusy] = useState(false);
  const [chefGenerating, setChefGenerating] = useState(false);
  const [chefError, setChefError] = useState(false);
  const [chefErrorMessage, setChefErrorMessage] = useState<string | null>(null);
  const [chefAttemptKey, setChefAttemptKey] = useState(0);
  const chefRunIdRef = useRef(0);

  const searchResults = useSearchRecipes({ q: keywordQuery });

  const executeAiChef = useCallback(
    async (
      resultMode: 'replaceEmpty' | 'prepend',
      opts?: { isCancelled?: () => boolean }
    ) => {
      const runId = ++chefRunIdRef.current;
      setChefGenerating(true);
      setChefError(false);
      setChefErrorMessage(null);
      try {
        if (opts?.isCancelled?.()) return;
        const { recipe } = await aiApi.generate({
          locale,
          prompt:
            locale === 'he'
              ? `צור מתכון ביתי מלא ומעשי שמתאים לחיפוש: "${keywordQuery}".`
              : `Create one complete, practical home-cooking recipe that matches this search: "${keywordQuery}".`,
        });
        if (opts?.isCancelled?.()) return;
        const body = normalizeAiRecipeForCreate(recipe as Record<string, unknown>);
        if (body.ingredients.length < 1 || body.steps.length < 1) {
          throw new Error('Invalid recipe shape');
        }
        const saved = await recipesApi.create({
          ...body,
          isAiGenerated: true,
          isPublic: true,
        });
        if (opts?.isCancelled?.()) return;
        if (runId !== chefRunIdRef.current) return;
        if (resultMode === 'replaceEmpty') {
          queryClient.setQueryData(['recipes', 'search', { q: keywordQuery }], {
            recipes: [saved],
            total: 1,
          });
        } else {
          queryClient.setQueryData(
            ['recipes', 'search', { q: keywordQuery }],
            (old: { recipes?: unknown[]; total?: number } | undefined) => {
              const prev = old?.recipes ?? [];
              return {
                recipes: [saved, ...prev],
                total: typeof old?.total === 'number' ? old.total + 1 : prev.length + 1,
              };
            }
          );
        }
        queryClient.invalidateQueries({ queryKey: ['recipes'] });
      } catch (e) {
        if (opts?.isCancelled?.()) return;
        if (runId !== chefRunIdRef.current) return;
        const msg = e instanceof Error ? e.message : '';
        const authFailed =
          /missing authorization|invalid or expired token|user not found|401/i.test(msg);
        if (authFailed) {
          void logout();
          setChefError(true);
          setChefErrorMessage(t('search.sessionExpired'));
        } else {
          setChefError(true);
          setChefErrorMessage(e instanceof Error ? e.message : null);
        }
      } finally {
        if (runId === chefRunIdRef.current) {
          setChefGenerating(false);
        }
      }
    },
    [keywordQuery, locale, queryClient, logout, t]
  );

  const aiGenerate = useAiGenerate();
  const aiImportText = useAiImportText();
  const aiImportUrl = useAiImportUrl();

  const handleImportError = useCallback(
    (e: unknown) => {
      const msg = e instanceof Error ? e.message : '';
      const authFailed =
        /missing authorization|invalid or expired token|user not found|401/i.test(msg);
      if (authFailed) {
        void logout();
        setImportErrorMessage(t('search.sessionExpired'));
      } else {
        setImportErrorMessage(e instanceof Error ? e.message : null);
      }
    },
    [logout, t]
  );

  const runImportUrl = useCallback(async () => {
    const url = normalizeImportUrl(importUrl);
    if (!url) return;
    setImportUrlBusy(true);
    setImportErrorMessage(null);
    setImportSavedRecipe(null);
    try {
      const { recipe } = await aiImportUrl.mutateAsync({
        url,
        ...(locale === 'he' || locale === 'en' ? { locale } : {}),
      });
      const body = normalizeAiRecipeForCreate(recipe as Record<string, unknown>);
      if (body.ingredients.length < 1 || body.steps.length < 1) {
        throw new Error('Invalid recipe shape');
      }
      const saved = await recipesApi.create({
        ...body,
        isAiGenerated: true,
        isPublic: true,
      });
      setImportSavedRecipe(saved);
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    } catch (e) {
      handleImportError(e);
    } finally {
      setImportUrlBusy(false);
    }
  }, [importUrl, locale, aiImportUrl, queryClient, handleImportError]);

  const runImportText = useCallback(async () => {
    const text = importText.trim();
    if (text.length < 10) return;
    setImportTextBusy(true);
    setImportErrorMessage(null);
    setImportSavedRecipe(null);
    try {
      const { recipe } = await aiImportText.mutateAsync({
        text,
        ...(locale === 'he' || locale === 'en' ? { locale } : {}),
      });
      const body = normalizeAiRecipeForCreate(recipe as Record<string, unknown>);
      if (body.ingredients.length < 1 || body.steps.length < 1) {
        throw new Error('Invalid recipe shape');
      }
      const saved = await recipesApi.create({
        ...body,
        isAiGenerated: true,
        isPublic: true,
      });
      setImportSavedRecipe(saved);
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    } catch (e) {
      handleImportError(e);
    } finally {
      setImportTextBusy(false);
    }
  }, [importText, locale, aiImportText, queryClient, handleImportError]);

  const runKeywordSearch = () => {
    const nextQuery = keywordInput.trim();
    setChefError(false);
    setChefErrorMessage(null);
    if (!nextQuery) {
      setKeywordQuery('');
      return;
    }
    if (nextQuery === keywordQuery) {
      void searchResults.refetch();
      return;
    }
    setKeywordQuery(nextQuery);
  };

  useEffect(() => {
    if (!keywordQuery || !searchResults.isSuccess || searchResults.isFetching || searchResults.isError) {
      return;
    }
    const recipes = searchResults.data?.recipes ?? [];
    if (recipes.length > 0 || !isAuthenticated) {
      return;
    }

    let cancelled = false;
    void executeAiChef('replaceEmpty', { isCancelled: () => cancelled });

    return () => {
      cancelled = true;
    };
  }, [
    keywordQuery,
    isAuthenticated,
    searchResults.isSuccess,
    searchResults.isFetching,
    searchResults.isError,
    searchResults.data?.recipes,
    chefAttemptKey,
    executeAiChef,
  ]);

  useEffect(() => {
    if (!keywordQuery) {
      setChefGenerating(false);
      setChefError(false);
      setChefErrorMessage(null);
    }
  }, [keywordQuery]);

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'keyword', label: t('search.byKeyword'), icon: SearchIcon },
    { key: 'ingredients', label: t('search.byIngredients'), icon: ChefHat },
    { key: 'import', label: t('search.import'), icon: FileText },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              activeTab === key ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'keyword' && (
        <div>
          <p className="text-sm text-stone-500 mb-3">{t('search.keywordHint')}</p>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <SearchIcon size={20} className="absolute start-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="search"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runKeywordSearch();
                  }
                }}
                placeholder={t('search.placeholder')}
                className="w-full ps-12 pe-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
            </div>
            <button
              type="button"
              onClick={runKeywordSearch}
              disabled={searchResults.isFetching || chefGenerating}
              className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0"
            >
              {searchResults.isFetching
                ? t('search.searching')
                : chefGenerating
                  ? t('ai.generating')
                  : t('search.runSearch')}
            </button>
          </div>

          {searchResults.isError && (
            <p className="text-sm text-red-600 mb-4" role="alert">
              {t('search.errorGeneric')}
            </p>
          )}

          {chefGenerating && (
            <p className="text-sm text-stone-600 mb-4 flex items-center gap-2" role="status">
              <span className="inline-block size-2 rounded-full bg-primary animate-pulse" aria-hidden />
              {t('search.chefCreatingFromSearch')}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {searchResults.isFetching || chefGenerating
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : searchResults.data?.recipes?.map((recipe: any) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
          </div>

          {keywordQuery &&
            !searchResults.isFetching &&
            !chefGenerating &&
            !searchResults.isError &&
            (searchResults.data?.recipes?.length ?? 0) > 0 && (
              <div className="mt-8 p-4 rounded-xl border border-stone-200 bg-stone-50/80 space-y-3">
                <p className="text-sm text-stone-600">{t('search.aiGenerateHint')}</p>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => void executeAiChef('prepend')}
                    disabled={chefGenerating}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-600 transition-colors disabled:opacity-50"
                  >
                    {t('search.aiGenerateButton')}
                  </button>
                ) : (
                  <p className="text-sm text-stone-600">
                    <Link to="/login" className="text-primary font-medium hover:underline">
                      {t('nav.login')}
                    </Link>
                    {' — '}
                    {t('search.loginToGenerate')}
                  </p>
                )}
              </div>
            )}
          {keywordQuery &&
            !searchResults.isFetching &&
            !chefGenerating &&
            !searchResults.isError &&
            !searchResults.data?.recipes?.length &&
            !isAuthenticated && (
              <div className="mt-8 text-center space-y-3">
                <EmptyState icon={SearchIcon} title={t('search.noResults')} />
                <p className="text-sm text-stone-600 max-w-md mx-auto">{t('search.loginToGenerate')}</p>
                <Link
                  to="/login"
                  className="inline-block text-primary font-medium hover:underline"
                >
                  {t('nav.login')}
                </Link>
              </div>
            )}
          {keywordQuery &&
            !searchResults.isFetching &&
            !chefGenerating &&
            !searchResults.isError &&
            !searchResults.data?.recipes?.length &&
            isAuthenticated &&
            chefError && (
              <div className="mt-8 text-center space-y-3">
                <p className="text-sm text-red-600" role="alert">
                  {t('search.chefCreateFailed')}
                </p>
                {chefErrorMessage && (
                  <p className="text-xs text-stone-500 max-w-lg mx-auto break-words" role="status">
                    {chefErrorMessage}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setChefError(false);
                    setChefErrorMessage(null);
                    setChefAttemptKey((k) => k + 1);
                  }}
                  className="text-primary font-medium text-sm hover:underline"
                >
                  {t('search.retrySearch')}
                </button>
              </div>
            )}
        </div>
      )}

      {activeTab === 'ingredients' && (
        <div>
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder="עוף, אורז, בצל, שום..."
            className="w-full p-4 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white min-h-[120px] resize-none"
          />
          <button
            onClick={() =>
              aiGenerate.mutate({
                locale,
                prompt:
                  locale === 'he'
                    ? `צור מתכון שמשתמש במרכיבים הבאים: ${ingredients}`
                    : `Create a recipe using these ingredients: ${ingredients}`,
              })
            }
            disabled={!ingredients || aiGenerate.isPending}
            className="mt-3 px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent-600 transition-colors disabled:opacity-50"
          >
            {aiGenerate.isPending ? t('ai.generating') : t('ai.generate')}
          </button>
          {aiGenerate.data && (
            <div className="mt-6">
              <RecipeCard recipe={aiGenerate.data.recipe || aiGenerate.data} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'import' && (
        <div className="space-y-6">
          {!isAuthenticated && (
            <p className="text-sm text-stone-600">
              {t('search.loginToImport')}{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                {t('nav.login')}
              </Link>
            </p>
          )}
          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">
              <LinkIcon size={14} className="inline me-1" />
              {t('ai.importUrl')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="url"
                autoComplete="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="tiktok.com/... or https://..."
                className="flex-1 px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
              <button
                type="button"
                onClick={() => void runImportUrl()}
                disabled={
                  !normalizeImportUrl(importUrl) || importUrlBusy || !isAuthenticated
                }
                className="px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {importUrlBusy ? t('ai.processing') : t('search.import')}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">
              <Image size={14} className="inline me-1" />
              {t('ai.importText')}
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="הדבק מתכון כאן..."
              className="w-full p-4 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white min-h-[150px] resize-none"
            />
            <button
              type="button"
              onClick={() => void runImportText()}
              disabled={
                importText.trim().length < 10 || importTextBusy || !isAuthenticated
              }
              className="mt-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {importTextBusy ? t('ai.processing') : t('search.import')}
            </button>
          </div>

          {importErrorMessage && (
            <p className="text-sm text-red-600" role="alert">
              {importErrorMessage}
            </p>
          )}
          {importSavedRecipe && (
            <div className="mt-4">
              <RecipeCard recipe={importSavedRecipe} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
