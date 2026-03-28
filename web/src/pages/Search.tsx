import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, ChefHat, Link as LinkIcon, Image, FileText } from 'lucide-react';
import { useSearchRecipes } from '../hooks/useRecipes';
import { useAiGenerate, useAiImportText, useAiImportUrl } from '../hooks/useAiChef';
import RecipeCard from '../components/common/RecipeCard';
import SkeletonCard from '../components/common/SkeletonCard';
import EmptyState from '../components/common/EmptyState';
import { cn } from '../lib/utils';

type Tab = 'keyword' | 'ingredients' | 'import';

export default function Search() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('keyword');
  const [query, setQuery] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [importText, setImportText] = useState('');
  const [importUrl, setImportUrl] = useState('');

  const searchResults = useSearchRecipes({ q: query });
  const aiGenerate = useAiGenerate();
  const aiImportText = useAiImportText();
  const aiImportUrl = useAiImportUrl();

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
          <div className="relative mb-6">
            <SearchIcon size={20} className="absolute start-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              className="w-full ps-12 pe-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {searchResults.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : searchResults.data?.recipes?.map((recipe: any) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
          </div>
          {query && !searchResults.isLoading && !searchResults.data?.recipes?.length && (
            <EmptyState icon={SearchIcon} title={t('search.noResults')} />
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
