import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Users, ChefHat, Heart, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useRecipe } from '../hooks/useRecipes';
import { useSaveRecipe } from '../hooks/useSavedRecipes';
import { cn } from '../lib/utils';

const difficultyColors: Record<string, string> = {
  EASY: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HARD: 'bg-red-100 text-red-700',
};

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: recipe, isLoading } = useRecipe(id!);
  const saveRecipe = useSaveRecipe();
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="aspect-video bg-stone-200 rounded-2xl" />
        <div className="h-8 bg-stone-200 rounded w-2/3" />
        <div className="h-4 bg-stone-200 rounded w-1/2" />
      </div>
    );
  }

  if (!recipe) return null;

  const toggleStep = (i: number) => {
    setCheckedSteps(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-primary-100 to-accent-100 mb-6">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-primary-300">
            <Sparkles size={64} />
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-stone-800" dir="auto">
            {recipe.title}
          </h1>
          {recipe.description && (
            <p className="text-stone-500 mt-1" dir="auto">
              {recipe.description}
            </p>
          )}
        </div>
        <button
          onClick={() => saveRecipe.mutate({ recipeId: recipe.id })}
          className="p-3 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors shrink-0"
        >
          <Heart size={20} />
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        {recipe.prepTime && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 text-sm text-stone-600">
            <Clock size={14} />
            {t('recipe.prepTime')}: {recipe.prepTime} {t('recipe.minutes')}
          </span>
        )}
        {recipe.cookTime && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 text-sm text-stone-600">
            <Clock size={14} />
            {t('recipe.cookTime')}: {recipe.cookTime} {t('recipe.minutes')}
          </span>
        )}
        {recipe.servings && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 text-sm text-stone-600">
            <Users size={14} />
            {recipe.servings} {t('recipe.servings')}
          </span>
        )}
        {recipe.difficulty && (
          <span className={cn('px-3 py-1.5 rounded-full text-sm', difficultyColors[recipe.difficulty])}>
            {t(`recipe.${recipe.difficulty.toLowerCase()}`)}
          </span>
        )}
        {recipe.cuisine && (
          <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm" dir="auto">
            <ChefHat size={14} className="inline me-1" />
            {recipe.cuisine}
          </span>
        )}
        {recipe.isAiGenerated && (
          <span className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm flex items-center gap-1">
            <Sparkles size={14} />
            {t('recipe.aiGenerated')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-5">
          <h2 className="text-lg font-semibold mb-3">{t('recipe.ingredients')}</h2>
          <ul className="space-y-2">
            {recipe.ingredients?.map((ing: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="font-medium">{ing.amount} {ing.unit}</span>
                <span className="text-stone-600">{ing.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2 glass-card p-5">
          <h2 className="text-lg font-semibold mb-3">{t('recipe.steps')}</h2>
          <ol className="space-y-3">
            {recipe.steps?.map((step: string, i: number) => (
              <li
                key={i}
                onClick={() => toggleStep(i)}
                className={cn(
                  'flex gap-3 p-3 rounded-xl cursor-pointer transition-colors',
                  checkedSteps.has(i) ? 'bg-green-50 text-stone-400 line-through' : 'hover:bg-stone-50'
                )}
              >
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed" dir="auto">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
