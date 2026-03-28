import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { useRecipes } from '../hooks/useRecipes';
import RecipeCard from '../components/common/RecipeCard';
import SkeletonCard from '../components/common/SkeletonCard';

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useRecipes();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center py-8 lg:py-12">
        <h1 className="text-3xl lg:text-4xl font-bold text-stone-800">
          {t('app.name')}
        </h1>
        <p className="text-stone-500 mt-2 text-lg">{t('app.tagline')}</p>

        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            <Search size={20} />
            {t('search.placeholder')}
          </button>
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-2 px-6 py-3 bg-accent/10 text-accent rounded-xl font-medium hover:bg-accent/20 transition-colors"
          >
            <Sparkles size={20} />
            {t('ai.chef')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : data?.recipes?.map((recipe: any) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
      </div>
    </div>
  );
}
