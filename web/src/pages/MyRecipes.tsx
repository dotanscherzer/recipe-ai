import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, ChefHat } from 'lucide-react';
import { useRecipes } from '../hooks/useRecipes';
import { useAuthStore } from '../store/authStore';
import RecipeCard from '../components/common/RecipeCard';
import SkeletonCard from '../components/common/SkeletonCard';
import EmptyState from '../components/common/EmptyState';

export default function MyRecipes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data, isLoading } = useRecipes(user ? { createdBy: user.id } : undefined);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">{t('nav.myRecipes')}</h1>
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />
          {t('common.create')}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data?.recipes?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.recipes.map((recipe: any) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ChefHat}
          title={t('common.empty')}
          action={{ label: t('common.create'), onClick: () => navigate('/search') }}
        />
      )}
    </div>
  );
}
