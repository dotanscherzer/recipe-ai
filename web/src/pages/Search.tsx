import { useState, useEffect, useRef } from 'react';
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
import { aiApi, recipesApi } from '../config/api';
import { normalizeAiRecipeForCreate } from '../lib/normalizeAiRecipeForCreate';

type Tab = 'keyword' | 'ingredients' | 'import';

export default function Search() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [activeTab, setActiveTab] = useState<Tab>('keyword');
  /** Committed query sent to API (avoid a request per keystroke → fewer 504s/timeouts). */
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [importText, setImportText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [chefGenerating, setChefGenerating] = useState(false);
  const [chefError, setChefError] = useState(false);
  const [chefErrorMessage, setChefErrorMessage] = useState<string | null>(null);
  const [chefAttemptKey, setChefAttemptKey] = useState(0);
  const chefRunIdRef = useRef(0);

  const searchResults = useSearchRecipes({ q: keywordQuery });

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
  const aiGenerate = useAiGenerate();
  const aiImportText = useAiImportText();
  const aiImportUrl = useAiImportUrl();

  useEffect(() => {
    if (!keywordQuery || !searchResults.isSuccess || searchResults.isFetching || searchResults.isError) {
      return;
    }
    const recipes = searchResults.data?.recipes ?? [];
    if (recipes.length > 0 || !isAuthenticated) {
      return;
    }

    const runId = ++chefRunIdRef.current;
    let cancelled = false;
    setChefGenerating(true);
    setChefError(false);

    (async () => {
      try {
        const { recipe } = await aiApi.generate({
          prompt: `Create one complete, practical home-cooking recipe that matches this search: "${keywordQuery}". Prefer titles and instructions in the same language as the search text when it is not English.`,
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
        if (cancelled || runId !== chefRunIdRef.current) return;
        queryClient.setQueryData(['recipes', 'search', { q: keywordQuery }], {
          recipes: [saved],
          total: 1,
        });
        queryClient.invalidateQueries({ queryKey: ['recipes'] });
      } catch (e) {
        if (!cancelled && runId === chefRunIdRef.current) {
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
        }
      } finally {
        if (!cancelled && runId === chefRunIdRef.current) {
          setChefGenerating(false);
        }
      }
    })();

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
    queryClient,
    chefAttemptKey,
    logout,
    t,
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
            onClick={() => aiGenerate.mutate({ prompt: `Create a recipe using these ingredients: ${ingredients}` })}
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
          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">
              <LinkIcon size={14} className="inline me-1" />
              {t('ai.importUrl')}
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
              <button
                onClick={() => aiImportUrl.mutate({ url: importUrl })}
                disabled={!importUrl || aiImportUrl.isPending}
                className="px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {aiImportUrl.isPending ? t('ai.processing') : t('search.import')}
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
              onClick={() => aiImportText.mutate({ text: importText })}
              disabled={!importText || aiImportText.isPending}
              className="mt-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {aiImportText.isPending ? t('ai.processing') : t('search.import')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
