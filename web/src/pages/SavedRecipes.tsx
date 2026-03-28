import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { useSavedRecipes } from '../hooks/useSavedRecipes';
import { useCategories } from '../hooks/useCategories';
import RecipeCard from '../components/common/RecipeCard';
import SkeletonCard from '../components/common/SkeletonCard';
import EmptyState from '../components/common/EmptyState';
import { useState } from 'react';
import { cn } from '../lib/utils';

export default function SavedRecipes() {
  const { t } = useTranslation();
  const { data: savedRecipes, isLoading } = useSavedRecipes();
  const { data: categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = savedRecipes?.filter((sr: any) =>
    selectedCategory ? sr.categoryId === selectedCategory : true
  );

  const favorites = filtered?.filter((sr: any) => sr.isFavorite);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">{t('nav.saved')}</h1>

      {categories?.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              !selectedCategory ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600'
            )}
          >
            {t('nav.saved')}
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                selectedCategory === cat.id ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered?.length ? (
        <>
          {favorites?.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-stone-700 mb-3 flex items-center gap-2">
                <Heart size={18} className="text-secondary" />
                {t('recipe.favorite')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favorites.map((sr: any) => (
                  <RecipeCard key={sr.id} recipe={sr.recipe} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered
              .filter((sr: any) => !sr.isFavorite)
              .map((sr: any) => (
                <RecipeCard key={sr.id} recipe={sr.recipe} />
              ))}
          </div>
        </>
      ) : (
        <EmptyState icon={Heart} title={t('common.empty')} />
      )}
    </div>
  );
}
